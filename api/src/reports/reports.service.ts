import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { addDays, isoDate, startOfToday, zero } from '../common/utils';

/**
 * Analytics for administrators: enrolment, attendance, finance ageing, academic performance and
 * staff workload. Everything is computed from tenant-scoped data at request time.
 */
@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Enrolment by class, gender, boarding status and admissions over the last 12 months. */
  async enrolment() {
    const db = this.prisma.db;
    const [byClass, byGender, boarding, admissions, statuses] = await Promise.all([
      db.schoolClass.findMany({
        select: {
          id: true,
          name: true,
          level: true,
          capacity: true,
          _count: { select: { students: { where: { status: 'ACTIVE' } } } },
        },
        orderBy: [{ level: 'asc' }, { name: 'asc' }],
      }),
      db.student.groupBy({ by: ['gender'], where: { status: 'ACTIVE' }, _count: { _all: true } }),
      db.student.groupBy({ by: ['isBoarding'], where: { status: 'ACTIVE' }, _count: { _all: true } }),
      db.student.findMany({
        where: { admissionDate: { gte: addDays(startOfToday(), -365) } },
        select: { admissionDate: true },
      }),
      db.student.groupBy({ by: ['status'], _count: { _all: true } }),
    ]);
    const months = new Map<string, number>();
    for (const a of admissions) {
      const k = a.admissionDate.toISOString().slice(0, 7);
      months.set(k, (months.get(k) ?? 0) + 1);
    }
    const levels = new Map<string, number>();
    for (const c of byClass) levels.set(c.level, (levels.get(c.level) ?? 0) + c._count.students);
    return {
      byClass: byClass.map((c) => ({
        classId: c.id,
        name: c.name,
        level: c.level,
        capacity: c.capacity,
        students: c._count.students,
        fill: c.capacity ? Math.round((c._count.students / c.capacity) * 100) : null,
      })),
      byLevel: [...levels.entries()].map(([level, students]) => ({ level, students })),
      byGender: Object.fromEntries(byGender.map((g) => [g.gender, g._count._all])),
      boarding: {
        boarding: boarding.find((b) => b.isBoarding)?._count._all ?? 0,
        day: boarding.find((b) => !b.isBoarding)?._count._all ?? 0,
      },
      admissionsByMonth: [...months.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, count]) => ({ month, count })),
      byStatus: Object.fromEntries(statuses.map((s) => [s.status, s._count._all])),
    };
  }

  /** Attendance rate per class per week for a date range, plus chronic absentees. */
  async attendance(from?: string, to?: string) {
    const db = this.prisma.db;
    const start = from ? new Date(from) : addDays(startOfToday(), -56);
    const end = to ? new Date(to) : startOfToday();
    const rows = await db.attendance.findMany({
      where: { date: { gte: start, lte: end } },
      select: { classId: true, studentId: true, date: true, status: true },
    });
    const classes = await db.schoolClass.findMany({ select: { id: true, name: true } });
    const weekOf = (d: Date) =>
      addDays(d, -((d.getUTCDay() + 6) % 7))
        .toISOString()
        .slice(0, 10);
    const perClassWeek = new Map<string, { present: number; total: number }>();
    const perStudent = new Map<string, { present: number; total: number }>();
    const perDay = new Map<string, { present: number; total: number }>();
    for (const r of rows) {
      const present = r.status === 'PRESENT' || r.status === 'LATE' ? 1 : 0;
      const k = `${r.classId}|${weekOf(r.date)}`;
      const c = perClassWeek.get(k) ?? { present: 0, total: 0 };
      c.present += present;
      c.total++;
      perClassWeek.set(k, c);
      const s = perStudent.get(r.studentId) ?? { present: 0, total: 0 };
      s.present += present;
      s.total++;
      perStudent.set(r.studentId, s);
      const d = perDay.get(isoDate(r.date)) ?? { present: 0, total: 0 };
      d.present += present;
      d.total++;
      perDay.set(isoDate(r.date), d);
    }
    const weeks = [...new Set([...perClassWeek.keys()].map((k) => k.split('|')[1]))].sort();
    const byClass = classes.map((c) => ({
      classId: c.id,
      name: c.name,
      weeks: weeks.map((w) => {
        const v = perClassWeek.get(`${c.id}|${w}`);
        return { week: w, rate: v && v.total ? Math.round((v.present / v.total) * 100) : null };
      }),
      overall: (() => {
        const vs = weeks.map((w) => perClassWeek.get(`${c.id}|${w}`)).filter(Boolean);
        const t = vs.reduce((a, v) => a + v.total, 0);
        return t ? Math.round((vs.reduce((a, v) => a + v.present, 0) / t) * 100) : null;
      })(),
    }));
    const chronic = [...perStudent.entries()]
      .map(([studentId, v]) => ({ studentId, rate: Math.round((v.present / v.total) * 100), days: v.total }))
      .filter((x) => x.days >= 5 && x.rate < 80)
      .sort((a, b) => a.rate - b.rate)
      .slice(0, 25);
    const students = chronic.length
      ? await db.student.findMany({
          where: { id: { in: chronic.map((c) => c.studentId) } },
          select: { id: true, studentId: true, firstName: true, lastName: true, class: { select: { name: true } } },
        })
      : [];
    const daily = [...perDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, rate: Math.round((v.present / v.total) * 100), marked: v.total }));
    return {
      from: isoDate(start),
      to: isoDate(end),
      weeks,
      byClass,
      daily,
      chronicAbsentees: chronic.map((c) => ({ ...c, ...students.find((s) => s.id === c.studentId) })),
      schoolRate: daily.length ? Math.round(daily.reduce((a, d) => a + d.rate, 0) / daily.length) : null,
    };
  }

  /** Fee ageing: outstanding balances by how long overdue; collections by month; top defaulters. */
  async finance() {
    const db = this.prisma.db;
    const [open, payments, byCategory] = await Promise.all([
      db.invoice.findMany({
        where: { status: { in: ['ISSUED', 'PARTIALLY_PAID', 'OVERDUE'] } },
        select: {
          id: true,
          total: true,
          paidTotal: true,
          dueDate: true,
          student: {
            select: { id: true, studentId: true, firstName: true, lastName: true, class: { select: { name: true } } },
          },
        },
      }),
      db.payment.findMany({
        where: { status: 'SUCCESS', paidAt: { gte: addDays(startOfToday(), -365) } },
        select: { paidAt: true, amount: true, method: true, purpose: true },
      }),
      db.invoiceLine.groupBy({ by: ['categoryId'], _sum: { amount: true, discount: true } }),
    ]);
    const buckets = { current: zero(), '1-30': zero(), '31-60': zero(), '61-90': zero(), '90+': zero() };
    const now = Date.now();
    const debtors = new Map<string, any>();
    for (const i of open) {
      const bal = i.total.minus(i.paidTotal);
      if (bal.lte(0)) continue;
      const days = Math.floor((now - i.dueDate.getTime()) / 86400000);
      const b = days <= 0 ? 'current' : days <= 30 ? '1-30' : days <= 60 ? '31-60' : days <= 90 ? '61-90' : '90+';
      buckets[b] = buckets[b].plus(bal);
      const d = debtors.get(i.student.id) ?? { ...i.student, balance: zero(), invoices: 0, oldestDays: 0 };
      d.balance = d.balance.plus(bal);
      d.invoices++;
      d.oldestDays = Math.max(d.oldestDays, days);
      debtors.set(i.student.id, d);
    }
    const months = new Map<string, { month: string; fees: number; wallet: number }>();
    const methods = new Map<string, number>();
    for (const p of payments) {
      const k = p.paidAt.toISOString().slice(0, 7);
      const m = months.get(k) ?? { month: k, fees: 0, wallet: 0 };
      if (p.purpose === 'WALLET') m.wallet += Number(p.amount);
      else m.fees += Number(p.amount);
      months.set(k, m);
      methods.set(p.method, (methods.get(p.method) ?? 0) + Number(p.amount));
    }
    const cats = await db.feeCategory.findMany({ select: { id: true, name: true } });
    return {
      ageing: Object.fromEntries(Object.entries(buckets).map(([k, v]) => [k, Number(v)])),
      totalOutstanding: Number(Object.values(buckets).reduce((a, v) => a.plus(v), zero())),
      collectionsByMonth: [...months.values()].sort((a, b) => a.month.localeCompare(b.month)),
      byMethod: [...methods.entries()].map(([method, amount]) => ({ method, amount })),
      byCategory: byCategory.map((c) => ({
        category: cats.find((x) => x.id === c.categoryId)?.name ?? 'Other',
        billed: Number(c._sum.amount ?? 0),
        discounts: Number(c._sum.discount ?? 0),
      })),
      topDefaulters: [...debtors.values()]
        .sort((a, b) => Number(b.balance) - Number(a.balance))
        .slice(0, 15)
        .map((d) => ({ ...d, balance: Number(d.balance) })),
    };
  }

  /** Academic performance for a term: averages per class & subject, grade distribution, pass rates. */
  async academic(termId?: string) {
    const db = this.prisma.db;
    const term = termId
      ? await db.term.findUnique({ where: { id: termId } })
      : ((await db.term.findFirst({ where: { isCurrent: true } })) ??
        (await db.term.findFirst({ orderBy: { startDate: 'desc' } })));
    if (!term) return { term: null, byClass: [], bySubject: [], gradeDistribution: {}, sheets: 0 };
    const sheets = await db.resultSheet.findMany({
      where: { termId: term.id },
      select: { classId: true, average: true, overallGrade: true, subjects: true, status: true },
    });
    const classes = await db.schoolClass.findMany({ select: { id: true, name: true } });
    const byClass = new Map<
      string,
      { classId: string; name: string; sum: number; n: number; passed: number; published: number }
    >();
    const bySubject = new Map<string, { subject: string; code: string; sum: number; n: number; top: number }>();
    const grades = new Map<string, number>();
    for (const s of sheets) {
      const c = byClass.get(s.classId) ?? {
        classId: s.classId,
        name: classes.find((x) => x.id === s.classId)?.name ?? '?',
        sum: 0,
        n: 0,
        passed: 0,
        published: 0,
      };
      c.sum += Number(s.average);
      c.n++;
      if (Number(s.average) >= 50) c.passed++;
      if (s.status === 'PUBLISHED') c.published++;
      byClass.set(s.classId, c);
      if (s.overallGrade) grades.set(s.overallGrade, (grades.get(s.overallGrade) ?? 0) + 1);
      for (const sub of (s.subjects as any[]) ?? []) {
        if (!sub.hasMarks) continue;
        const v = bySubject.get(sub.subjectId) ?? { subject: sub.name, code: sub.code, sum: 0, n: 0, top: 0 };
        v.sum += sub.total;
        v.n++;
        v.top = Math.max(v.top, sub.total);
        bySubject.set(sub.subjectId, v);
      }
    }
    return {
      term: { id: term.id, name: term.name },
      sheets: sheets.length,
      byClass: [...byClass.values()]
        .map((c) => ({
          classId: c.classId,
          name: c.name,
          average: c.n ? Math.round((c.sum / c.n) * 10) / 10 : 0,
          students: c.n,
          passRate: c.n ? Math.round((c.passed / c.n) * 100) : 0,
          published: c.published,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      bySubject: [...bySubject.values()]
        .map((v) => ({
          subject: v.subject,
          code: v.code,
          average: Math.round((v.sum / v.n) * 10) / 10,
          top: v.top,
          students: v.n,
        }))
        .sort((a, b) => b.average - a.average),
      gradeDistribution: Object.fromEntries([...grades.entries()].sort()),
    };
  }

  /** Staff workload: classes/subjects per teacher, weekly periods, leave taken. */
  async staff() {
    const db = this.prisma.db;
    const teachers = await db.staff.findMany({
      where: { status: { not: 'TERMINATED' }, staffType: 'TEACHING' },
      select: {
        id: true,
        employeeId: true,
        firstName: true,
        lastName: true,
        department: true,
        classTeacherOf: { select: { name: true } },
        classSubjects: { select: { class: { select: { name: true } }, subject: { select: { name: true } } } },
        slots: { select: { id: true } },
        leaveRequests: {
          where: { status: 'APPROVED', startDate: { gte: addDays(startOfToday(), -365) } },
          select: { days: true },
        },
      },
      orderBy: { lastName: 'asc' },
    });
    const byDept = await db.staff.groupBy({
      by: ['department'],
      where: { status: { not: 'TERMINATED' } },
      _count: { _all: true },
    });
    return {
      teachers: teachers.map((t) => ({
        id: t.id,
        employeeId: t.employeeId,
        name: `${t.firstName} ${t.lastName}`,
        department: t.department,
        classTeacherOf: t.classTeacherOf.map((c) => c.name),
        subjects: t.classSubjects.length,
        classes: new Set(t.classSubjects.map((c) => c.class.name)).size,
        periodsPerWeek: t.slots.length,
        leaveDays12m: t.leaveRequests.reduce((a, l) => a + l.days, 0),
      })),
      byDepartment: byDept.map((d) => ({ department: d.department ?? 'Unassigned', count: d._count._all })),
    };
  }
}
