import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { FeesService } from '../fees/fees.service';
import { ctx, tid } from '../common/context/request-context';
import { addDays, money, paginate, startOfToday, toJson } from '../common/utils';
import { HealthRecordDto, HealthVisitDto } from './dto';

/** School clinic: confidential health records per student and a log of sick-bay visits. */
@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly fees: FeesService,
  ) {}

  private readonly studentSelect = {
    id: true,
    studentId: true,
    firstName: true,
    lastName: true,
    photoUrl: true,
    class: { select: { id: true, name: true } },
  } as const;

  async record(studentId: string) {
    const student = await this.prisma.db.student.findUnique({
      where: { id: studentId },
      select: {
        ...this.studentSelect,
        medicalNotes: true,
        emergencyContactName: true,
        emergencyContactPhone: true,
        dateOfBirth: true,
        gender: true,
      },
    });
    if (!student) throw new NotFoundException('Student not found');
    const [record, visits] = await Promise.all([
      this.prisma.db.healthRecord.findUnique({ where: { studentId } }),
      this.prisma.db.healthVisit.findMany({ where: { studentId }, orderBy: { date: 'desc' }, take: 50 }),
    ]);
    return { student, record, visits };
  }

  async upsertRecord(studentId: string, dto: HealthRecordDto) {
    const student = await this.prisma.db.student.findUnique({ where: { id: studentId }, select: { id: true } });
    if (!student) throw new NotFoundException('Student not found');
    const data = { ...dto, immunizations: dto.immunizations ? toJson(dto.immunizations) : undefined };
    const r = await this.prisma.db.healthRecord.upsert({
      where: { studentId },
      create: { tenantId: tid(), studentId, ...data },
      update: data,
    });
    await this.audit.log({
      action: 'HEALTH_RECORD_UPDATED',
      entity: 'Student',
      entityId: studentId,
      after: { fields: Object.keys(dto) },
    });
    return r;
  }

  async visits(q: { page?: number; pageSize?: number; from?: string; to?: string; type?: string; search?: string }) {
    const { skip, take, page, pageSize } = paginate(q.page, q.pageSize);
    const where: any = {};
    if (q.type) where.type = q.type;
    if (q.from || q.to)
      where.date = {
        gte: q.from ? new Date(q.from) : undefined,
        lte: q.to ? new Date(q.to + 'T23:59:59.999Z') : undefined,
      };
    if (q.search)
      where.OR = [
        { complaint: { contains: q.search, mode: 'insensitive' } },
        { student: { firstName: { contains: q.search, mode: 'insensitive' } } },
        { student: { lastName: { contains: q.search, mode: 'insensitive' } } },
      ];
    const [items, total] = await Promise.all([
      this.prisma.db.healthVisit.findMany({
        where,
        skip,
        take,
        orderBy: { date: 'desc' },
        include: { student: { select: this.studentSelect } },
      }),
      this.prisma.db.healthVisit.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async logVisit(dto: HealthVisitDto) {
    const student = await this.prisma.db.student.findUnique({
      where: { id: dto.studentId },
      select: { id: true, firstName: true },
    });
    if (!student) throw new NotFoundException('Student not found');
    const v = await this.prisma.db.healthVisit.create({
      data: {
        tenantId: tid(),
        studentId: dto.studentId,
        date: dto.date ? new Date(dto.date) : new Date(),
        type: dto.type ?? 'SICK_BAY',
        complaint: dto.complaint.trim(),
        treatment: dto.treatment,
        temperature: dto.temperature !== undefined ? money(dto.temperature) : null,
        referredOut: !!dto.referredOut,
        parentNotified: !!dto.notifyParent,
        recordedById: ctx().userId,
        notes: dto.notes,
      },
      include: { student: { select: this.studentSelect } },
    });
    if (dto.notifyParent) {
      await this.fees.notifyGuardians(
        dto.studentId,
        `${student.firstName} visited the school clinic`,
        `${dto.complaint}${dto.treatment ? ` — ${dto.treatment}` : ''}${dto.referredOut ? '. The student was referred to a hospital; please contact the school immediately.' : ''}`,
        { visitId: v.id },
      );
    }
    await this.audit.log({
      action: 'HEALTH_VISIT_LOGGED',
      entity: 'HealthVisit',
      entityId: v.id,
      after: { studentId: dto.studentId, type: v.type, referredOut: v.referredOut },
    });
    return v;
  }

  async summary() {
    const db = this.prisma.db;
    const since = addDays(startOfToday(), -30);
    const [visits30d, byType, referred, today, allergies] = await Promise.all([
      db.healthVisit.count({ where: { date: { gte: since } } }),
      db.healthVisit.groupBy({ by: ['type'], where: { date: { gte: since } }, _count: { _all: true } }),
      db.healthVisit.count({ where: { date: { gte: since }, referredOut: true } }),
      db.healthVisit.findMany({
        where: { date: { gte: startOfToday() } },
        include: { student: { select: this.studentSelect } },
        orderBy: { date: 'desc' },
      }),
      db.healthRecord.count({ where: { allergies: { not: null } } }),
    ]);
    return {
      visits30d,
      byType: Object.fromEntries(byType.map((t) => [t.type, t._count._all])),
      referred30d: referred,
      today,
      studentsWithAllergies: allergies,
    };
  }

  /** Portal view for parents (their own child) — visits only, record summary without clinical notes. */
  async forStudent(studentId: string) {
    const [record, visits] = await Promise.all([
      this.prisma.db.healthRecord.findUnique({
        where: { studentId },
        select: {
          bloodGroup: true,
          allergies: true,
          conditions: true,
          medications: true,
          immunizations: true,
          updatedAt: true,
        },
      }),
      this.prisma.db.healthVisit.findMany({
        where: { studentId },
        orderBy: { date: 'desc' },
        take: 20,
        select: { id: true, date: true, type: true, complaint: true, treatment: true, referredOut: true },
      }),
    ]);
    return { record, visits };
  }
}
