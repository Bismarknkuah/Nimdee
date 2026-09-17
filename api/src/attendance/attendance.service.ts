import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { TenantCacheService } from '../tenants/tenant-cache.service';
import { StudentsService } from '../students/students.service';
import { ProvidersService } from '../communications/providers.service';
import { templates } from '../communications/templates';
import { ctx, tid } from '../common/context/request-context';
import { addDays, isoDate, startOfToday, toDateOnly, toJson } from '../common/utils';
import { ATTENDANCE_STATUSES, AttendanceRecordDto, MarkAttendanceDto } from './dto';

export type ConflictPolicy = 'LATEST_WINS' | 'SERVER_WINS' | 'MANUAL';
export interface ApplyOptions {
  source: 'WEB' | 'OFFLINE' | 'QR';
  deviceId?: string;
  clientTimestamp?: Date;
  policy?: ConflictPolicy;
  operationId?: string;
}
export interface ApplyResult {
  applied: number;
  skipped: number;
  conflicts: number;
  invalid: string[];
}

@Injectable()
export class AttendanceService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private tenants: TenantCacheService,
    private students: StudentsService,
    private providers: ProvidersService,
  ) {}

  /**
   * Idempotent, policy-aware bulk mark. Shared by the web endpoint and the offline sync engine.
   * `db` may be a tenant client or an interactive transaction.
   */
  async applyMarks(
    db: any,
    classId: string,
    dateStr: string,
    records: AttendanceRecordDto[],
    opts: ApplyOptions,
  ): Promise<ApplyResult> {
    const tenantId = tid();
    const date = toDateOnly(dateStr);
    if (date > addDays(startOfToday(), 1)) throw new BadRequestException('Cannot mark attendance for a future date');
    const policy = opts.policy ?? 'LATEST_WINS';
    const cls = await db.schoolClass.findFirst({ where: { tenantId, id: classId }, select: { id: true } });
    if (!cls) throw new NotFoundException('Class not found');
    const students = await db.student.findMany({ where: { tenantId, classId }, select: { id: true } });
    const allowed = new Set(students.map((s: any) => s.id));
    const existing = await db.attendance.findMany({ where: { tenantId, classId, date } });
    const byStudent = new Map<string, any>(existing.map((e: any) => [e.studentId, e]));
    const result: ApplyResult = { applied: 0, skipped: 0, conflicts: 0, invalid: [] };
    const seen = new Set<string>();
    for (const r of records) {
      if (!allowed.has(r.studentId) || !ATTENDANCE_STATUSES.includes(r.status) || seen.has(r.studentId)) {
        result.invalid.push(r.studentId);
        continue;
      }
      seen.add(r.studentId);
      const cur = byStudent.get(r.studentId);
      if (cur && opts.source === 'OFFLINE') {
        const same = cur.status === r.status && (cur.note ?? null) === (r.note ?? null);
        if (same) {
          result.skipped++;
          continue;
        }
        const serverTs: Date = cur.clientTimestamp ?? cur.updatedAt;
        if (
          policy === 'SERVER_WINS' ||
          (policy === 'LATEST_WINS' && opts.clientTimestamp && serverTs > opts.clientTimestamp)
        ) {
          result.skipped++;
          continue;
        }
        if (policy === 'MANUAL') {
          await db.syncConflict.create({
            data: {
              tenantId,
              entity: 'attendance',
              entityId: cur.id,
              deviceId: opts.deviceId,
              operationId: opts.operationId,
              serverValue: toJson({ status: cur.status, note: cur.note, updatedAt: cur.updatedAt }),
              clientValue: toJson({ ...r, classId, date: dateStr, clientTimestamp: opts.clientTimestamp }),
            },
          });
          result.conflicts++;
          continue;
        }
      }
      await db.attendance.upsert({
        where: { tenantId_studentId_date: { tenantId, studentId: r.studentId, date } },
        create: {
          tenantId,
          studentId: r.studentId,
          classId,
          date,
          status: r.status,
          note: r.note ?? null,
          markedById: ctx().userId ?? null,
          source: opts.source,
          deviceId: opts.deviceId ?? null,
          clientTimestamp: opts.clientTimestamp ?? null,
        },
        update: {
          status: r.status,
          note: r.note ?? null,
          classId,
          markedById: ctx().userId ?? null,
          source: opts.source,
          deviceId: opts.deviceId ?? null,
          clientTimestamp: opts.clientTimestamp ?? null,
        },
      });
      result.applied++;
    }
    return result;
  }

  async mark(dto: MarkAttendanceDto) {
    await this.students.assertClassAccess(dto.classId);
    const settings = await this.tenants.settings(tid());
    const result = await this.prisma.tenantTx((tx) =>
      this.applyMarks(tx, dto.classId, dto.date, dto.records, {
        source: 'WEB',
        policy: settings.sync.conflictPolicy,
        clientTimestamp: new Date(),
      }),
    );
    await this.audit.log({
      action: 'ATTENDANCE_MARKED',
      entity: 'SchoolClass',
      entityId: dto.classId,
      after: { date: dto.date, ...result },
    });
    if (settings.attendance.notifyParentsOnAbsence)
      this.notifyAbsences(
        dto.classId,
        dto.date,
        dto.records.filter((r) => r.status === 'ABSENT').map((r) => r.studentId),
      ).catch(() => undefined);
    return result;
  }

  /** Parents of absent students get an in-app notification (and SMS when the school enables it). */
  async notifyAbsences(classId: string, date: string, studentIds: string[]) {
    if (!studentIds.length) return;
    const snap = await this.tenants.get(tid());
    const cls = await this.prisma.db.schoolClass.findUnique({ where: { id: classId }, select: { name: true } });
    const already = await this.prisma.db.notification.findMany({
      where: { type: 'ATTENDANCE', createdAt: { gte: startOfToday() }, data: { path: ['date'], equals: date } },
      select: { data: true },
    });
    const done = new Set(already.map((n: any) => n.data?.studentId));
    const links = await this.prisma.db.studentGuardian.findMany({
      where: { studentId: { in: studentIds.filter((id) => !done.has(id)) } },
      include: {
        guardian: { select: { userId: true, phone: true } },
        student: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    const rows: any[] = [];
    const phones: string[] = [];
    for (const l of links) {
      const t = templates.absence(
        { name: snap.name, primaryColor: snap.primaryColor },
        { student: `${l.student.firstName} ${l.student.lastName}`, date, status: 'ABSENT', className: cls?.name ?? '' },
      );
      if (l.guardian.userId)
        rows.push({
          tenantId: tid(),
          userId: l.guardian.userId,
          title: t.subject,
          body: t.text,
          type: 'ATTENDANCE',
          data: { studentId: l.student.id, date },
        });
      if (l.guardian.phone && snap.settings.communication.smsEnabled) phones.push(l.guardian.phone);
    }
    if (rows.length) await this.prisma.db.notification.createMany({ data: rows });
    if (phones.length)
      await this.providers.sendSms(
        phones,
        `${snap.name}: your child was marked absent today (${date}). Contact the school if unexpected.`,
        snap.settings.communication.smsSenderId,
      );
  }

  /** Class register for a date: every active student with their mark (or null). */
  async register(classId: string, dateStr: string) {
    const date = toDateOnly(dateStr);
    const [students, marks] = await Promise.all([
      this.prisma.db.student.findMany({
        where: { classId, status: 'ACTIVE' },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        select: { id: true, studentId: true, firstName: true, lastName: true, gender: true, photoUrl: true },
      }),
      this.prisma.db.attendance.findMany({ where: { classId, date } }),
    ]);
    const map = new Map(marks.map((m) => [m.studentId, m]));
    return {
      classId,
      date: dateStr,
      marked: marks.length > 0,
      students: students.map((s) => ({
        ...s,
        attendance: map.get(s.id)
          ? {
              status: map.get(s.id).status,
              note: map.get(s.id).note,
              source: map.get(s.id).source,
              updatedAt: map.get(s.id).updatedAt,
            }
          : null,
      })),
    };
  }

  /** Per-student totals for a class over a date range plus a day-by-day series. */
  async summary(classId: string, from?: string, to?: string) {
    const start = from ? toDateOnly(from) : addDays(startOfToday(), -30);
    const end = to ? toDateOnly(to) : startOfToday();
    const [students, marks] = await Promise.all([
      this.prisma.db.student.findMany({
        where: { classId, status: 'ACTIVE' },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        select: { id: true, studentId: true, firstName: true, lastName: true },
      }),
      this.prisma.db.attendance.findMany({
        where: { classId, date: { gte: start, lte: end } },
        select: { studentId: true, status: true, date: true },
      }),
    ]);
    const settings = await this.tenants.settings(tid());
    const days = new Map<string, { PRESENT: number; ABSENT: number; LATE: number; EXCUSED: number; SICK: number }>();
    const per = new Map(students.map((s) => [s.id, { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0, SICK: 0 }]));
    for (const m of marks) {
      const d = isoDate(m.date);
      if (!days.has(d)) days.set(d, { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0, SICK: 0 });
      days.get(d)[m.status]++;
      if (per.has(m.studentId)) per.get(m.studentId)[m.status]++;
    }
    const schoolDays = days.size;
    return {
      classId,
      from: isoDate(start),
      to: isoDate(end),
      schoolDays,
      minimumAttendancePercent: settings.attendance.minimumAttendancePercent,
      students: students.map((s) => {
        const c = per.get(s.id);
        const attended = c.PRESENT + c.LATE;
        const rate = schoolDays ? Math.round((attended / schoolDays) * 1000) / 10 : 0;
        return {
          ...s,
          ...c,
          attended,
          rate,
          belowMinimum: schoolDays > 0 && rate < settings.attendance.minimumAttendancePercent,
        };
      }),
      daily: [...days.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, c]) => ({ date, ...c })),
    };
  }

  studentHistory(studentId: string, from?: string, to?: string) {
    const start = from ? toDateOnly(from) : addDays(startOfToday(), -90);
    const end = to ? toDateOnly(to) : startOfToday();
    return this.prisma.db.attendance.findMany({
      where: { studentId, date: { gte: start, lte: end } },
      orderBy: { date: 'desc' },
      select: { date: true, status: true, note: true, source: true },
    });
  }

  /** School-wide snapshot for a day (used by dashboards). */
  async daily(dateStr?: string) {
    const date = dateStr ? toDateOnly(dateStr) : startOfToday();
    const [classes, marks, activeStudents] = await Promise.all([
      this.prisma.db.schoolClass.findMany({
        select: { id: true, name: true, _count: { select: { students: { where: { status: 'ACTIVE' } } } } },
        orderBy: { name: 'asc' },
      }),
      this.prisma.db.attendance.groupBy({ by: ['classId', 'status'], where: { date }, _count: { _all: true } }),
      this.prisma.db.student.count({ where: { status: 'ACTIVE' } }),
    ]);
    const totals = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0, SICK: 0 };
    const byClass = classes.map((c) => {
      const counts = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0, SICK: 0 };
      for (const m of marks.filter((x) => x.classId === c.id)) {
        counts[m.status] = m._count._all;
        totals[m.status] += m._count._all;
      }
      const marked = Object.values(counts).reduce((a, b) => a + b, 0);
      return { classId: c.id, name: c.name, enrolled: c._count.students, marked, ...counts };
    });
    const marked = Object.values(totals).reduce((a, b) => a + b, 0);
    return {
      date: isoDate(date),
      enrolled: activeStudents,
      marked,
      unmarked: Math.max(activeStudents - marked, 0),
      ...totals,
      rate: marked ? Math.round(((totals.PRESENT + totals.LATE) / marked) * 1000) / 10 : 0,
      classes: byClass,
    };
  }
}
