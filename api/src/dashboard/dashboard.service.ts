import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantCacheService } from '../tenants/tenant-cache.service';
import { AttendanceService } from '../attendance/attendance.service';
import { FeesService } from '../fees/fees.service';
import { CanteenService } from '../canteen/canteen.service';
import { CanteenPlansService } from '../canteen/plans.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { ctx, tid } from '../common/context/request-context';
import { addDays, isoDate, startOfToday, zero } from '../common/utils';

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Aggregated payloads for the six role dashboards. Each method returns everything its screen needs in one call. */
@Injectable()
export class DashboardService {
  constructor(
    private prisma: PrismaService,
    private tenants: TenantCacheService,
    private attendance: AttendanceService,
    private fees: FeesService,
    private canteenSvc: CanteenService,
    private plans: CanteenPlansService,
    private analytics: AnalyticsService,
  ) {}

  private async term() {
    const db = this.prisma.db;
    return (
      (await db.term.findFirst({ where: { isCurrent: true }, include: { academicYear: true } })) ??
      db.term.findFirst({ orderBy: { startDate: 'desc' }, include: { academicYear: true } })
    );
  }
  private termProgress(t: any) {
    if (!t) return null;
    const total = t.endDate.getTime() - t.startDate.getTime();
    const done = Math.min(Math.max(Date.now() - t.startDate.getTime(), 0), total);
    return {
      percent: total > 0 ? Math.round((done / total) * 100) : 0,
      daysLeft: Math.max(0, Math.ceil((t.endDate.getTime() - Date.now()) / 86400000)),
      weeksTotal: Math.round(total / (7 * 86400000)),
    };
  }

