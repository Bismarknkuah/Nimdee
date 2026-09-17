import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { StudentsService } from '../students/students.service';
import { FeesService } from '../fees/fees.service';
import { ctx, hasPermission, tid } from '../common/context/request-context';
import { addDays, paginate, startOfToday, toDateOnly } from '../common/utils';
import { CreateIncidentDto, ListIncidentsDto, UpdateIncidentDto } from './dto';

/**
 * Discipline & behaviour tracking.
 *
 * Every incident is tied to a student, carries a severity and optional demerit points, and moves through
 * OPEN → RESOLVED / ESCALATED. Teachers may only log incidents for students in classes they are assigned
 * to; administrators see the whole school. Parents are notified (in-app) when a school chooses to.
 */
@Injectable()
export class DisciplineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly students: StudentsService,
    private readonly fees: FeesService,
  ) {}

  private readonly include = {
    student: {
      select: {
        id: true,
        studentId: true,
        firstName: true,
        lastName: true,
        photoUrl: true,
        class: { select: { id: true, name: true } },
      },
    },
  } as const;

  async list(q: ListIncidentsDto) {
    const { skip, take, page, pageSize } = paginate(q.page, q.pageSize);
    const where: any = {};
    if (q.studentId) where.studentId = q.studentId;
    if (q.classId) where.student = { classId: q.classId };
    if (q.status) where.status = q.status;
    if (q.severity) where.severity = q.severity;
    if (q.from || q.to)
      where.date = { gte: q.from ? toDateOnly(q.from) : undefined, lte: q.to ? toDateOnly(q.to) : undefined };
    if (q.search) {
      where.OR = [
        { description: { contains: q.search, mode: 'insensitive' } },
        { category: { contains: q.search, mode: 'insensitive' } },
        { student: { firstName: { contains: q.search, mode: 'insensitive' } } },
        { student: { lastName: { contains: q.search, mode: 'insensitive' } } },
      ];
    }

    // Teachers without school-wide permissions only see their own classes.
    const c = ctx();
    if (c.userType === 'TEACHER' && !hasPermission(c.permissions, 'ACADEMIC_MANAGE') && c.staffId) {
      where.student = {
        ...(where.student ?? {}),
        class: { OR: [{ classTeacherId: c.staffId }, { subjects: { some: { teacherId: c.staffId } } }] },
      };
    }

    const [items, total, byStatus] = await Promise.all([
      this.prisma.db.disciplineIncident.findMany({
        where,
        skip,
        take,
        orderBy: { date: 'desc' },
        include: this.include,
      }),
      this.prisma.db.disciplineIncident.count({ where }),
      this.prisma.db.disciplineIncident.groupBy({ by: ['status'], _count: { _all: true } }),
    ]);

    const reporterIds = [...new Set(items.map((i) => i.reportedById).filter(Boolean))];
    const reporters = reporterIds.length
      ? await this.prisma.db.user.findMany({
          where: { id: { in: reporterIds } },
          select: { id: true, firstName: true, lastName: true },
        })
      : [];

    return {
      items: items.map((i) => {
        const r = reporters.find((u) => u.id === i.reportedById);
        return { ...i, reportedByName: r ? `${r.firstName} ${r.lastName}` : null };
      }),
      total,
      page,
      pageSize,
      byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count._all])),
    };
  }

  async get(id: string) {
    const inc = await this.prisma.db.disciplineIncident.findUnique({ where: { id }, include: this.include });
    if (!inc) throw new NotFoundException('Incident not found');
    return inc;
  }

  async create(dto: CreateIncidentDto) {
    const student = await this.prisma.db.student.findUnique({
      where: { id: dto.studentId },
      select: { id: true, classId: true, firstName: true },
    });
    if (!student) throw new NotFoundException('Student not found');
    if (student.classId) await this.students.assertClassAccess(student.classId);

    const inc = await this.prisma.db.disciplineIncident.create({
      data: {
        tenantId: tid(),
        studentId: dto.studentId,
        date: toDateOnly(dto.date),
        category: dto.category,
        severity: dto.severity ?? 'MINOR',
        description: dto.description.trim(),
        actionTaken: dto.actionTaken?.trim(),
        points: dto.points ?? 0,
        parentNotified: !!dto.notifyParent,
        reportedById: ctx().userId,
      },
      include: this.include,
    });

    if (dto.notifyParent) {
      await this.fees.notifyGuardians(
        dto.studentId,
        'Behaviour incident recorded',
        `An incident (${dto.category.toLowerCase().replace('_', ' ')}) was recorded for ${student.firstName}. Please contact the school for details.`,
        { incidentId: inc.id },
      );
    }

    await this.audit.log({
      action: 'DISCIPLINE_INCIDENT_CREATED',
      entity: 'DisciplineIncident',
      entityId: inc.id,
      after: { studentId: dto.studentId, category: dto.category, severity: inc.severity, points: inc.points },
    });
    return inc;
  }

  async update(id: string, dto: UpdateIncidentDto) {
    const before = await this.get(id);
    if (before.student.class?.id) await this.students.assertClassAccess(before.student.class.id);

    const resolving = dto.status && dto.status !== 'OPEN' && before.status === 'OPEN';
    const inc = await this.prisma.db.disciplineIncident.update({
      where: { id },
      data: {
        actionTaken: dto.actionTaken?.trim(),
        status: dto.status,
        severity: dto.severity,
        points: dto.points,
        parentNotified: dto.notifyParent ? true : undefined,
        resolvedById: resolving ? ctx().userId : undefined,
        resolvedAt: resolving ? new Date() : undefined,
      },
      include: this.include,
    });

    if (dto.notifyParent && !before.parentNotified) {
      await this.fees.notifyGuardians(
        before.studentId,
        'Behaviour incident update',
        `The school has recorded an update on an incident for ${before.student.firstName}.`,
        { incidentId: id },
      );
    }

    await this.audit.log({
      action: 'DISCIPLINE_INCIDENT_UPDATED',
      entity: 'DisciplineIncident',
      entityId: id,
      before: { status: before.status, actionTaken: before.actionTaken },
      after: dto,
    });
    return inc;
  }

  async remove(id: string) {
    const before = await this.get(id);
    if (!hasPermission(ctx().permissions, 'DISCIPLINE_MANAGE')) throw new ForbiddenException('Missing permission');
    await this.prisma.db.disciplineIncident.delete({ where: { id } });
    await this.audit.log({ action: 'DISCIPLINE_INCIDENT_DELETED', entity: 'DisciplineIncident', entityId: id, before });
    return { ok: true };
  }

  /** Per-student behaviour summary used on the student profile and the parent portal. */
  async studentSummary(studentId: string) {
    const [incidents, points] = await Promise.all([
      this.prisma.db.disciplineIncident.findMany({ where: { studentId }, orderBy: { date: 'desc' }, take: 50 }),
      this.prisma.db.disciplineIncident.aggregate({ where: { studentId }, _sum: { points: true } }),
    ]);
    const bySeverity = { MINOR: 0, MODERATE: 0, SERIOUS: 0 };
    for (const i of incidents) bySeverity[i.severity]++;
    return {
      incidents,
      totalPoints: points._sum.points ?? 0,
      bySeverity,
      open: incidents.filter((i) => i.status === 'OPEN').length,
    };
  }

  /** School-wide overview: trend over the last 12 weeks, top categories, students with most points. */
  async overview() {
    const db = this.prisma.db;
    const since = addDays(startOfToday(), -84);
    const [recent, byCategory, byClass, topStudents] = await Promise.all([
      db.disciplineIncident.findMany({ where: { date: { gte: since } }, select: { date: true, severity: true } }),
      db.disciplineIncident.groupBy({
        by: ['category'],
        where: { date: { gte: since } },
        _count: { _all: true },
        orderBy: { _count: { category: 'desc' } },
      }),
      db.disciplineIncident.findMany({
        where: { date: { gte: since } },
        select: { student: { select: { class: { select: { id: true, name: true } } } } },
      }),
      db.disciplineIncident.groupBy({
        by: ['studentId'],
        _sum: { points: true },
        _count: { _all: true },
        orderBy: { _sum: { points: 'desc' } },
        take: 10,
      }),
    ]);

    const weeks = new Map<string, { week: string; MINOR: number; MODERATE: number; SERIOUS: number }>();
    for (const r of recent) {
      const d = new Date(r.date);
      const weekStart = addDays(d, -((d.getUTCDay() + 6) % 7))
        .toISOString()
        .slice(0, 10);
      if (!weeks.has(weekStart)) weeks.set(weekStart, { week: weekStart, MINOR: 0, MODERATE: 0, SERIOUS: 0 });
      weeks.get(weekStart)[r.severity]++;
    }

    const classCounts = new Map<string, { classId: string; name: string; count: number }>();
    for (const r of byClass) {
      const c = r.student.class;
      if (!c) continue;
      if (!classCounts.has(c.id)) classCounts.set(c.id, { classId: c.id, name: c.name, count: 0 });
      classCounts.get(c.id).count++;
    }

    const studentIds = topStudents.map((t) => t.studentId);
    const students = studentIds.length
      ? await db.student.findMany({
          where: { id: { in: studentIds } },
          select: { id: true, studentId: true, firstName: true, lastName: true, class: { select: { name: true } } },
        })
      : [];

    return {
      weekly: [...weeks.values()].sort((a, b) => a.week.localeCompare(b.week)),
      byCategory: byCategory.map((c) => ({ category: c.category, count: c._count._all })),
      byClass: [...classCounts.values()].sort((a, b) => b.count - a.count),
      topStudents: topStudents.map((t) => ({
        ...students.find((s) => s.id === t.studentId),
        points: t._sum.points ?? 0,
        incidents: t._count._all,
      })),
      total90d: recent.length,
    };
  }
}
