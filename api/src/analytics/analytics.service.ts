import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantCacheService } from '../tenants/tenant-cache.service';
import { tid } from '../common/context/request-context';
import { addDays, isoDate, startOfToday, zero } from '../common/utils';

const monthKey = (d: Date) => d.toISOString().slice(0, 7);
const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Read-only analytics that power the dashboards and reports. Every query is tenant-scoped.
 * Results are shaped for charts (arrays of {label, value}) so the frontend needs no post-processing.
 */
@Injectable()
export class AnalyticsService {
  constructor(
    private prisma: PrismaService,
    private tenants: TenantCacheService,
  ) {}

  private async currentTerm(termId?: string) {
    const db = this.prisma.db;
    return termId
      ? db.term.findUnique({ where: { id: termId } })
      : ((await db.term.findFirst({ where: { isCurrent: true } })) ??
          db.term.findFirst({ orderBy: { startDate: 'desc' } }));
  }

  // ─────────────────────────── Enrolment ───────────────────────────
  async enrollment() {
    const db = this.prisma.db;
    const [students, classes, byStatus] = await Promise.all([
      db.student.findMany({
        select: { classId: true, gender: true, status: true, isBoarding: true, admissionDate: true, dateOfBirth: true },
      }),
      db.schoolClass.findMany({
        select: { id: true, name: true, level: true, capacity: true },
        orderBy: [{ level: 'asc' }, { name: 'asc' }],
      }),
      db.student.groupBy({ by: ['status'], _count: { _all: true } }),
    ]);
    const active = students.filter((s) => s.status === 'ACTIVE');
    const byClass = classes.map((c) => {
      const inClass = active.filter((s) => s.classId === c.id);
      return {
        classId: c.id,
        name: c.name,
        level: c.level,
        boys: inClass.filter((s) => s.gender === 'MALE').length,
        girls: inClass.filter((s) => s.gender === 'FEMALE').length,
        total: inClass.length,
        capacity: c.capacity,
        boarding: inClass.filter((s) => s.isBoarding).length,
      };
    });
    const byLevel = Object.values(
      byClass.reduce((a: any, c) => {
        a[c.level] = a[c.level] ?? { level: c.level, total: 0, boys: 0, girls: 0 };
        a[c.level].total += c.total;
        a[c.level].boys += c.boys;
        a[c.level].girls += c.girls;
        return a;
      }, {}),
    );
    const months = Array.from({ length: 12 }, (_, i) => {
      const d = new Date();
      d.setUTCMonth(d.getUTCMonth() - (11 - i), 1);
      return monthKey(d);
    });
    const admittedByMonth = months.map((m) => ({
      month: m,
      admitted: students.filter((s) => monthKey(s.admissionDate) === m).length,
    }));
    const ages = active.map((s) => Math.floor((Date.now() - new Date(s.dateOfBirth).getTime()) / (365.25 * 86400000)));
    const ageBands = Object.entries(
      ages.reduce((a: any, age) => {
        const band = age < 6 ? 'Under 6' : age < 10 ? '6–9' : age < 13 ? '10–12' : age < 16 ? '13–15' : '16+';
        a[band] = (a[band] ?? 0) + 1;
        return a;
      }, {}),
    ).map(([band, count]) => ({ band, count }));
    return {
      totals: {
        active: active.length,
        boys: active.filter((s) => s.gender === 'MALE').length,
        girls: active.filter((s) => s.gender === 'FEMALE').length,
        boarding: active.filter((s) => s.isBoarding).length,
        day: active.filter((s) => !s.isBoarding).length,
        unassigned: active.filter((s) => !s.classId).length,
      },
      byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count._all])),
      byClass,
      byLevel,
      admittedByMonth,
      ageBands,
      capacity: {
        seats: classes.reduce((a, c) => a + (c.capacity ?? 0), 0),
        used: active.filter((s) => s.classId).length,
      },
    };
  }

  // ─────────────────────────── Attendance ───────────────────────────
  async attendance(termId?: string) {
    const db = this.prisma.db;
    const term = await this.currentTerm(termId);
    const settings = await this.tenants.settings(tid());
    if (!term) return { term: null, byClass: [], weekly: [], byDayOfWeek: [], atRisk: [], overall: null };
    const from = term.startDate,
      to = new Date(Math.min(term.endDate.getTime(), Date.now()));
    const [marks, classes, students] = await Promise.all([
      db.attendance.findMany({
        where: { date: { gte: from, lte: to } },
        select: { studentId: true, classId: true, status: true, date: true },
      }),
      db.schoolClass.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
      db.student.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, studentId: true, firstName: true, lastName: true, classId: true },
      }),
    ]);
    const present = (s: string) => s === 'PRESENT' || s === 'LATE';
    const byClass = classes
      .map((c) => {
        const m = marks.filter((x) => x.classId === c.id);
        const p = m.filter((x) => present(x.status)).length;
        return {
          classId: c.id,
          name: c.name,
          marked: m.length,
          present: p,
          absent: m.filter((x) => x.status === 'ABSENT').length,
          late: m.filter((x) => x.status === 'LATE').length,
          excused: m.filter((x) => x.status === 'EXCUSED' || x.status === 'SICK').length,
          rate: m.length ? round1((p / m.length) * 100) : null,
          days: new Set(m.map((x) => isoDate(x.date))).size,
        };
      })
      .filter((c) => c.marked > 0);
    const weeks = new Map<string, { marked: number; present: number }>();
    const dow = Array.from({ length: 7 }, () => ({ marked: 0, present: 0 }));
    for (const m of marks) {
      const d = new Date(m.date);
      const week = new Date(d);
      week.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
      const k = isoDate(week);
      const w = weeks.get(k) ?? { marked: 0, present: 0 };
      w.marked++;
      if (present(m.status)) w.present++;
      weeks.set(k, w);
      dow[d.getUTCDay()].marked++;
      if (present(m.status)) dow[d.getUTCDay()].present++;
    }
    const perStudent = new Map<string, { marked: number; present: number; absent: number }>();
    for (const m of marks) {
      const p = perStudent.get(m.studentId) ?? { marked: 0, present: 0, absent: 0 };
      p.marked++;
      if (present(m.status)) p.present++;
      if (m.status === 'ABSENT') p.absent++;
      perStudent.set(m.studentId, p);
    }
    const atRisk = students
      .map((s) => {
        const p = perStudent.get(s.id);
        return p && p.marked >= 3
          ? {
              id: s.id,
              studentId: s.studentId,
              name: `${s.firstName} ${s.lastName}`,
              className: classes.find((c) => c.id === s.classId)?.name,
              rate: round1((p.present / p.marked) * 100),
              absences: p.absent,
              days: p.marked,
            }
          : null;
      })
      .filter((x): x is any => !!x && x.rate < settings.attendance.minimumAttendancePercent)
      .sort((a, b) => a.rate - b.rate)
      .slice(0, 25);
    const totalMarked = marks.length,
      totalPresent = marks.filter((x) => present(x.status)).length;
    return {
      term: { id: term.id, name: term.name, startDate: term.startDate, endDate: term.endDate },
      minimum: settings.attendance.minimumAttendancePercent,
      overall: {
        marked: totalMarked,
        present: totalPresent,
        rate: totalMarked ? round1((totalPresent / totalMarked) * 100) : null,
        schoolDays: new Set(marks.map((x) => isoDate(x.date))).size,
      },
      byClass,
      weekly: [...weeks.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([week, w]) => ({ week, rate: round1((w.present / w.marked) * 100), marked: w.marked })),
      byDayOfWeek: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
        .map((d, i) => ({ day: d, rate: dow[i].marked ? round1((dow[i].present / dow[i].marked) * 100) : null }))
        .filter((d) => d.rate !== null),
      atRisk,
    };
  }

  // ─────────────────────────── Fees ───────────────────────────
  async fees(termId?: string) {
    const db = this.prisma.db;
    const term = await this.currentTerm(termId);
    const now = new Date();
    const [invoices, payments12, installments, discounts] = await Promise.all([
      db.invoice.findMany({
        where: { ...(term ? { termId: term.id } : {}), status: { not: 'CANCELLED' } },
        select: {
          total: true,
          paidTotal: true,
          discountTotal: true,
          status: true,
          dueDate: true,
          student: { select: { classId: true, class: { select: { name: true } } } },
        },
      }),
      db.payment.findMany({
        where: {
          status: 'SUCCESS',
          purpose: 'FEES',
          paidAt: { gte: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1)) },
        },
        select: { paidAt: true, amount: true, method: true },
      }),
      db.installment.findMany({
        where: {
          status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] },
          invoice: { status: { not: 'CANCELLED' }, ...(term ? { termId: term.id } : {}) },
        },
        select: { amount: true, paidAmount: true, dueDate: true, status: true },
      }),
      db.studentDiscount.count(),
    ]);
    const aging = { current: zero(), d1_30: zero(), d31_60: zero(), d61_90: zero(), d90plus: zero() };
    for (const i of invoices) {
      const bal = i.total.minus(i.paidTotal);
      if (bal.lte(0)) continue;
      const days = Math.floor((now.getTime() - i.dueDate.getTime()) / 86400000);
      if (days <= 0) aging.current = aging.current.plus(bal);
      else if (days <= 30) aging.d1_30 = aging.d1_30.plus(bal);
      else if (days <= 60) aging.d31_60 = aging.d31_60.plus(bal);
      else if (days <= 90) aging.d61_90 = aging.d61_90.plus(bal);
      else aging.d90plus = aging.d90plus.plus(bal);
    }
    const months = Array.from({ length: 12 }, (_, i) => {
      const d = new Date();
      d.setUTCMonth(d.getUTCMonth() - (11 - i), 1);
      return monthKey(d);
    });
    const byMonth = months.map((m) => ({
      month: m,
      collected: payments12.filter((p) => monthKey(p.paidAt) === m).reduce((a, p) => a + Number(p.amount), 0),
    }));
    const byMethod = Object.entries(
      payments12.reduce((a: any, p) => {
        a[p.method] = (a[p.method] ?? 0) + Number(p.amount);
        return a;
      }, {}),
    ).map(([method, amount]) => ({ method, amount }));
    const byClassMap = new Map<string, any>();
    for (const i of invoices) {
      const k = i.student.classId ?? 'none';
      const c = byClassMap.get(k) ?? {
        name: i.student.class?.name ?? 'Unassigned',
        invoiced: zero(),
        collected: zero(),
        students: 0,
        paid: 0,
      };
      c.invoiced = c.invoiced.plus(i.total);
      c.collected = c.collected.plus(i.paidTotal);
      c.students++;
      if (i.status === 'PAID') c.paid++;
      byClassMap.set(k, c);
    }
    const due30 = installments.filter((x) => x.dueDate >= now && x.dueDate <= addDays(now, 30));
    const invoiced = invoices.reduce((a, i) => a.plus(i.total), zero()),
      collected = invoices.reduce((a, i) => a.plus(i.paidTotal), zero());
    return {
      term: term ? { id: term.id, name: term.name } : null,
      totals: {
        invoiced,
        collected,
        outstanding: invoiced.minus(collected),
        discounts: invoices.reduce((a, i) => a.plus(i.discountTotal), zero()),
        discountCount: discounts,
        invoices: invoices.length,
        fullyPaid: invoices.filter((i) => i.status === 'PAID').length,
        collectionRate: invoiced.gt(0) ? Number(collected.div(invoiced).mul(100).toFixed(1)) : 0,
      },
      aging: Object.fromEntries(Object.entries(aging).map(([k, v]) => [k, Number(v)])),
      byMonth,
      byMethod,
      byClass: [...byClassMap.values()]
        .map((c) => ({
          ...c,
          outstanding: c.invoiced.minus(c.collected),
          rate: c.invoiced.gt(0) ? Number(c.collected.div(c.invoiced).mul(100).toFixed(1)) : 0,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      installments: {
        dueNext30Days: {
          count: due30.length,
          amount: due30.reduce((a, x) => a.plus(x.amount.minus(x.paidAmount)), zero()),
        },
        overdue: {
          count: installments.filter((x) => x.dueDate < now).length,
          amount: installments
            .filter((x) => x.dueDate < now)
            .reduce((a, x) => a.plus(x.amount.minus(x.paidAmount)), zero()),
        },
      },
      byStatus: Object.fromEntries(
        Object.entries(
          invoices.reduce((a: any, i) => {
            a[i.status] = (a[i.status] ?? 0) + 1;
            return a;
          }, {}),
        ),
      ),
    };
  }

  // ─────────────────────────── Results ───────────────────────────
  async results(termId?: string) {
    const db = this.prisma.db;
    const term = await this.currentTerm(termId);
    if (!term) return { term: null, byClass: [], gradeDistribution: [], subjectAverages: [], top: [] };
    const settings = await this.tenants.settings(tid());
    const sheets = await db.resultSheet.findMany({
      where: { termId: term.id },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            studentId: true,
            class: { select: { id: true, name: true } },
          },
        },
      },
    });
    const byClassMap = new Map<string, any>();
    const grades = new Map<string, number>();
    const subjects = new Map<string, { name: string; total: number; count: number; pass: number }>();
    for (const s of sheets) {
      const k = s.student.class?.id ?? 'none';
      const c = byClassMap.get(k) ?? {
        classId: k,
        name: s.student.class?.name ?? '—',
        sheets: 0,
        sum: 0,
        pass: 0,
        published: 0,
        top: null as any,
      };
      c.sheets++;
      c.sum += Number(s.average);
      if (Number(s.average) >= settings.academic.passMark) c.pass++;
      if (s.status === 'PUBLISHED') c.published++;
      if (!c.top || Number(s.average) > c.top.average)
        c.top = { name: `${s.student.firstName} ${s.student.lastName}`, average: Number(s.average) };
      byClassMap.set(k, c);
      if (s.overallGrade) grades.set(s.overallGrade, (grades.get(s.overallGrade) ?? 0) + 1);
      for (const sub of (s.subjects as any[]) ?? []) {
        if (!sub.hasMarks) continue;
        const x = subjects.get(sub.subjectId) ?? { name: sub.name, total: 0, count: 0, pass: 0 };
        x.total += sub.total;
        x.count++;
        if (sub.total >= settings.academic.passMark) x.pass++;
        subjects.set(sub.subjectId, x);
      }
    }
    const order = settings.academic.gradingScheme.map((g: any) => g.grade);
    return {
      term: { id: term.id, name: term.name },
      passMark: settings.academic.passMark,
      byClass: [...byClassMap.values()]
        .map((c) => ({
          classId: c.classId,
          name: c.name,
          sheets: c.sheets,
          published: c.published,
          average: c.sheets ? round1(c.sum / c.sheets) : null,
          passRate: c.sheets ? round1((c.pass / c.sheets) * 100) : null,
          top: c.top,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      gradeDistribution: [...grades.entries()]
        .sort(([a], [b]) => order.indexOf(a) - order.indexOf(b))
        .map(([grade, count]) => ({ grade, count })),
      subjectAverages: [...subjects.values()]
        .map((s) => ({
          subject: s.name,
          average: round1(s.total / s.count),
          passRate: round1((s.pass / s.count) * 100),
          students: s.count,
        }))
        .sort((a, b) => b.average - a.average),
      top: [...sheets]
        .filter((s) => s.position)
        .sort((a, b) => Number(b.average) - Number(a.average))
        .slice(0, 10)
        .map((s) => ({
          id: s.student.id,
          name: `${s.student.firstName} ${s.student.lastName}`,
          className: s.student.class?.name,
          average: Number(s.average),
          grade: s.overallGrade,
          position: s.position,
        })),
    };
  }

  // ─────────────────────────── Canteen ───────────────────────────
  async canteen(days = 30) {
    const db = this.prisma.db;
    const from = addDays(startOfToday(), -(days - 1));
    const [sales, plans, wallets] = await Promise.all([
      db.canteenSale.findMany({
        where: { createdAt: { gte: from } },
        select: {
          createdAt: true,
          total: true,
          coveredAmount: true,
          mealCount: true,
          paymentMode: true,
          items: true,
          studentId: true,
          planId: true,
        },
      }),
      db.canteenPlan.findMany({
        select: {
          id: true,
          name: true,
          type: true,
          _count: { select: { enrolments: { where: { status: 'ACTIVE' } } } },
        },
      }),
      db.wallet.aggregate({ _sum: { balance: true }, _count: { _all: true }, _avg: { balance: true } }),
    ]);
    const byDay = new Map<string, { revenue: number; sales: number; meals: number }>();
    for (const s of sales) {
      const d = isoDate(s.createdAt);
      const x = byDay.get(d) ?? { revenue: 0, sales: 0, meals: 0 };
      x.revenue += Number(s.total);
      x.sales++;
      x.meals += s.mealCount;
      byDay.set(d, x);
    }
    const items = new Map<string, { name: string; quantity: number; revenue: number }>();
    for (const s of sales)
      for (const l of (s.items as any[]) ?? []) {
        const x = items.get(l.itemId) ?? { name: l.name, quantity: 0, revenue: 0 };
        x.quantity += l.quantity;
        x.revenue += l.total;
        items.set(l.itemId, x);
      }
    return {
      days,
      revenue: sales.reduce((a, s) => a + Number(s.total), 0),
      covered: sales.reduce((a, s) => a + Number(s.coveredAmount), 0),
      meals: sales.reduce((a, s) => a + s.mealCount, 0),
      transactions: sales.length,
      uniqueStudents: new Set(sales.map((s) => s.studentId).filter(Boolean)).size,
      byDay: [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, x]) => ({ date, ...x })),
      byMode: Object.entries(
        sales.reduce((a: any, s) => {
          a[s.paymentMode] = (a[s.paymentMode] ?? 0) + Number(s.total);
          return a;
        }, {}),
      ).map(([mode, amount]) => ({ mode, amount })),
      topItems: [...items.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 10),
      plans: plans.map((p) => ({
        id: p.id,
        name: p.name,
        type: p.type,
        enrolled: p._count.enrolments,
        revenue: sales.filter((s) => s.planId === p.id).reduce((a, s) => a + Number(s.total), 0),
      })),
      wallets: { count: wallets._count._all, total: wallets._sum.balance ?? 0, average: wallets._avg.balance ?? 0 },
    };
  }

  // ─────────────────────────── Staff ───────────────────────────
  async staff() {
    const db = this.prisma.db;
    const [staff, slots] = await Promise.all([
      db.staff.findMany({
        where: { status: { not: 'TERMINATED' } },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          staffType: true,
          department: true,
          status: true,
          classTeacherOf: { select: { id: true } },
          classSubjects: { select: { classId: true, subjectId: true } },
        },
      }),
      db.timetableSlot.groupBy({ by: ['teacherId'], _count: { _all: true } }),
    ]);
    return {
      totals: {
        teaching: staff.filter((s) => s.staffType === 'TEACHING').length,
        nonTeaching: staff.filter((s) => s.staffType === 'NON_TEACHING').length,
        onLeave: staff.filter((s) => s.status === 'ON_LEAVE').length,
      },
      byDepartment: Object.entries(
        staff.reduce((a: any, s) => {
          const k = s.department ?? 'Unassigned';
          a[k] = (a[k] ?? 0) + 1;
          return a;
        }, {}),
      ).map(([department, count]) => ({ department, count })),
      workload: staff
        .filter((s) => s.staffType === 'TEACHING')
        .map((s) => ({
          id: s.id,
          name: `${s.firstName} ${s.lastName}`,
          classTeacherOf: s.classTeacherOf.length,
          subjectAssignments: s.classSubjects.length,
          classes: new Set(s.classSubjects.map((c) => c.classId)).size,
          periodsPerWeek: slots.find((x) => x.teacherId === s.id)?._count._all ?? 0,
        }))
        .sort((a, b) => b.periodsPerWeek - a.periodsPerWeek),
    };
  }

  /** Birthdays in the next 7 days and students who turned 18 etc. — used by dashboards. */
  async birthdays(days = 7) {
    const students = await this.prisma.db.student.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, firstName: true, lastName: true, dateOfBirth: true, class: { select: { name: true } } },
    });
    const today = startOfToday();
    const out = [] as any[];
    for (const s of students) {
      const dob = new Date(s.dateOfBirth);
      const next = new Date(Date.UTC(today.getUTCFullYear(), dob.getUTCMonth(), dob.getUTCDate()));
      if (next < today) next.setUTCFullYear(next.getUTCFullYear() + 1);
      const inDays = Math.round((next.getTime() - today.getTime()) / 86400000);
      if (inDays <= days)
        out.push({
          id: s.id,
          name: `${s.firstName} ${s.lastName}`,
          className: s.class?.name,
          date: isoDate(next),
          inDays,
          turning: next.getUTCFullYear() - dob.getUTCFullYear(),
        });
    }
    return out.sort((a, b) => a.inDays - b.inDays);
  }
}