  // ─────────────────────────── School admin ───────────────────────────
  async school() {
    const db = this.prisma.db;
    const snap = await this.tenants.get(tid());
    const term = await this.term();
    const hasFees = snap.features.includes('FEES'),
      hasAtt = snap.features.includes('ATTENDANCE'),
      hasCanteen = snap.features.includes('CANTEEN');
    const [
      students,
      staff,
      classes,
      parents,
      byGender,
      attendanceToday,
      feeSummary,
      pendingResults,
      devices,
      conflicts,
      admissions,
      announcements,
      recentAudit,
      newThisTerm,
      unassigned,
      atRisk,
      birthdays,
      enrollment,
      feesAnalytics,
      recentPayments,
      recentStudents,
      activeUsers,
    ] = await Promise.all([
      db.student.count({ where: { status: 'ACTIVE' } }),
      db.staff.count({ where: { status: 'ACTIVE' } }),
      db.schoolClass.count(),
      db.guardian.count(),
      db.student.groupBy({ by: ['gender'], where: { status: 'ACTIVE' }, _count: { _all: true } }),
      hasAtt ? this.attendance.daily() : null,
      hasFees ? this.fees.summary(term?.id) : null,
      term ? db.resultSheet.groupBy({ by: ['status'], where: { termId: term.id }, _count: { _all: true } }) : [],
      db.device.findMany({ where: { isActive: true }, select: { pendingCount: true, lastSeenAt: true } }),
      db.syncConflict.count({ where: { status: 'OPEN' } }),
      db.admission.count({ where: { status: { in: ['SUBMITTED', 'UNDER_REVIEW', 'INTERVIEW', 'ASSESSMENT'] } } }),
      db.announcement.findMany({
        where: { publishedAt: { not: null } },
        orderBy: { publishedAt: 'desc' },
        take: 5,
        select: { id: true, title: true, publishedAt: true, audienceType: true, recipients: true },
      }),
      db.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, action: true, entity: true, actorName: true, createdAt: true },
      }),
      term ? db.student.count({ where: { admissionDate: { gte: term.startDate } } }) : 0,
      db.student.count({ where: { status: 'ACTIVE', classId: null } }),
      hasAtt
        ? this.analytics
            .attendance(term?.id)
            .then((a) => a.atRisk.slice(0, 5))
            .catch(() => [])
        : [],
      this.analytics.birthdays(7).catch(() => []),
      this.analytics.enrollment().catch(() => null),
      hasFees ? this.analytics.fees(term?.id).catch(() => null) : null,
      hasFees
        ? db.payment.findMany({
            where: { status: 'SUCCESS' },
            orderBy: { paidAt: 'desc' },
            take: 6,
            include: { student: { select: { firstName: true, lastName: true } } },
          })
        : [],
      db.student.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          studentId: true,
          createdAt: true,
          class: { select: { name: true } },
        },
      }),
      db.auditLog.findMany({
        where: { action: 'AUTH_LOGIN', createdAt: { gte: addDays(new Date(), -1) } },
        distinct: ['actorId'],
        select: { actorId: true },
      }),
    ]);
    const weekly = hasAtt ? await this.attendanceTrend(14) : [];
    const canteen = hasCanteen ? await this.canteenSvc.summary().catch(() => null) : null;
    const plansSummary = hasCanteen ? await this.plans.summary().catch(() => null) : null;
    return {
      school: {
        name: snap.name,
        code: snap.code,
        plan: snap.planName,
        subscriptionStatus: snap.subscriptionStatus,
        studentLimit: snap.studentLimit,
        trialEndsAt: snap.trialEndsAt,
        currentPeriodEnd: snap.currentPeriodEnd,
        currency: snap.currency,
      },
      term: term
        ? {
            id: term.id,
            name: term.name,
            year: term.academicYear.name,
            startDate: term.startDate,
            endDate: term.endDate,
            progress: this.termProgress(term),
          }
        : null,
      counts: {
        students,
        staff,
        classes,
        parents,
        byGender: Object.fromEntries(byGender.map((g) => [g.gender, g._count._all])),
        pendingAdmissions: admissions,
        newThisTerm,
        unassigned,
        activeUsers24h: activeUsers.length,
        boarding: enrollment?.totals.boarding ?? 0,
      },
      attendanceToday,
      attendanceTrend: weekly,
      atRisk,
      birthdays,
      enrollment: enrollment
        ? {
            byClass: enrollment.byClass,
            byLevel: enrollment.byLevel,
            admittedByMonth: enrollment.admittedByMonth.slice(-6),
            capacity: enrollment.capacity,
          }
        : null,
      fees: feeSummary
        ? {
            invoiced: feeSummary.invoiced,
            collected: feeSummary.collected,
            outstanding: feeSummary.outstanding,
            collectionRate: feeSummary.collectionRate,
            today: feeSummary.today,
            overdueCount: feeSummary.overdueCount,
            byClass: feeSummary.byClass,
            byMonth: feesAnalytics?.byMonth.slice(-6) ?? [],
            aging: feesAnalytics?.aging ?? null,
          }
        : null,
      results: Object.fromEntries(pendingResults.map((r) => [r.status, r._count._all])),
      sync: {
        devices: devices.length,
        pendingOperations: devices.reduce((a, d) => a + d.pendingCount, 0),
        offlineDevices: devices.filter((d) => d.lastSeenAt < addDays(new Date(), -1)).length,
        openConflicts: conflicts,
      },
      canteen: canteen
        ? {
            revenueToday: canteen.revenue,
            salesToday: canteen.salesCount,
            lowStock: canteen.lowStock.length,
            mealsServed: canteen.mealsServed,
            walletsTotal: canteen.wallets.totalBalance,
            plans: plansSummary?.plans ?? [],
          }
        : null,
      announcements,
      recentAudit,
      recentPayments,
      recentStudents,
    };
  }

  private async attendanceTrend(days: number) {
    const from = addDays(startOfToday(), -(days - 1));
    const rows = await this.prisma.db.attendance.groupBy({
      by: ['date', 'status'],
      where: { date: { gte: from } },
      _count: { _all: true },
    });
    const map = new Map<string, any>();
    for (const r of rows) {
      const d = isoDate(r.date);
      if (!map.has(d)) map.set(d, { date: d, PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0, SICK: 0 });
      map.get(d)[r.status] += r._count._all;
    }
    return [...map.values()]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((d) => {
        const t = d.PRESENT + d.LATE + d.ABSENT + d.EXCUSED + d.SICK;
        return { ...d, marked: t, rate: t ? Math.round(((d.PRESENT + d.LATE) / t) * 100) : 0 };
      });
  }

  // ─────────────────────────── Teacher ───────────────────────────
  async teacher() {
    const c = ctx();
    const db = this.prisma.db;
    const today = startOfToday();
    const dow = new Date().getDay() || 7;
    const term = await this.term();
    const settings = await this.tenants.settings(tid());
    const [classTeacherOf, teaching, slots, weekSlots, notifications] = await Promise.all([
      c.staffId
        ? db.schoolClass.findMany({
            where: { classTeacherId: c.staffId },
            include: { _count: { select: { students: { where: { status: 'ACTIVE' } } } } },
          })
        : [],
      c.staffId
        ? db.classSubject.findMany({
            where: { teacherId: c.staffId },
            include: { class: { select: { id: true, name: true } }, subject: { select: { id: true, name: true } } },
          })
        : [],
      c.staffId
        ? db.timetableSlot.findMany({
            where: { teacherId: c.staffId, dayOfWeek: dow },
            include: {
              class: { select: { name: true } },
              subject: { select: { name: true } },
              period: true,
              room: { select: { name: true } },
            },
            orderBy: { period: { sequence: 'asc' } },
          })
        : [],
      c.staffId
        ? db.timetableSlot.findMany({
            where: { teacherId: c.staffId },
            include: {
              class: { select: { name: true } },
              subject: { select: { name: true } },
              period: { select: { name: true, sequence: true, startTime: true } },
            },
          })
        : [],
      db.notification.count({ where: { userId: c.userId, readAt: null } }),
    ]);
    const classIds = [...new Set([...classTeacherOf.map((k) => k.id), ...teaching.map((t) => t.classId)])];
    const [marked, weekMarks, assessments, sheets, students] = await Promise.all([
      classIds.length
        ? db.attendance.groupBy({
            by: ['classId'],
            where: { classId: { in: classIds }, date: today },
            _count: { _all: true },
          })
        : [],
      classTeacherOf.length
        ? db.attendance.findMany({
            where: { classId: { in: classTeacherOf.map((k) => k.id) }, date: { gte: addDays(today, -13) } },
            select: { classId: true, studentId: true, status: true, date: true },
          })
        : [],
      term && classIds.length
        ? db.assessment.findMany({
            where: {
              termId: term.id,
              classId: { in: classIds },
              OR: [{ createdById: c.userId }, { subject: { classes: { some: { teacherId: c.staffId ?? '-' } } } }],
            },
            include: { _count: { select: { marks: true } }, subject: { select: { name: true } } },
          })
        : [],
      term && classTeacherOf.length
        ? db.resultSheet.groupBy({
            by: ['classId', 'status'],
            where: { termId: term.id, classId: { in: classTeacherOf.map((k) => k.id) } },
            _count: { _all: true },
          })
        : [],
      classTeacherOf.length
        ? db.student.findMany({
            where: { classId: { in: classTeacherOf.map((k) => k.id) }, status: 'ACTIVE' },
            select: { id: true, firstName: true, lastName: true, classId: true, dateOfBirth: true },
          })
        : [],
    ]);
    const classCounts = new Map(classIds.map((id) => [id, students.filter((s) => s.classId === id).length]));
    const attendanceRate = (classId: string) => {
      const m = weekMarks.filter((x) => x.classId === classId);
      const p = m.filter((x) => x.status === 'PRESENT' || x.status === 'LATE').length;
      return m.length ? Math.round((p / m.length) * 100) : null;
    };
    const perStudent = new Map<string, { marked: number; present: number; absent: number }>();
    for (const m of weekMarks) {
      const p = perStudent.get(m.studentId) ?? { marked: 0, present: 0, absent: 0 };
      p.marked++;
      if (m.status === 'PRESENT' || m.status === 'LATE') p.present++;
      if (m.status === 'ABSENT') p.absent++;
      perStudent.set(m.studentId, p);
    }
    const atRisk = students
      .map((s) => {
        const p = perStudent.get(s.id);
        if (!p || p.marked < 3) return null;
        const rate = Math.round((p.present / p.marked) * 100);
        return rate < settings.attendance.minimumAttendancePercent
          ? {
              id: s.id,
              name: `${s.firstName} ${s.lastName}`,
              rate,
              absences: p.absent,
              className: classTeacherOf.find((k) => k.id === s.classId)?.name,
            }
          : null;
      })
      .filter(Boolean)
      .sort((a: any, b: any) => a.rate - b.rate)
      .slice(0, 8);
    const subjectProgress = teaching.map((t) => {
      const as = assessments.filter((a) => a.classId === t.classId && a.subject.name === t.subject.name);
      const total = classCounts.get(t.classId) ?? 0;
      return {
        classId: t.classId,
        className: t.class.name,
        subject: t.subject.name,
        assessments: as.length,
        hasExam: as.some((a) => a.type === 'EXAM'),
        completeness:
          as.length && total ? Math.round((as.reduce((x, a) => x + a._count.marks, 0) / (as.length * total)) * 100) : 0,
      };
    });
    const weekly = [1, 2, 3, 4, 5].map((d) => ({
      day: d,
      lessons: weekSlots
        .filter((s) => s.dayOfWeek === d)
        .sort((a, b) => a.period.sequence - b.period.sequence)
        .map((s) => ({
          period: s.period.name,
          time: s.period.startTime,
          subject: s.subject.name,
          class: s.class.name,
        })),
    }));
    const dailyTrend = await this.attendanceTrendFor(
      classTeacherOf.map((k) => k.id),
      10,
    );
    return {
      term: term ? { id: term.id, name: term.name, progress: this.termProgress(term) } : null,
      classTeacherOf: classTeacherOf.map((k) => ({
        id: k.id,
        name: k.name,
        level: k.level,
        students: k._count.students,
        attendanceMarkedToday: (marked.find((m) => m.classId === k.id)?._count._all ?? 0) > 0,
        rate14d: attendanceRate(k.id),
        resultsByStatus: Object.fromEntries(
          sheets.filter((s) => s.classId === k.id).map((s) => [s.status, s._count._all]),
        ),
      })),
      teaching: teaching.map((t) => ({
        classId: t.classId,
        className: t.class.name,
        subjectId: t.subjectId,
        subjectName: t.subject.name,
        attendanceMarkedToday: (marked.find((m) => m.classId === t.classId)?._count._all ?? 0) > 0,
      })),
      today: slots.map((s) => ({
        period: s.period.name,
        time: `${s.period.startTime}–${s.period.endTime}`,
        class: s.class.name,
        subject: s.subject.name,
        room: s.room?.name ?? null,
        current: (() => {
          const now = new Date();
          const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
          return hhmm >= s.period.startTime && hhmm <= s.period.endTime;
        })(),
      })),
      week: weekly,
      assessments: assessments.map((a) => ({
        id: a.id,
        name: a.name,
        subject: a.subject.name,
        classId: a.classId,
        className:
          teaching.find((t) => t.classId === a.classId)?.class.name ??
          classTeacherOf.find((k) => k.id === a.classId)?.name,
        marksEntered: a._count.marks,
        students: classCounts.get(a.classId) ?? 0,
        type: a.type,
      })),
      subjectProgress,
      atRisk,
      attendanceTrend: dailyTrend,
      unreadNotifications: notifications,
      periodsPerWeek: weekSlots.length,
    };
  }

  private async attendanceTrendFor(classIds: string[], days: number) {
    if (!classIds.length) return [];
    const from = addDays(startOfToday(), -(days - 1));
    const rows = await this.prisma.db.attendance.groupBy({
      by: ['date', 'status'],
      where: { classId: { in: classIds }, date: { gte: from } },
      _count: { _all: true },
    });
    const map = new Map<string, { date: string; present: number; marked: number }>();
    for (const r of rows) {
      const d = isoDate(r.date);
      const x = map.get(d) ?? { date: d, present: 0, marked: 0 };
      x.marked += r._count._all;
      if (r.status === 'PRESENT' || r.status === 'LATE') x.present += r._count._all;
      map.set(d, x);
    }
    return [...map.values()]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((x) => ({ ...x, rate: x.marked ? Math.round((x.present / x.marked) * 100) : 0 }));
  }

  // ─────────────────────────── Finance ───────────────────────────
  async finance() {
    const term = await this.term();
    const [summary, analytics, recent, topDebtors, cashiers, byCategory] = await Promise.all([
      this.fees.summary(term?.id),
      this.analytics.fees(term?.id),
      this.prisma.db.payment.findMany({
        where: { status: 'SUCCESS' },
        orderBy: { paidAt: 'desc' },
        take: 10,
        include: { student: { select: { id: true, firstName: true, lastName: true, studentId: true } } },
      }),
      this.prisma.db.studentAccount.findMany({
        where: { balance: { gt: 0 } },
        orderBy: { balance: 'desc' },
        take: 10,
        include: {
          student: {
            select: {
              id: true,
              studentId: true,
              firstName: true,
              lastName: true,
              class: { select: { name: true } },
              guardians: {
                where: { isPrimary: true },
                include: { guardian: { select: { phone: true, firstName: true, lastName: true } } },
              },
            },
          },
        },
      }),
      this.prisma.db.payment.groupBy({
        by: ['recordedById', 'method'],
        where: { status: 'SUCCESS', paidAt: { gte: startOfToday() } },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      term
        ? this.prisma.db.invoiceLine.groupBy({
            by: ['categoryId'],
            where: { invoice: { termId: term.id, status: { not: 'CANCELLED' } } },
            _sum: { amount: true, discount: true },
          })
        : [],
    ]);
    const userIds = [...new Set(cashiers.map((c) => c.recordedById).filter(Boolean))] as string[];
    const users = userIds.length
      ? await this.prisma.db.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, firstName: true, lastName: true },
        })
      : [];
    const cats = byCategory.length
      ? await this.prisma.db.feeCategory.findMany({
          where: { id: { in: byCategory.map((c) => c.categoryId) } },
          select: { id: true, name: true },
        })
      : [];
    const trend = await this.prisma.db.payment.findMany({
      where: { status: 'SUCCESS', paidAt: { gte: addDays(startOfToday(), -29) } },
      select: { paidAt: true, amount: true },
    });
    const daily = new Map<string, number>();
    for (const p of trend) {
      const d = isoDate(p.paidAt);
      daily.set(d, (daily.get(d) ?? 0) + Number(p.amount));
    }
    return {
      ...summary,
      term: term ? { id: term.id, name: term.name, progress: this.termProgress(term) } : null,
      aging: analytics.aging,
      installments: analytics.installments,
      byMonth: analytics.byMonth,
      totals: analytics.totals,
      recentPayments: recent,
      trend: [...daily.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, amount]) => ({ date, amount })),
      topDebtors: topDebtors.map((a) => ({
        ...a,
        guardian: a.student.guardians[0]?.guardian ?? null,
        student: { ...a.student, guardians: undefined },
      })),
      cashiersToday: cashiers.map((c) => ({
        cashier: users.find((u) => u.id === c.recordedById)
          ? `${users.find((u) => u.id === c.recordedById)!.firstName} ${users.find((u) => u.id === c.recordedById)!.lastName}`
          : 'Online / system',
        method: c.method,
        amount: c._sum.amount ?? 0,
        count: c._count._all,
      })),
      byCategory: byCategory.map((c) => ({
        category: cats.find((x) => x.id === c.categoryId)?.name ?? '—',
        invoiced: c._sum.amount ?? 0,
        discount: c._sum.discount ?? 0,
      })),
    };
  }

  // ─────────────────────────── Canteen ───────────────────────────
  async canteen() {
    const [summary, plans, analytics] = await Promise.all([
      this.canteenSvc.summary(),
      this.plans.summary(),
      this.analytics.canteen(14),
    ]);
    return { ...summary, plans, analytics };
  }
}
