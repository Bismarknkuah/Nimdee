import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { TenantCacheService } from '../tenants/tenant-cache.service';
import { StudentsService } from '../students/students.service';
import { ProvidersService } from '../communications/providers.service';
import { templates } from '../communications/templates';
import { ctx, tid } from '../common/context/request-context';
import { addDays, isoDate, startOfToday, toDateOnly, toJson } from '../common/utils';
import { ATTENDANCE_STATUSES, AttendanceRecordDto, MarkAttendanceDto, MarkLessonAttendanceDto } from './dto';

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

  /** Today's day of school-week in this app's convention (1 = Monday ... 7 = Sunday), unlike
   *  JavaScript's own Date#getDay (0 = Sunday ... 6 = Saturday). */
  private todayDayOfWeek(): number {
    const d = new Date().getDay();
    return d === 0 ? 7 : d;
  }

  /** Every lesson scheduled today for the current teacher, with whether it's already been marked —
   *  "any teacher who comes in to teach has to take attendance for their lesson" in practice: this is
   *  the list they work through, one lesson at a time, as the school day goes on. */
  async myLessonsToday() {
    const c = ctx();
    if (!c.staffId) throw new BadRequestException('No staff profile linked to your account');
    const dayOfWeek = this.todayDayOfWeek();
    const today = isoDate(startOfToday());
    const slots = await this.prisma.db.timetableSlot.findMany({
      where: { teacherId: c.staffId, dayOfWeek },
      orderBy: { period: { sequence: 'asc' } },
      include: {
        class: { select: { id: true, name: true, level: true } },
        subject: { select: { id: true, name: true } },
        period: { select: { id: true, name: true, startTime: true, endTime: true } },
      },
    });
    const marks = await this.prisma.db.lessonAttendance.findMany({
      where: { timetableSlotId: { in: slots.map((s) => s.id) }, date: toDateOnly(today) },
      select: { timetableSlotId: true },
    });
    const markedSlotIds = new Set(marks.map((m) => m.timetableSlotId));
    return slots.map((s) => ({
      id: s.id,
      class: s.class,
      subject: s.subject,
      period: s.period,
      marked: markedSlotIds.has(s.id),
    }));
  }

  private async assertLessonAccess(slot: { classId: string; teacherId: string | null }) {
    const c = ctx();
    if (c.permissions?.includes('*') || c.permissions?.includes('ACADEMIC_MANAGE')) return;
    if (c.staffId && slot.teacherId === c.staffId) return;
    if (c.staffId) {
      const isFormMaster = await this.prisma.db.schoolClass.findFirst({
        where: { id: slot.classId, classTeacherId: c.staffId },
        select: { id: true },
      });
      if (isFormMaster) return;
    }
    throw new ForbiddenException('You are not the teacher for this lesson');
  }

  /** The class roster for one specific lesson, with any attendance already marked for it today. */
  async lessonRoster(timetableSlotId: string, date: string) {
    const slot = await this.prisma.db.timetableSlot.findUnique({
      where: { id: timetableSlotId },
      include: {
        class: { select: { id: true, name: true, level: true } },
        subject: { select: { id: true, name: true } },
        period: { select: { name: true, startTime: true, endTime: true } },
      },
    });
    if (!slot) throw new NotFoundException('Lesson not found');
    await this.assertLessonAccess(slot);
    const [students, marks] = await Promise.all([
      this.prisma.db.student.findMany({
        where: { classId: slot.classId, status: 'ACTIVE' },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        select: { id: true, studentId: true, firstName: true, lastName: true, photoUrl: true },
      }),
      this.prisma.db.lessonAttendance.findMany({
        where: { timetableSlotId, date: toDateOnly(date) },
        select: { studentId: true, status: true, note: true },
      }),
    ]);
    const byStudent = new Map(marks.map((m) => [m.studentId, m]));
    return {
      slot: { id: slot.id, class: slot.class, subject: slot.subject, period: slot.period },
      students: students.map((s) => ({
        ...s,
        status: byStudent.get(s.id)?.status ?? null,
        note: byStudent.get(s.id)?.note ?? null,
      })),
    };
  }

  /** Marks (or re-marks) attendance for one specific lesson. Kept separate from the daily homeroom
   *  Attendance table entirely — a student can be PRESENT for the day but marked ABSENT from one
   *  specific lesson, and the two are tracked independently on purpose. */
  async markLesson(dto: MarkLessonAttendanceDto) {
    const slot = await this.prisma.db.timetableSlot.findUnique({ where: { id: dto.timetableSlotId } });
    if (!slot) throw new NotFoundException('Lesson not found');
    await this.assertLessonAccess(slot);
    const validIds = new Set(
      (
        await this.prisma.db.student.findMany({
          where: { classId: slot.classId, status: 'ACTIVE' },
          select: { id: true },
        })
      ).map((s) => s.id),
    );
    const markedById = ctx().userId;
    let applied = 0;
    const invalid: string[] = [];
    for (const r of dto.records) {
      if (!validIds.has(r.studentId)) {
        invalid.push(r.studentId);
        continue;
      }
      await this.prisma.db.lessonAttendance.upsert({
        where: {
          tenantId_studentId_timetableSlotId_date: {
            tenantId: tid(),
            studentId: r.studentId,
            timetableSlotId: dto.timetableSlotId,
            date: toDateOnly(dto.date),
          },
        },
        create: {
          tenantId: tid(),
          studentId: r.studentId,
          timetableSlotId: dto.timetableSlotId,
          date: toDateOnly(dto.date),
          status: r.status,
          note: r.note,
          markedById,
        },
        update: { status: r.status, note: r.note, markedById },
      });
      applied++;
    }
    await this.audit.log({
      action: 'LESSON_ATTENDANCE_MARKED',
      entity: 'TimetableSlot',
      entityId: dto.timetableSlotId,
      after: { date: dto.date, applied, invalid },
    });
    return { applied, invalid };
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

  /** Headmaster-facing oversight: every lesson scheduled today across the whole school, and whether
   *  the teacher actually took attendance for it — "any teacher who comes in to teach has to take
   *  attendance for their lesson" is only meaningful if someone can see who didn't. */
  async lessonCompletionToday() {
    const dayOfWeek = this.todayDayOfWeek();
    const today = startOfToday();
    const slots = await this.prisma.db.timetableSlot.findMany({
      where: { dayOfWeek },
      orderBy: [{ period: { sequence: 'asc' } }, { class: { name: 'asc' } }],
      include: {
        class: { select: { id: true, name: true, level: true } },
        subject: { select: { id: true, name: true } },
        teacher: { select: { id: true, firstName: true, lastName: true } },
        period: { select: { name: true, startTime: true, endTime: true } },
      },
    });
    const marks = await this.prisma.db.lessonAttendance.findMany({
      where: { timetableSlotId: { in: slots.map((s) => s.id) }, date: today },
      select: { timetableSlotId: true },
      distinct: ['timetableSlotId'],
    });
    const markedSlotIds = new Set(marks.map((m) => m.timetableSlotId));
    const lessons = slots.map((s) => ({
      id: s.id,
      class: s.class,
      subject: s.subject,
      teacher: s.teacher,
      period: s.period,
      marked: markedSlotIds.has(s.id),
    }));
    return {
      date: isoDate(today),
      totalLessons: lessons.length,
      taken: lessons.filter((l) => l.marked).length,
      pending: lessons.filter((l) => !l.marked),
      lessons,
    };
  }
}
