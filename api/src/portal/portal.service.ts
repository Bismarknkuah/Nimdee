import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantCacheService } from '../tenants/tenant-cache.service';
import { AttendanceService } from '../attendance/attendance.service';
import { FeesService } from '../fees/fees.service';
import { PaymentsGatewayService } from '../fees/payments.service';
import { ResultsService } from '../results/results.service';
import { TimetableService } from '../timetable/timetable.service';
import { CanteenService } from '../canteen/canteen.service';
import { CanteenPlansService } from '../canteen/plans.service';
import { ctx, tid } from '../common/context/request-context';
import { addDays, startOfToday } from '../common/utils';
import { InitiateOnlineDto } from '../fees/dto';
import { AssignmentsService } from '../assignments/assignments.service';
import { DisciplineService } from '../discipline/discipline.service';
import { HealthService } from '../health/health.service';
import { TransportService } from '../transport/transport.service';
import { LibraryService } from '../library/library.service';
import { EventsService } from '../events/events.service';
import { SubmitDto } from '../assignments/dto';

/** Parent & student portal: every query is scoped to the caller's own children / own record. */
@Injectable()
export class PortalService {
  constructor(
    private prisma: PrismaService,
    private tenants: TenantCacheService,
    private attendance: AttendanceService,
    private fees: FeesService,
    private gateway: PaymentsGatewayService,
    private results: ResultsService,
    private timetable: TimetableService,
    private canteen: CanteenService,
    private plans: CanteenPlansService,
    private assignments: AssignmentsService,
    private discipline: DisciplineService,
    private health: HealthService,
    private transport: TransportService,
    private library: LibraryService,
    private events: EventsService,
  ) {}

  private async childIds(): Promise<string[]> {
    const c = ctx();
    if (c.userType === 'STUDENT') return c.studentId ? [c.studentId] : [];
    if (!c.guardianId) throw new ForbiddenException('No guardian profile is linked to this account');
    const links = await this.prisma.db.studentGuardian.findMany({
      where: { guardianId: c.guardianId },
      select: { studentId: true },
    });
    return links.map((l) => l.studentId);
  }

  async assertChild(studentId: string) {
    const ids = await this.childIds();
    if (!ids.includes(studentId)) throw new ForbiddenException('You can only view your own children');
  }

