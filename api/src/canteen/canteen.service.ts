import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { TenantCacheService } from '../tenants/tenant-cache.service';
import { FeesService } from '../fees/fees.service';
import { ctx, tid } from '../common/context/request-context';
import { addDays, money, startOfToday, toDateOnly, zero } from '../common/utils';
import { CanteenItemDto, SaleDto, StockDto, TopUpDto, WalletSettingsDto } from './dto';
import { settleSale, walletCanPay, withinDailyLimit } from './plan-rules';
import { CanteenPlansService } from './plans.service';

@Injectable()
export class CanteenService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private tenants: TenantCacheService,
    private fees: FeesService,
    private plans: CanteenPlansService,
  ) {}

  // ─────────────────────────── Items & stock ───────────────────────────
  items(includeInactive = false) {
    return this.prisma.db.canteenItem.findMany({
      where: includeInactive ? undefined : { isActive: true },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
  }
  async createItem(dto: CanteenItemDto) {
    const item = await this.prisma.tenantTx(async (tx) => {
      const it = await tx.canteenItem.create({
        data: {
          tenantId: tid(),
          name: dto.name.trim(),
          category: dto.category ?? 'FOOD',
          price: money(dto.price),
          stock: dto.stock ?? 0,
          minStock: dto.minStock ?? 0,
          unit: dto.unit ?? 'unit',
          isActive: dto.isActive ?? true,
        },
      });
      if (dto.stock)
        await tx.stockMovement.create({
          data: {
            tenantId: tid(),
            itemId: it.id,
            type: 'IN',
            quantity: dto.stock,
            reason: 'Opening stock',
            byId: ctx().userId,
          },
        });
      return it;
    });
    await this.audit.log({ action: 'CANTEEN_ITEM_CREATED', entity: 'CanteenItem', entityId: item.id, after: dto });
    return item;
  }
  updateItem(id: string, dto: Partial<CanteenItemDto>) {
    const { stock, ...rest } = dto;
    return this.prisma.db.canteenItem.update({
      where: { id },
      data: { ...rest, name: rest.name?.trim(), price: rest.price !== undefined ? money(rest.price) : undefined },
    });
  }
  async adjustStock(id: string, dto: StockDto) {
    if (dto.quantity === 0) throw new BadRequestException('Quantity cannot be zero');
    const r = await this.prisma.tenantTx(async (tx) => {
      const item = await tx.canteenItem.findUnique({ where: { id } });
      if (!item) throw new NotFoundException('Item not found');
      const delta =
        dto.type === 'IN' ? Math.abs(dto.quantity) : dto.type === 'WASTE' ? -Math.abs(dto.quantity) : dto.quantity;
      if (item.stock + delta < 0) throw new BadRequestException(`Stock cannot go below zero (current ${item.stock})`);
      const updated = await tx.canteenItem.update({ where: { id }, data: { stock: { increment: delta } } });
      await tx.stockMovement.create({
        data: { tenantId: tid(), itemId: id, type: dto.type, quantity: delta, reason: dto.reason, byId: ctx().userId },
      });
      return updated;
    });
    await this.audit.log({ action: 'CANTEEN_STOCK_ADJUSTED', entity: 'CanteenItem', entityId: id, after: dto });
    return r;
  }
  movements(itemId: string) {
    return this.prisma.db.stockMovement.findMany({ where: { itemId }, orderBy: { createdAt: 'desc' }, take: 100 });
  }
  lowStock() {
    return this.prisma.db.canteenItem.findMany({
      where: { isActive: true, stock: { lte: this.prisma.canteenItem.fields.minStock } },
      orderBy: { stock: 'asc' },
      select: { id: true, name: true, stock: true, minStock: true, unit: true },
    });
  }

  // ─────────────────────────── Wallets ───────────────────────────
  async wallet(studentId: string) {
    const student = await this.prisma.db.student.findUnique({
      where: { id: studentId },
      select: {
        id: true,
        studentId: true,
        firstName: true,
        lastName: true,
        class: { select: { name: true } },
        photoUrl: true,
      },
    });
    if (!student) throw new NotFoundException('Student not found');
    const [w, settings, plan] = await Promise.all([
      this.prisma.db.wallet.findUnique({
        where: { studentId },
        include: { transactions: { orderBy: { createdAt: 'desc' }, take: 50 } },
      }),
      this.tenants.settings(tid()),
      this.plans.activePlanFor(this.prisma.db, studentId),
    ]);
    const spentToday = w
      ? await this.prisma.db.walletTransaction.aggregate({
          where: { walletId: w.id, type: 'PURCHASE', createdAt: { gte: startOfToday() } },
          _sum: { amount: true },
        })
      : null;
    const spent7d = w
      ? await this.prisma.db.walletTransaction.aggregate({
          where: { walletId: w.id, type: 'PURCHASE', createdAt: { gte: addDays(startOfToday(), -6) } },
          _sum: { amount: true },
        })
      : null;
    return {
      student,
      wallet: w ?? { balance: 0, isActive: true, dailyLimit: null, creditLimit: null, transactions: [] },
      spentToday: spentToday?._sum.amount ?? 0,
      spent7d: spent7d?._sum.amount ?? 0,
      defaultDailyLimit: settings.canteen.defaultDailyLimit,
      plan: plan
        ? {
            id: plan.plan.id,
            name: plan.plan.name,
            type: plan.plan.type,
            mealsPerDay: plan.plan.mealsPerDay,
            mealsUsedToday: plan.mealsUsedToday,
            coveredItemIds: plan.coveredItemIds,
            creditLimit: plan.plan.creditLimit,
            dailyLimit: plan.plan.dailyLimit,
            isDefault: !plan.enrolment,
          }
        : null,
    };
  }
  async topUp(studentId: string, dto: TopUpDto) {
    const amount = money(dto.amount);
    const r = await this.prisma.tenantTx(async (tx) => {
      const s = await tx.student.findUnique({ where: { id: studentId } });
      if (!s) throw new NotFoundException('Student not found');
      return this.fees.creditWallet(tx, studentId, amount, {
        type: 'TOPUP',
        method: dto.method ?? 'CASH',
        reference: dto.reference,
      });
    });
    await this.audit.log({
      action: 'WALLET_TOPUP',
      entity: 'Wallet',
      entityId: r.wallet.id,
      after: { studentId, amount: Number(amount), method: dto.method },
    });
    await this.fees.notifyGuardians(
      studentId,
      'Canteen wallet topped up',
      `${Number(amount).toFixed(2)} was added to the canteen wallet. New balance: ${Number(r.wallet.balance).toFixed(2)}.`,
    );
    return r;
  }
  async walletSettings(studentId: string, dto: WalletSettingsDto) {
    return this.prisma.db.wallet.upsert({
      where: { studentId },
      create: {
        tenantId: tid(),
        studentId,
        dailyLimit: dto.dailyLimit === null || dto.dailyLimit === undefined ? null : money(dto.dailyLimit),
        isActive: dto.isActive ?? true,
      },
      update: {
        dailyLimit: dto.dailyLimit === undefined ? undefined : dto.dailyLimit === null ? null : money(dto.dailyLimit),
        isActive: dto.isActive,
      },
    });
  }

  // ─────────────────────────── Point of sale ───────────────────────────
  /**
   * Records a sale. The student's canteen plan decides how it is settled:
   * meal plans absorb covered meals, credit plans may drive the wallet negative up to the limit,
   * pay-as-you-go students pay cash, prepaid/allowance students pay from their wallet.
   */
  async sell(dto: SaleDto) {
    if (dto.paymentMode === 'WALLET' && !dto.studentId) throw new BadRequestException('Wallet sales need a student');
    const settings = await this.tenants.settings(tid());
    const sale = await this.prisma.tenantTx(async (tx) => {
      const tenantId = tid();
      const ids = [...new Set(dto.items.map((i) => i.itemId))];
      const items = await tx.canteenItem.findMany({ where: { id: { in: ids }, isActive: true } });
      const lines = dto.items.map((l) => {
        const item = items.find((i) => i.id === l.itemId);
        if (!item) throw new BadRequestException('One of the items is unavailable');
        if (!settings.canteen.allowNegativeStock && item.stock < l.quantity)
          throw new BadRequestException({
            code: 'INSUFFICIENT_STOCK',
            message: `Only ${item.stock} ${item.unit}(s) of ${item.name} left`,
          });
        return {
          itemId: item.id,
          name: item.name,
          quantity: l.quantity,
          price: Number(item.price),
          total: Number(money(item.price).mul(l.quantity)),
        };
      });
      const total = money(lines.reduce((a, l) => a + l.total, 0));
      const active = dto.studentId ? await this.plans.activePlanFor(tx, dto.studentId) : null;
      const planCtx = active
        ? {
            type: active.plan.type,
            mealsPerDay: active.plan.mealsPerDay,
            coveredItemIds: active.coveredItemIds,
            mealsUsedToday: active.mealsUsedToday,
            creditLimit: active.plan.creditLimit == null ? null : Number(active.plan.creditLimit),
            dailyLimit: active.plan.dailyLimit == null ? null : Number(active.plan.dailyLimit),
          }
        : null;
      const settlement = settleSale(lines, planCtx, dto.paymentMode);
      if (settlement.mode === 'CASH' && dto.paymentMode === 'WALLET' && settlement.reason)
        throw new BadRequestException({ code: 'PLAN_CASH_ONLY', message: settlement.reason });
      const chargeable = money(settlement.chargeable);
      let balanceAfter: Prisma.Decimal | null = null;
      const s = await tx.canteenSale.create({
        data: {
          tenantId,
          studentId: dto.studentId ?? null,
          cashierId: ctx().userId,
          items: lines,
          total,
          coveredAmount: money(settlement.coveredAmount),
          mealCount: settlement.mealCount,
          planId: active?.plan?.id ?? null,
          paymentMode: settlement.mode,
        },
      });
      if ((settlement.mode === 'WALLET' || settlement.mode === 'CREDIT') && chargeable.gt(0)) {
        await tx.wallet.upsert({
          where: { studentId: dto.studentId },
          create: { tenantId, studentId: dto.studentId },
          update: {},
        });
        await tx.$queryRaw`SELECT "id" FROM "Wallet" WHERE "studentId" = ${dto.studentId} FOR UPDATE`;
        const w = await tx.wallet.findUnique({ where: { studentId: dto.studentId } });
        const creditLimit =
          settlement.mode === 'CREDIT' ? Number(w.creditLimit ?? planCtx?.creditLimit ?? 0) || null : null;
        const can = walletCanPay(Number(w.balance), Number(chargeable), creditLimit, w.isActive);
        if (!can.ok)
          throw new BadRequestException({
            code: creditLimit ? 'CREDIT_LIMIT' : 'INSUFFICIENT_BALANCE',
            message: can.reason,
          });
        const spent = await tx.walletTransaction.aggregate({
          where: { walletId: w.id, type: 'PURCHASE', createdAt: { gte: startOfToday() } },
          _sum: { amount: true },
        });
        const dl = withinDailyLimit(
          Number(spent._sum.amount ?? 0),
          Number(chargeable),
          w.dailyLimit == null ? null : Number(w.dailyLimit),
          planCtx?.dailyLimit ?? null,
          settings.canteen.defaultDailyLimit ?? null,
        );
        if (!dl.ok)
          throw new BadRequestException({
            code: 'DAILY_LIMIT',
            message: `Daily spending limit of ${dl.limit?.toFixed(2)} would be exceeded`,
          });
        balanceAfter = money(w.balance.minus(chargeable));
        await tx.wallet.update({ where: { id: w.id }, data: { balance: balanceAfter } });
        await tx.walletTransaction.create({
          data: {
            tenantId,
            walletId: w.id,
            type: 'PURCHASE',
            amount: chargeable,
            balanceAfter,
            saleId: s.id,
            byId: ctx().userId,
          },
        });
      }
      for (const l of lines) {
        await tx.canteenItem.update({ where: { id: l.itemId }, data: { stock: { decrement: l.quantity } } });
        await tx.stockMovement.create({
          data: {
            tenantId,
            itemId: l.itemId,
            type: 'OUT',
            quantity: -l.quantity,
            reason: 'Sale',
            refId: s.id,
            byId: ctx().userId,
          },
        });
      }
      return { ...s, balanceAfter, settlement };
    });
    return sale;
  }

  sales(date?: string) {
    const day = date ? toDateOnly(date) : startOfToday();
    return this.prisma.db.canteenSale.findMany({
      where: { createdAt: { gte: day, lt: addDays(day, 1) } },
      orderBy: { createdAt: 'desc' },
      take: 300,
    });
  }

  /**
   * Marks a meal-plan student as having eaten today, no menu items or price involved. The plan's fee
   * was already collected up front (an invoice or a wallet debit at enrolment), so this is attendance,
   * not a sale: it reuses CanteenSale purely so the existing mealsUsedToday count in plans.service.ts
   * (which already sums CanteenSale.mealCount for today) sees it and stops the same student checking in
   * twice for a one-meal-a-day plan.
   */
  async checkIn(studentId: string) {
    const tenantId = tid();
    const active = await this.plans.activePlanFor(this.prisma.db, studentId);
    if (!active || active.plan.type !== 'MEAL_PLAN')
      throw new BadRequestException('This student has no active meal plan');
    const remaining = active.plan.mealsPerDay - active.mealsUsedToday;
    if (remaining <= 0)
      throw new BadRequestException(`Already checked in for all ${active.plan.mealsPerDay} meal(s) today`);
    const s = await this.prisma.db.canteenSale.create({
      data: {
        tenantId,
        studentId,
        cashierId: ctx().userId,
        items: [],
        total: zero(),
        coveredAmount: zero(),
        mealCount: 1,
        planId: active.plan.id,
        paymentMode: 'MEAL_PLAN',
      },
    });
    return { checkedIn: true, planName: active.plan.name, remainingToday: remaining - 1, saleId: s.id };
  }

  /** Today's meal-plan roster for the check-in screen, optionally scoped to one class. */
  async mealPlanRoster(classId?: string) {
    const today = startOfToday();
    const enrolments = await this.prisma.db.studentCanteenPlan.findMany({
      where: {
        status: 'ACTIVE',
        plan: { type: 'MEAL_PLAN' },
        startDate: { lte: today },
        OR: [{ endDate: null }, { endDate: { gte: today } }],
        ...(classId ? { student: { classId } } : {}),
      },
      include: {
        student: { select: { id: true, studentId: true, firstName: true, lastName: true, class: { select: { id: true, name: true } }, photoUrl: true } },
        plan: { select: { id: true, name: true, mealsPerDay: true } },
      },
      orderBy: [{ student: { firstName: 'asc' } }],
    });
    const checkedIn = await this.prisma.db.canteenSale.groupBy({
      by: ['studentId'],
      where: { createdAt: { gte: today }, studentId: { in: enrolments.map((e) => e.studentId) } },
      _sum: { mealCount: true },
    });
    const usedMap = new Map(checkedIn.map((c) => [c.studentId, c._sum.mealCount ?? 0]));
    return enrolments.map((e) => ({
      studentId: e.student.id,
      student: e.student,
      planName: e.plan.name,
      mealsPerDay: e.plan.mealsPerDay,
      mealsUsedToday: usedMap.get(e.studentId) ?? 0,
      checkedIn: (usedMap.get(e.studentId) ?? 0) >= e.plan.mealsPerDay,
    }));
  }

  async summary(date?: string) {
    const day = date ? toDateOnly(date) : startOfToday();
    const db = this.prisma.db;
    const [sales, low, topups, week, wallets, negative, hourly] = await Promise.all([
      db.canteenSale.findMany({
        where: { createdAt: { gte: day, lt: addDays(day, 1) } },
        select: {
          total: true,
          coveredAmount: true,
          mealCount: true,
          paymentMode: true,
          items: true,
          studentId: true,
          createdAt: true,
        },
      }),
      this.lowStock(),
      db.walletTransaction.aggregate({
        where: { type: 'TOPUP', createdAt: { gte: day, lt: addDays(day, 1) } },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      db.canteenSale.groupBy({
        by: ['paymentMode'],
        where: { createdAt: { gte: addDays(day, -6), lt: addDays(day, 1) } },
        _sum: { total: true },
        _count: { _all: true },
      }),
      db.wallet.aggregate({ _sum: { balance: true }, _count: { _all: true } }),
      db.wallet.count({ where: { balance: { lt: 0 } } }),
      db.canteenSale.findMany({
        where: { createdAt: { gte: addDays(day, -6), lt: addDays(day, 1) } },
        select: { createdAt: true, total: true },
      }),
    ]);
    const itemTotals = new Map<string, { name: string; quantity: number; revenue: number }>();
    for (const s of sales)
      for (const l of (s.items as any[]) ?? []) {
        const cur = itemTotals.get(l.itemId) ?? { name: l.name, quantity: 0, revenue: 0 };
        cur.quantity += l.quantity;
        cur.revenue += l.total;
        itemTotals.set(l.itemId, cur);
      }
    const sum = (f: (s: any) => boolean) => sales.filter(f).reduce((a, s) => a.plus(s.total), zero());
    const byHour = Array.from({ length: 12 }, (_, i) => ({
      hour: `${String(i + 7).padStart(2, '0')}:00`,
      sales: 0,
      amount: 0,
    }));
    for (const s of sales) {
      const h = s.createdAt.getUTCHours() - 7;
      if (h >= 0 && h < 12) {
        byHour[h].sales++;
        byHour[h].amount += Number(s.total);
      }
    }
    const dailyMap = new Map<string, number>();
    for (const s of hourly) {
      const d = s.createdAt.toISOString().slice(0, 10);
      dailyMap.set(d, (dailyMap.get(d) ?? 0) + Number(s.total));
    }
    return {
      date: day.toISOString().slice(0, 10),
      salesCount: sales.length,
      revenue: sum(() => true),
      wallet: sum((s) => s.paymentMode === 'WALLET'),
      cash: sum((s) => s.paymentMode === 'CASH'),
      credit: sum((s) => s.paymentMode === 'CREDIT'),
      mealPlanCovered: sales.reduce((a, s) => a.plus(s.coveredAmount), zero()),
      mealsServed: sales.reduce((a, s) => a + s.mealCount, 0),
      uniqueStudents: new Set(sales.map((s) => s.studentId).filter(Boolean)).size,
      topItems: [...itemTotals.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 8),
      lowStock: low,
      topUpsToday: { amount: topups._sum.amount ?? 0, count: topups._count._all },
      last7Days: week.map((w) => ({ mode: w.paymentMode, amount: w._sum.total ?? 0, count: w._count._all })),
      daily7: [...dailyMap.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, amount]) => ({ date, amount })),
      byHour,
      wallets: { count: wallets._count._all, totalBalance: wallets._sum.balance ?? 0, inCredit: negative },
    };
  }
}
