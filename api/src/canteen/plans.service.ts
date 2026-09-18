import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService, Tx } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { TenantCacheService } from '../tenants/tenant-cache.service';
import { FeesService } from '../fees/fees.service';
import { ctx, requestContext, tid } from '../common/context/request-context';
import { addDays, money, startOfToday, toDateOnly, zero } from '../common/utils';
import { allowanceDue, walletCanPay } from './plan-rules';
import { CanteenPlanDto, EnrolDto, EnrolmentQueryDto } from './plans.dto';

export interface ActivePlan {
  enrolment: any;
  plan: any;
  coveredItemIds: string[];
  mealsUsedToday: number;
}

/**
 * Canteen payment structures. Each school designs how its students pay for the canteen:
 *  PREPAID        — parents top up a wallet; purchases deduct from it (optional daily limit)
 *  PAY_AS_YOU_GO  — cash at the counter, no wallet
 *  MEAL_PLAN      — a fixed price per term/month covers N meals per school day from a defined menu; billed through fees
 *  CREDIT         — post-paid: the wallet may go negative up to a credit limit; the balance is settled later
 *  ALLOWANCE      — the school credits a fixed allowance to the wallet daily/weekly/monthly (funded by fees or sponsors)
 */
@Injectable()
export class CanteenPlansService {
  private readonly logger = new Logger(CanteenPlansService.name);
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private tenants: TenantCacheService,
    private fees: FeesService,
  ) {}

  // ─────────────────────────── Plans ───────────────────────────
  async list() {
    const plans = await this.prisma.db.canteenPlan.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        items: { include: { item: { select: { id: true, name: true, price: true } } } },
        _count: { select: { enrolments: { where: { status: 'ACTIVE' } } } },
      },
    });
    return plans.map((p) => ({
      ...p,
      activeEnrolments: p._count.enrolments,
      items: p.items.map((i) => i.item),
      _count: undefined,
    }));
  }

  async get(id: string) {
    const p = await this.prisma.db.canteenPlan.findUnique({
      where: { id },
      include: { items: { include: { item: true } } },
    });
    if (!p) throw new NotFoundException('Plan not found');
    return { ...p, items: p.items.map((i) => i.item) };
  }

  private validate(dto: Partial<CanteenPlanDto>) {
    if (dto.type === 'MEAL_PLAN') {
      if (dto.mealsPerDay !== undefined && dto.mealsPerDay < 1)
        throw new BadRequestException('Meal plans must cover at least one meal per day');
      if (dto.billingPeriod === 'NONE')
        throw new BadRequestException('Meal plans need a billing period (e.g. TERM or MONTHLY)');
    }
    if (dto.type === 'CREDIT' && dto.creditLimit !== undefined && dto.creditLimit !== null && dto.creditLimit <= 0)
      throw new BadRequestException('Credit plans need a credit limit greater than zero');
    if (dto.type === 'ALLOWANCE') {
      if (!dto.allowanceAmount) throw new BadRequestException('Allowance plans need an allowance amount');
      if (!dto.allowanceFrequency || dto.allowanceFrequency === 'NONE' || dto.allowanceFrequency === 'TERM')
        throw new BadRequestException('Allowance frequency must be DAILY, WEEKLY or MONTHLY');
    }
  }

  async create(dto: CanteenPlanDto) {
    this.validate(dto);
    const tenantId = tid();
    const plan = await this.prisma
      .tenantTx(async (tx) => {
        if (dto.isDefault) await tx.canteenPlan.updateMany({ where: { tenantId }, data: { isDefault: false } });
        const p = await tx.canteenPlan.create({
          data: {
            tenantId,
            code: dto.code.trim().toUpperCase(),
            name: dto.name.trim(),
            description: dto.description,
            type: dto.type,
            price: money(dto.price ?? 0),
            billingPeriod: dto.billingPeriod ?? (dto.type === 'MEAL_PLAN' ? 'TERM' : 'NONE'),
            mealsPerDay: dto.mealsPerDay ?? 1,
            dailyLimit: dto.dailyLimit == null ? null : money(dto.dailyLimit),
            creditLimit: dto.creditLimit == null ? null : money(dto.creditLimit),
            allowanceAmount: dto.allowanceAmount == null ? null : money(dto.allowanceAmount),
            allowanceFrequency: dto.allowanceFrequency ?? 'NONE',
            billToFees: dto.billToFees ?? true,
            isDefault: !!dto.isDefault,
            isActive: dto.isActive ?? true,
            sortOrder: dto.sortOrder ?? 0,
            items: dto.itemIds?.length
              ? { create: [...new Set(dto.itemIds)].map((itemId) => ({ tenantId, itemId })) }
              : undefined,
          },
        });
        return p;
      })
      .catch((e) => {
        if (e?.code === 'P2002') throw new ConflictException('A plan with this code already exists');
        throw e;
      });
    await this.audit.log({ action: 'CANTEEN_PLAN_CREATED', entity: 'CanteenPlan', entityId: plan.id, after: dto });
    return this.get(plan.id);
  }

  async update(id: string, dto: Partial<CanteenPlanDto>) {
    const before = await this.prisma.db.canteenPlan.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Plan not found');
    this.validate({
      ...before,
      ...dto,
      price: dto.price ?? Number(before.price),
      creditLimit:
        dto.creditLimit === undefined
          ? before.creditLimit == null
            ? null
            : Number(before.creditLimit)
          : dto.creditLimit,
      allowanceAmount:
        dto.allowanceAmount === undefined
          ? before.allowanceAmount == null
            ? null
            : Number(before.allowanceAmount)
          : dto.allowanceAmount,
    } as any);
    await this.prisma.tenantTx(async (tx) => {
      if (dto.isDefault)
        await tx.canteenPlan.updateMany({ where: { tenantId: tid(), id: { not: id } }, data: { isDefault: false } });
      await tx.canteenPlan.update({
        where: { id },
        data: {
          code: dto.code?.trim().toUpperCase(),
          name: dto.name?.trim(),
          description: dto.description,
          type: dto.type,
          price: dto.price !== undefined ? money(dto.price) : undefined,
          billingPeriod: dto.billingPeriod,
          mealsPerDay: dto.mealsPerDay,
          dailyLimit: dto.dailyLimit === undefined ? undefined : dto.dailyLimit === null ? null : money(dto.dailyLimit),
          creditLimit:
            dto.creditLimit === undefined ? undefined : dto.creditLimit === null ? null : money(dto.creditLimit),
          allowanceAmount:
            dto.allowanceAmount === undefined
              ? undefined
              : dto.allowanceAmount === null
                ? null
                : money(dto.allowanceAmount),
          allowanceFrequency: dto.allowanceFrequency,
          billToFees: dto.billToFees,
          isDefault: dto.isDefault,
          isActive: dto.isActive,
          sortOrder: dto.sortOrder,
        },
      });
      if (dto.itemIds) {
        await tx.canteenPlanItem.deleteMany({ where: { planId: id, itemId: { notIn: dto.itemIds } } });
        for (const itemId of new Set(dto.itemIds))
          await tx.canteenPlanItem.upsert({
            where: { planId_itemId: { planId: id, itemId } },
            create: { tenantId: tid(), planId: id, itemId },
            update: {},
          });
      }
      // Credit limit changes propagate to enrolled wallets that inherit the plan limit
      if (dto.creditLimit !== undefined && before.type === 'CREDIT') {
        const enrolled = await tx.studentCanteenPlan.findMany({
          where: { planId: id, status: 'ACTIVE' },
          select: { studentId: true },
        });
        await tx.wallet.updateMany({
          where: { studentId: { in: enrolled.map((e) => e.studentId) } },
          data: { creditLimit: dto.creditLimit === null ? null : money(dto.creditLimit) },
        });
      }
    });
    await this.audit.log({ action: 'CANTEEN_PLAN_UPDATED', entity: 'CanteenPlan', entityId: id, before, after: dto });
    return this.get(id);
  }

  async remove(id: string) {
    const active = await this.prisma.db.studentCanteenPlan.count({ where: { planId: id, status: 'ACTIVE' } });
    if (active)
      throw new BadRequestException(
        `${active} student(s) are still enrolled on this plan. End their enrolments first.`,
      );
    const used = await this.prisma.db.studentCanteenPlan.count({ where: { planId: id } });
    if (used) {
      await this.prisma.db.canteenPlan.update({ where: { id }, data: { isActive: false } });
      return { ok: true, archived: true };
    }
    await this.prisma.db.canteenPlan.delete({ where: { id } });
    await this.audit.log({ action: 'CANTEEN_PLAN_DELETED', entity: 'CanteenPlan', entityId: id });
    return { ok: true };
  }

  // ─────────────────────────── Enrolments ───────────────────────────
  async enrolments(q: EnrolmentQueryDto) {
    const where: any = {};
    if (q.planId) where.planId = q.planId;
    if (q.status) where.status = q.status;
    else where.status = { not: 'ENDED' };
    if (q.classId) where.student = { classId: q.classId };
    if (q.search)
      where.student = {
        ...(where.student ?? {}),
        OR: [
          { firstName: { contains: q.search, mode: 'insensitive' } },
          { lastName: { contains: q.search, mode: 'insensitive' } },
          { studentId: { contains: q.search, mode: 'insensitive' } },
        ],
      };
    const rows = await this.prisma.db.studentCanteenPlan.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 500,
      include: {
        plan: { select: { id: true, code: true, name: true, type: true, price: true, billingPeriod: true } },
        student: {
          select: {
            id: true,
            studentId: true,
            firstName: true,
            lastName: true,
            class: { select: { name: true } },
            wallet: { select: { balance: true, creditLimit: true } },
          },
        },
      },
    });
    return rows;
  }

  /** Enrols students (explicit ids or a whole class) on a plan; ends any other active enrolment. */
  async enrol(planId: string, dto: EnrolDto) {
    const tenantId = tid();
    const plan = await this.prisma.db.canteenPlan.findUnique({ where: { id: planId } });
    if (!plan || !plan.isActive) throw new NotFoundException('Plan not found or inactive');
    if (dto.classId) {
      const settings = await this.tenants.settings(tenantId);
      if (settings.canteen.exemptClassIds?.includes(dto.classId)) {
        const exemptClass = await this.prisma.db.schoolClass.findUnique({
          where: { id: dto.classId },
          select: { name: true },
        });
        throw new BadRequestException(
          `${exemptClass?.name ?? 'This class'} is exempt from school feeding. Change that under Settings > Rules engine if that's not right.`,
        );
      }
    }
    let studentIds = dto.studentIds ?? [];
    if (dto.classId)
      studentIds = [
        ...studentIds,
        ...(
          await this.prisma.db.student.findMany({
            where: { classId: dto.classId, status: 'ACTIVE' },
            select: { id: true },
          })
        ).map((s) => s.id),
      ];
    studentIds = [...new Set(studentIds)];
    if (!studentIds.length) throw new BadRequestException('Select at least one student or a class');
    const term = dto.termId
      ? await this.prisma.db.term.findUnique({ where: { id: dto.termId } })
      : ((await this.prisma.db.term.findFirst({ where: { isCurrent: true } })) ??
        (await this.prisma.db.term.findFirst({ orderBy: { startDate: 'desc' } })));
    const startDate = dto.startDate ? toDateOnly(dto.startDate) : startOfToday();
    const endDate = dto.endDate
      ? toDateOnly(dto.endDate)
      : plan.billingPeriod === 'TERM' && term
        ? toDateOnly(term.endDate)
        : null;
    const bill = dto.bill ?? (plan.billToFees && Number(plan.price) > 0);
    let enrolled = 0,
      billed = 0;
    const errors: string[] = [];
    for (const studentId of studentIds) {
      try {
        await this.prisma.tenantTx(async (tx) => {
          const student = await tx.student.findUnique({
            where: { id: studentId },
            select: { id: true, studentId: true },
          });
          if (!student) throw new Error('student not found');
          await tx.studentCanteenPlan.updateMany({
            where: { studentId, status: { in: ['ACTIVE', 'SUSPENDED'] } },
            data: { status: 'ENDED', endDate: startOfToday() },
          });
          let invoiceId: string | null = null;
          if (bill && Number(plan.price) > 0 && term) {
            const inv = await this.fees.createAdhocInvoice(tx, {
              studentId,
              termId: term.id,
              dueDate: addDays(new Date(), 7),
              notes: `Canteen plan ${plan.name}`,
              lines: [
                {
                  categoryName: 'Canteen',
                  description: `${plan.name} (${plan.billingPeriod.toLowerCase()})`,
                  amount: Number(plan.price),
                },
              ],
            });
            invoiceId = inv.id;
            billed++;
          }
          let walletCharged = false;
          if (!bill && Number(plan.price) > 0) {
            // School has chosen to charge this plan against the canteen wallet instead of an invoice:
            // one lump-sum debit now for the whole billing period, rather than billing through Fees.
            const price = money(plan.price);
            await tx.wallet.upsert({
              where: { studentId },
              create: { tenantId, studentId },
              update: {},
            });
            await tx.$queryRaw`SELECT "id" FROM "Wallet" WHERE "studentId" = ${studentId} FOR UPDATE`;
            const w = await tx.wallet.findUnique({ where: { studentId } });
            const creditLimit = plan.type === 'CREDIT' ? Number(w.creditLimit ?? plan.creditLimit ?? 0) || null : null;
            const canPay = walletCanPay(Number(w.balance), Number(price), creditLimit, w.isActive);
            if (!canPay.ok) throw new Error(canPay.reason);
            const balanceAfter = money(w.balance.minus(price));
            await tx.wallet.update({ where: { id: w.id }, data: { balance: balanceAfter } });
            await tx.walletTransaction.create({
              data: {
                tenantId,
                walletId: w.id,
                type: 'SUBSCRIPTION',
                amount: price,
                balanceAfter,
                reference: `${plan.name} (${plan.billingPeriod.toLowerCase()})`,
                byId: ctx().userId,
              },
            });
            billed++;
          }
          await tx.studentCanteenPlan.create({
            data: {
              tenantId,
              studentId,
              planId,
              termId: term?.id ?? null,
              startDate,
              endDate,
              invoiceId,
              notes: dto.notes,
              createdById: ctx().userId ?? null,
            },
          });
          // Wallet configuration inherited from the plan
          await tx.wallet.upsert({
            where: { studentId },
            create: {
              tenantId,
              studentId,
              creditLimit: plan.type === 'CREDIT' ? plan.creditLimit : null,
              dailyLimit: plan.dailyLimit,
            },
            update: {
              creditLimit: plan.type === 'CREDIT' ? plan.creditLimit : null,
              dailyLimit: plan.dailyLimit ?? undefined,
            },
          });
          enrolled++;
        });
      } catch (e: any) {
        errors.push(`${studentId}: ${e.message}`);
      }
    }
    await this.audit.log({
      action: 'CANTEEN_PLAN_ENROLLED',
      entity: 'CanteenPlan',
      entityId: planId,
      after: { enrolled, billed, classId: dto.classId, errors: errors.length },
    });
    return { enrolled, billed, errors };
  }

  async setEnrolmentStatus(id: string, status: 'ACTIVE' | 'SUSPENDED' | 'ENDED') {
    const e = await this.prisma.db.studentCanteenPlan.findUnique({ where: { id } });
    if (!e) throw new NotFoundException('Enrolment not found');
    const u = await this.prisma.db.studentCanteenPlan.update({
      where: { id },
      data: { status, endDate: status === 'ENDED' ? startOfToday() : e.endDate },
    });
    if (status === 'ENDED')
      await this.prisma.db.wallet.updateMany({ where: { studentId: e.studentId }, data: { creditLimit: null } });
    await this.audit.log({
      action: `CANTEEN_ENROLMENT_${status}`,
      entity: 'StudentCanteenPlan',
      entityId: id,
      after: { status },
    });
    return u;
  }

  /** The plan currently governing a student's canteen purchases (with today's usage). */
  async activePlanFor(db: Tx | any, studentId: string): Promise<ActivePlan | null> {
    const today = startOfToday();
    const e = await db.studentCanteenPlan.findFirst({
      where: {
        studentId,
        status: 'ACTIVE',
        startDate: { lte: today },
        OR: [{ endDate: null }, { endDate: { gte: today } }],
      },
      orderBy: { createdAt: 'desc' },
      include: { plan: { include: { items: { select: { itemId: true } } } } },
    });
    if (!e) {
      const def = await db.canteenPlan.findFirst({
        where: { tenantId: tid(), isDefault: true, isActive: true },
        include: { items: { select: { itemId: true } } },
      });
      if (!def) return null;
      return { enrolment: null, plan: def, coveredItemIds: def.items.map((i: any) => i.itemId), mealsUsedToday: 0 };
    }
    const used =
      e.plan.type === 'MEAL_PLAN'
        ? await db.canteenSale.aggregate({
            where: { studentId, createdAt: { gte: today }, planId: e.planId },
            _sum: { mealCount: true },
          })
        : null;
    return {
      enrolment: e,
      plan: e.plan,
      coveredItemIds: e.plan.items.map((i: any) => i.itemId),
      mealsUsedToday: used?._sum?.mealCount ?? 0,
    };
  }

  async studentPlan(studentId: string) {
    const active = await this.activePlanFor(this.prisma.db, studentId);
    const history = await this.prisma.db.studentCanteenPlan.findMany({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { plan: { select: { name: true, type: true, price: true, billingPeriod: true } } },
    });
    return {
      active: active
        ? {
            plan: { ...active.plan, items: undefined, coveredItemIds: active.coveredItemIds },
            enrolment: active.enrolment,
            mealsUsedToday: active.mealsUsedToday,
            mealsLeftToday: Math.max(0, (active.plan.mealsPerDay ?? 0) - active.mealsUsedToday),
          }
        : null,
      history,
    };
  }

  /** Overview for the canteen manager: enrolment counts, meals served, revenue per plan. */
  async summary() {
    const db = this.prisma.db;
    const today = startOfToday();
    const [plans, counts, mealsToday, salesByPlan, negative, noPlan] = await Promise.all([
      db.canteenPlan.findMany({ orderBy: { sortOrder: 'asc' } }),
      db.studentCanteenPlan.groupBy({ by: ['planId'], where: { status: 'ACTIVE' }, _count: { _all: true } }),
      db.canteenSale.groupBy({
        by: ['planId'],
        where: { createdAt: { gte: today } },
        _sum: { mealCount: true, coveredAmount: true, total: true },
        _count: { _all: true },
      }),
      db.canteenSale.groupBy({
        by: ['planId'],
        where: { createdAt: { gte: addDays(today, -30) } },
        _sum: { total: true, coveredAmount: true },
      }),
      db.wallet.count({ where: { balance: { lt: 0 } } }),
      db.student.count({ where: { status: 'ACTIVE', canteenPlans: { none: { status: 'ACTIVE' } } } }),
    ]);
    return {
      plans: plans.map((p) => ({
        id: p.id,
        code: p.code,
        name: p.name,
        type: p.type,
        price: p.price,
        billingPeriod: p.billingPeriod,
        isDefault: p.isDefault,
        isActive: p.isActive,
        enrolled: counts.find((c) => c.planId === p.id)?._count._all ?? 0,
        mealsToday: mealsToday.find((m) => m.planId === p.id)?._sum.mealCount ?? 0,
        salesToday: mealsToday.find((m) => m.planId === p.id)?._count._all ?? 0,
        coveredToday: mealsToday.find((m) => m.planId === p.id)?._sum.coveredAmount ?? 0,
        sales30d: salesByPlan.find((m) => m.planId === p.id)?._sum.total ?? 0,
        covered30d: salesByPlan.find((m) => m.planId === p.id)?._sum.coveredAmount ?? 0,
      })),
      walletsInCredit: negative,
      studentsWithoutPlan: noPlan,
    };
  }

  // ─────────────────────────── Allowances ───────────────────────────
  /** Credits allowances that are due. Runs daily at 06:00 and on demand. */
  async runAllowances(): Promise<{ credited: number; amount: number }> {
    const tenantId = tid();
    const now = new Date();
    const isSchoolDay = now.getDay() >= 1 && now.getDay() <= 5;
    const enrolments = await this.prisma.db.studentCanteenPlan.findMany({
      where: { status: 'ACTIVE', plan: { type: 'ALLOWANCE', isActive: true } },
      include: { plan: true, student: { select: { wallet: { select: { lastAllowanceAt: true } } } } },
    });
    let credited = 0,
      amount = 0;
    for (const e of enrolments) {
      if (!allowanceDue(e.plan.allowanceFrequency as any, e.student.wallet?.lastAllowanceAt ?? null, now, isSchoolDay))
        continue;
      await this.prisma.tenantTx(async (tx) => {
        const r = await this.fees.creditWallet(tx, e.studentId, money(e.plan.allowanceAmount ?? 0), {
          type: 'ALLOWANCE',
          reference: `${e.plan.name} allowance`,
        });
        await tx.wallet.update({ where: { id: r.wallet.id }, data: { lastAllowanceAt: now } });
      });
      credited++;
      amount += Number(e.plan.allowanceAmount ?? 0);
    }
    if (credited)
      await this.audit.log({
        action: 'CANTEEN_ALLOWANCES_CREDITED',
        entity: 'CanteenPlan',
        entityId: tenantId,
        after: { credited, amount },
        actorType: 'SYSTEM',
        actorName: ctx().actorName ?? 'scheduler',
      });
    return { credited, amount };
  }

  @Cron('0 6 * * *')
  async allowanceCron() {
    const tenants = await this.prisma.platform.tenant.findMany({ where: { status: 'ACTIVE' }, select: { id: true } });
    for (const t of tenants) {
      await requestContext
        .run({ tenantId: t.id, actorType: 'SYSTEM', actorName: 'scheduler' }, () => this.runAllowances())
        .catch((e) => this.logger.error(`Allowances failed for ${t.id}: ${e.message}`));
    }
  }
}