  async overview() {
    const ids = await this.childIds();
    const db = this.prisma.db;
    const snap = await this.tenants.get(tid());
    const since = addDays(startOfToday(), -30);
    const children = await db.student.findMany({
      where: { id: { in: ids } },
      include: {
        class: {
          select: {
            id: true,
            name: true,
            level: true,
            classTeacher: { select: { firstName: true, lastName: true, phone: true } },
          },
        },
        account: { select: { balance: true } },
        wallet: { select: { balance: true } },
      },
    });
    const [attendance, results, unread, announcements] = await Promise.all([
      db.attendance.groupBy({
        by: ['studentId', 'status'],
        where: { studentId: { in: ids }, date: { gte: since } },
        _count: { _all: true },
      }),
      db.resultSheet.findMany({
        where: { studentId: { in: ids }, status: 'PUBLISHED' },
        orderBy: { publishedAt: 'desc' },
        select: {
          id: true,
          studentId: true,
          termId: true,
          average: true,
          position: true,
          classSize: true,
          overallGrade: true,
          publishedAt: true,
        },
      }),
      db.notification.count({ where: { userId: ctx().userId, readAt: null } }),
      db.announcement.findMany({
        where: {
          publishedAt: { not: null },
          OR: [
            { audienceType: { in: ['ALL', 'PARENTS'] } },
            { audienceType: 'CLASS', classId: { in: children.map((k) => k.classId).filter(Boolean) } },
          ],
        },
        orderBy: { publishedAt: 'desc' },
        take: 6,
        select: { id: true, title: true, body: true, publishedAt: true },
      }),
    ]);
    const terms = await db.term.findMany({
      where: { id: { in: [...new Set(results.map((r) => r.termId))] } },
      select: { id: true, name: true, startDate: true },
    });
    const [calendar, installments, walletTx, plans, currentTerm, timetableToday] = await Promise.all([
      db.attendance.findMany({
        where: { studentId: { in: ids }, date: { gte: since } },
        select: { studentId: true, date: true, status: true },
      }),
      db.installment.findMany({
        where: {
          status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] },
          invoice: { studentId: { in: ids }, status: { not: 'CANCELLED' } },
        },
        orderBy: { dueDate: 'asc' },
        select: {
          id: true,
          sequence: true,
          amount: true,
          paidAmount: true,
          dueDate: true,
          status: true,
          invoice: { select: { id: true, number: true, studentId: true } },
        },
      }),
      db.walletTransaction.findMany({
        where: {
          wallet: { studentId: { in: ids } },
          type: 'PURCHASE',
          createdAt: { gte: addDays(startOfToday(), -6) },
        },
        select: { amount: true, createdAt: true, wallet: { select: { studentId: true } } },
      }),
      db.studentCanteenPlan.findMany({
        where: { studentId: { in: ids }, status: 'ACTIVE' },
        include: { plan: { select: { name: true, type: true, mealsPerDay: true, price: true, billingPeriod: true } } },
      }),
      db.term.findFirst({ where: { isCurrent: true } }),
      db.timetableSlot.findMany({
        where: { class: { students: { some: { id: { in: ids } } } }, dayOfWeek: new Date().getDay() || 7 },
        include: {
          subject: { select: { name: true } },
          period: { select: { name: true, startTime: true, endTime: true, sequence: true } },
          class: { select: { id: true } },
        },
        orderBy: { period: { sequence: 'asc' } },
      }),
    ]);
    return {
      school: {
        name: snap.name,
        currency: snap.currency,
        onlinePayments: snap.settings.finance.paymentProvider === 'PAYSTACK' || !!process.env.PAYSTACK_SECRET_KEY,
        features: snap.features,
        term: currentTerm ? { id: currentTerm.id, name: currentTerm.name, endDate: currentTerm.endDate } : null,
      },
      unreadNotifications: unread,
      announcements,
      children: children.map((k) => {
        const a = attendance.filter((x) => x.studentId === k.id);
        const total = a.reduce((s, x) => s + x._count._all, 0);
        const present = a
          .filter((x) => x.status === 'PRESENT' || x.status === 'LATE')
          .reduce((s, x) => s + x._count._all, 0);
        const mine = results.filter((r) => r.studentId === k.id);
        const latest = mine[0];
        const plan = plans.find((p) => p.studentId === k.id);
        return {
          id: k.id,
          studentId: k.studentId,
          firstName: k.firstName,
          lastName: k.lastName,
          photoUrl: k.photoUrl,
          class: k.class,
          balance: k.account?.balance ?? 0,
          walletBalance: k.wallet?.balance ?? 0,
          attendance30d: {
            total,
            present,
            rate: total ? Math.round((present / total) * 100) : null,
            absent: a.find((x) => x.status === 'ABSENT')?._count._all ?? 0,
            late: a.find((x) => x.status === 'LATE')?._count._all ?? 0,
          },
          attendanceCalendar: calendar
            .filter((x) => x.studentId === k.id)
            .map((x) => ({ date: x.date.toISOString().slice(0, 10), status: x.status })),
          latestResult: latest ? { ...latest, term: terms.find((t) => t.id === latest.termId)?.name } : null,
          resultsTrend: [...mine]
            .sort(
              (x, y) =>
                (terms.find((t) => t.id === x.termId)?.startDate?.getTime() ?? 0) -
                (terms.find((t) => t.id === y.termId)?.startDate?.getTime() ?? 0),
            )
            .map((r) => ({
              term: terms.find((t) => t.id === r.termId)?.name,
              average: Number(r.average),
              position: r.position,
            })),
          installments: installments
            .filter((i) => i.invoice.studentId === k.id)
            .slice(0, 4)
            .map((i) => ({
              id: i.id,
              invoiceId: i.invoice.id,
              invoiceNumber: i.invoice.number,
              sequence: i.sequence,
              due: i.amount.minus(i.paidAmount),
              dueDate: i.dueDate,
              status: i.status,
            })),
          walletSpend7d: walletTx.filter((t) => t.wallet.studentId === k.id).reduce((s, t) => s + Number(t.amount), 0),
          canteenPlan: plan
            ? {
                name: plan.plan.name,
                type: plan.plan.type,
                mealsPerDay: plan.plan.mealsPerDay,
                price: plan.plan.price,
                billingPeriod: plan.plan.billingPeriod,
                endDate: plan.endDate,
              }
            : null,
          today: timetableToday
            .filter((t) => t.class.id === k.classId)
            .map((t) => ({
              period: t.period.name,
              time: `${t.period.startTime}–${t.period.endTime}`,
              subject: t.subject.name,
            })),
        };
      }),
    };
  }

  async child(studentId: string) {
    await this.assertChild(studentId);
    const s = await this.prisma.db.student.findUnique({
      where: { id: studentId },
      include: {
        class: {
          select: { id: true, name: true, level: true, classTeacher: { select: { firstName: true, lastName: true } } },
        },
        account: { select: { balance: true } },
      },
    });
    if (!s) throw new NotFoundException('Student not found');
    const { medicalNotes, ...safe } = s;
    return safe;
  }

  async childAttendance(studentId: string, from?: string, to?: string) {
    await this.assertChild(studentId);
    const history = await this.attendance.studentHistory(studentId, from, to);
    const counts = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0, SICK: 0 };
    for (const h of history) counts[h.status]++;
    const total = history.length;
    return { history, counts, total, rate: total ? Math.round(((counts.PRESENT + counts.LATE) / total) * 100) : null };
  }

  async childResults(studentId: string) {
    await this.assertChild(studentId);
    const sheets = await this.prisma.db.resultSheet.findMany({
      where: { studentId, status: 'PUBLISHED' },
      orderBy: { publishedAt: 'desc' },
    });
    const terms = await this.prisma.db.term.findMany({
      where: { id: { in: [...new Set(sheets.map((s) => s.termId))] } },
      include: { academicYear: { select: { name: true } } },
    });
    return sheets.map((s) => ({ ...s, term: terms.find((t) => t.id === s.termId) }));
  }

  async childReportCard(studentId: string, sheetId: string) {
    await this.assertChild(studentId);
    const sheet = await this.prisma.db.resultSheet.findFirst({
      where: { id: sheetId, studentId, status: 'PUBLISHED' },
    });
    if (!sheet) throw new NotFoundException('Report card not available');
    return this.results.reportCardPdf(sheetId);
  }

  async childFees(studentId: string) {
    await this.assertChild(studentId);
    const st = await this.fees.statement(studentId);
    return { balance: st.balance, invoices: st.invoices, payments: st.payments.filter((p) => p.status !== 'FAILED') };
  }

  async childTimetable(studentId: string) {
    await this.assertChild(studentId);
    const s = await this.prisma.db.student.findUnique({ where: { id: studentId }, select: { classId: true } });
    return s?.classId ? this.timetable.forClass(s.classId) : [];
  }

  async childWallet(studentId: string) {
    await this.assertChild(studentId);
    return this.canteen.wallet(studentId);
  }

  async childCanteenPlan(studentId: string) {
    await this.assertChild(studentId);
    const [current, plans] = await Promise.all([
      this.plans.studentPlan(studentId),
      this.prisma.db.canteenPlan.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
        include: { items: { include: { item: { select: { name: true, price: true } } } } },
      }),
    ]);
    return {
      ...current,
      available: plans.map((p) => ({
        id: p.id,
        code: p.code,
        name: p.name,
        description: p.description,
        type: p.type,
        price: p.price,
        billingPeriod: p.billingPeriod,
        mealsPerDay: p.mealsPerDay,
        dailyLimit: p.dailyLimit,
        creditLimit: p.creditLimit,
        allowanceAmount: p.allowanceAmount,
        allowanceFrequency: p.allowanceFrequency,
        billToFees: p.billToFees,
        isDefault: p.isDefault,
        items: p.items.map((i) => i.item),
      })),
    };
  }

  /** Parents can move a child onto a plan; billed plans issue an invoice the parent can pay online. */
  async chooseCanteenPlan(studentId: string, planId: string) {
    await this.assertChild(studentId);
    const plan = await this.prisma.db.canteenPlan.findUnique({ where: { id: planId } });
    if (!plan || !plan.isActive) throw new NotFoundException('Plan not available');
    if (plan.type === 'CREDIT') throw new ForbiddenException('Credit plans are assigned by the school office');
    const r = await this.plans.enrol(planId, {
      studentIds: [studentId],
      bill: plan.billToFees && Number(plan.price) > 0,
    });
    if (r.errors.length) throw new BadRequestException(r.errors[0]);
    return this.childCanteenPlan(studentId);
  }

  async childAssignments(studentId: string) {
    await this.assertChild(studentId);
    return this.assignments.forStudent(studentId);
  }

  async submitAssignment(studentId: string, assignmentId: string, dto: SubmitDto) {
    await this.assertChild(studentId);
    return this.assignments.submit(assignmentId, studentId, dto);
  }

  async childDiscipline(studentId: string) {
    await this.assertChild(studentId);
    const s = await this.discipline.studentSummary(studentId);
    return {
      ...s,
      incidents: s.incidents.map((i) => ({
        id: i.id,
        date: i.date,
        category: i.category,
        severity: i.severity,
        description: i.description,
        actionTaken: i.actionTaken,
        status: i.status,
        points: i.points,
      })),
    };
  }

  async childHealth(studentId: string) {
    await this.assertChild(studentId);
    return this.health.forStudent(studentId);
  }

  async childTransport(studentId: string) {
    await this.assertChild(studentId);
    return this.transport.forStudent(studentId);
  }

  async childLibrary(studentId: string) {
    await this.assertChild(studentId);
    return this.library.forStudent(studentId);
  }

  async childEvents(studentId: string) {
    await this.assertChild(studentId);
    const s = await this.prisma.db.student.findUnique({ where: { id: studentId }, select: { classId: true } });
    return this.events.list({ classId: s?.classId ?? undefined }, { forUserAudience: true });
  }

  async pay(dto: InitiateOnlineDto) {
    await this.assertChild(dto.studentId);
    return this.gateway.initiate(dto);
  }

  async verifyPayment(reference: string) {
    const p = await this.prisma.db.payment.findFirst({ where: { reference } });
    if (!p) throw new NotFoundException('Payment not found');
    await this.assertChild(p.studentId);
    return this.gateway.verify(reference);
  }

  async receiptPdf(paymentId: string) {
    const p = await this.fees.getPayment(paymentId);
    await this.assertChild(p.studentId);
    return p;
  }
}
