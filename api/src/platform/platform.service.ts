import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { TenantCacheService } from '../tenants/tenant-cache.service';
import { AuthService } from '../auth/auth.service';
import { ctx } from '../common/context/request-context';
import { ALL_FEATURES } from '../common/features';
import { addDays, money, nextSequence, pad, paginate, randomPassword } from '../common/utils';
import {
  FeaturesDto,
  ListSchoolsDto,
  MarkPaidDto,
  PlanDto,
  PlatformAuditDto,
  PlatformUserDto,
  SubInvoiceDto,
  SubscriptionUpdateDto,
  UpdateTenantDto,
} from './dto';

@Injectable()
export class PlatformService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private cache: TenantCacheService,
    private auth: AuthService,
  ) {}

  private get db() {
    return this.prisma.platform;
  }

  // ─────────────────────────── Overview ───────────────────────────
  async stats() {
    const db = this.db;
    const since30 = addDays(new Date(), -30);
    const [
      byStatus,
      students,
      staff,
      users,
      subsByStatus,
      subsByPlan,
      revenue,
      recent,
      pendingInvoices,
      openConflicts,
      devices,
      activeToday,
    ] = await Promise.all([
      db.tenant.groupBy({ by: ['status'], _count: { _all: true } }),
      db.student.count({ where: { status: 'ACTIVE' } }),
      db.staff.count({ where: { status: 'ACTIVE' } }),
      db.user.count({ where: { isActive: true } }),
      db.subscription.groupBy({ by: ['status'], _count: { _all: true } }),
      db.subscription.groupBy({ by: ['planId'], _count: { _all: true } }),
      db.subscriptionInvoice.aggregate({ where: { status: 'PAID' }, _sum: { amount: true } }),
      db.tenant.findMany({
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: { id: true, name: true, code: true, slug: true, status: true, createdAt: true, region: true },
      }),
      db.subscriptionInvoice.count({ where: { status: 'PENDING' } }),
      db.syncConflict.count({ where: { status: 'OPEN' } }),
      db.device.findMany({
        where: { lastSeenAt: { gte: since30 } },
        select: { tenantId: true, pendingCount: true, lastSeenAt: true },
      }),
      db.auditLog.findMany({
        where: { action: 'AUTH_LOGIN', createdAt: { gte: addDays(new Date(), -1) } },
        distinct: ['tenantId'],
        select: { tenantId: true },
      }),
    ]);
    const plans = await db.plan.findMany({ select: { id: true, name: true, code: true } });
    const planName = (id: string) => plans.find((p) => p.id === id)?.name ?? id;
    const offlineTenants = new Set(
      devices.filter((d) => d.pendingCount > 0 || d.lastSeenAt < addDays(new Date(), -1)).map((d) => d.tenantId),
    );
    return {
      schools: Object.fromEntries(byStatus.map((s) => [s.status, s._count._all])),
      totals: {
        students,
        staff,
        users,
        schools: byStatus.reduce((a, s) => a + s._count._all, 0),
        activeSchoolsToday: activeToday.filter((a) => a.tenantId).length,
      },
      subscriptions: {
        byStatus: Object.fromEntries(subsByStatus.map((s) => [s.status, s._count._all])),
        byPlan: subsByPlan.map((p) => ({ plan: planName(p.planId), count: p._count._all })),
      },
      revenue: { collected: Number(revenue._sum.amount ?? 0), pendingInvoices },
      sync: { devicesActive30d: devices.length, schoolsWithPendingSync: offlineTenants.size, openConflicts },
      recentSchools: recent,
    };
  }

  // ─────────────────────────── Schools ───────────────────────────
  async listSchools(q: ListSchoolsDto) {
    const { skip, take, page, pageSize } = paginate(q.page, q.pageSize);
    const where: any = {};
    if (q.status) where.status = q.status;
    if (q.planCode) where.subscription = { plan: { code: q.planCode } };
    if (q.search)
      where.OR = [
        { name: { contains: q.search, mode: 'insensitive' } },
        { code: { contains: q.search, mode: 'insensitive' } },
        { slug: { contains: q.search, mode: 'insensitive' } },
        { email: { contains: q.search, mode: 'insensitive' } },
      ];
    const [items, total] = await Promise.all([
      this.db.tenant.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { subscription: { include: { plan: { select: { code: true, name: true, studentLimit: true } } } } },
      }),
      this.db.tenant.count({ where }),
    ]);
    const ids = items.map((t) => t.id);
    const counts = ids.length
      ? await this.db.student.groupBy({
          by: ['tenantId'],
          where: { tenantId: { in: ids }, status: 'ACTIVE' },
          _count: { _all: true },
        })
      : [];
    const countMap = new Map(counts.map((c) => [c.tenantId, c._count._all]));
    return {
      items: items.map(({ settings, websiteConfig, ...t }) => ({ ...t, studentCount: countMap.get(t.id) ?? 0 })),
      total,
      page,
      pageSize,
    };
  }

  async getSchool(id: string) {
    const t = await this.db.tenant.findUnique({
      where: { id },
      include: {
        domains: true,
        subscription: { include: { plan: true, invoices: { orderBy: { createdAt: 'desc' }, take: 12 } } },
      },
    });
    if (!t) throw new NotFoundException('School not found');
    const [students, staff, users, lastLogin, devices, conflicts, audit] = await Promise.all([
      this.db.student.count({ where: { tenantId: id, status: 'ACTIVE' } }),
      this.db.staff.count({ where: { tenantId: id, status: 'ACTIVE' } }),
      this.db.user.count({ where: { tenantId: id, isActive: true } }),
      this.db.auditLog.findFirst({
        where: { tenantId: id, action: 'AUTH_LOGIN' },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
      this.db.device.findMany({ where: { tenantId: id }, orderBy: { lastSeenAt: 'desc' }, take: 20 }),
      this.db.syncConflict.count({ where: { tenantId: id, status: 'OPEN' } }),
      this.db.auditLog.findMany({ where: { tenantId: id }, orderBy: { createdAt: 'desc' }, take: 15 }),
    ]);
    const { settings, websiteConfig, ...rest } = t;
    return {
      ...rest,
      usage: { students, staff, users, lastLoginAt: lastLogin?.createdAt ?? null },
      sync: { devices, openConflicts: conflicts },
      recentAudit: audit,
      allFeatures: ALL_FEATURES,
    };
  }

  async updateSchool(id: string, dto: UpdateTenantDto) {
    const t = await this.db.tenant.update({ where: { id }, data: { ...dto } });
    this.cache.invalidate(id);
    await this.audit.log({
      action: 'PLATFORM_SCHOOL_UPDATED',
      entity: 'Tenant',
      entityId: id,
      tenantId: id,
      after: dto,
    });
    return t;
  }

  async setStatus(id: string, status: 'ACTIVE' | 'SUSPENDED' | 'REJECTED', reason?: string) {
    const before = await this.db.tenant.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('School not found');
    const t = await this.db.tenant.update({
      where: { id },
      data: {
        status,
        approvedAt: status === 'ACTIVE' && !before.approvedAt ? new Date() : before.approvedAt,
        suspendedReason: status === 'SUSPENDED' ? (reason ?? 'Suspended by platform') : null,
      },
    });
    this.cache.invalidate(id);
    await this.audit.log({
      action: `PLATFORM_SCHOOL_${status}`,
      entity: 'Tenant',
      entityId: id,
      tenantId: id,
      before: { status: before.status },
      after: { status },
      reason,
    });
    return t;
  }

  async setFeatures(id: string, dto: FeaturesDto) {
    const bad = dto.featureOverrides.filter((f) => !ALL_FEATURES.includes(f));
    if (bad.length) throw new BadRequestException(`Unknown features: ${bad.join(', ')}`);
    const t = await this.db.tenant.update({
      where: { id },
      data: { featureOverrides: [...new Set(dto.featureOverrides)] },
    });
    this.cache.invalidate(id);
    await this.audit.log({
      action: 'PLATFORM_FEATURES_UPDATED',
      entity: 'Tenant',
      entityId: id,
      tenantId: id,
      after: dto,
    });
    return t.featureOverrides;
  }

  async supportSession(id: string, reason: string) {
    const t = await this.db.tenant.findUnique({ where: { id } });
    if (!t) throw new NotFoundException('School not found');
    return this.auth.supportSessionToken(id, ctx().actorName ?? 'platform', reason);
  }

  // ─────────────────────────── Subscriptions ───────────────────────────
  async updateSubscription(tenantId: string, dto: SubscriptionUpdateDto) {
    const sub = await this.db.subscription.findUnique({ where: { tenantId } });
    if (!sub) throw new NotFoundException('Subscription not found');
    if (dto.planId) {
      const plan = await this.db.plan.findUnique({ where: { id: dto.planId } });
      if (!plan) throw new BadRequestException('Plan not found');
    }
    const updated = await this.db.subscription.update({
      where: { tenantId },
      data: {
        planId: dto.planId,
        status: dto.status as any,
        billingCycle: dto.billingCycle,
        currentPeriodEnd: dto.currentPeriodEnd ? new Date(dto.currentPeriodEnd) : undefined,
        trialEndsAt: dto.trialEndsAt ? new Date(dto.trialEndsAt) : undefined,
        graceUntil: dto.status === 'ACTIVE' ? null : undefined,
      },
      include: { plan: true },
    });
    this.cache.invalidate(tenantId);
    await this.audit.log({
      action: 'PLATFORM_SUBSCRIPTION_UPDATED',
      entity: 'Subscription',
      entityId: sub.id,
      tenantId,
      before: { planId: sub.planId, status: sub.status, currentPeriodEnd: sub.currentPeriodEnd },
      after: dto,
      reason: dto.reason,
    });
    return updated;
  }

  async createSubscriptionInvoice(tenantId: string, dto: SubInvoiceDto) {
    const sub = await this.db.subscription.findUnique({ where: { tenantId }, include: { plan: true } });
    if (!sub) throw new NotFoundException('Subscription not found');
    const cycle = dto.billingCycle ?? sub.billingCycle;
    const amount = money(dto.amount ?? (cycle === 'MONTHLY' ? sub.plan.priceMonthly : sub.plan.priceYearly));
    const periodStart = sub.currentPeriodEnd > new Date() ? sub.currentPeriodEnd : new Date();
    const periodEnd = cycle === 'MONTHLY' ? addMonths(periodStart, 1) : addMonths(periodStart, 12);
    const seq = await nextSequence(this.prisma, 'PLATFORM', 'sub-invoice');
    const inv = await this.db.subscriptionInvoice.create({
      data: {
        tenantId,
        subscriptionId: sub.id,
        number: `SUB-${new Date().getFullYear()}-${pad(seq, 6)}`,
        description: dto.description ?? `${sub.plan.name} plan (${cycle.toLowerCase()})`,
        amount,
        currency: sub.plan.currency,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : addDays(new Date(), 14),
        periodStart,
        periodEnd,
      },
    });
    await this.audit.log({
      action: 'SUBSCRIPTION_INVOICE_CREATED',
      entity: 'SubscriptionInvoice',
      entityId: inv.id,
      tenantId,
      after: { number: inv.number, amount },
    });
    return inv;
  }

  async markInvoicePaid(invoiceId: string, dto: MarkPaidDto) {
    const inv = await this.db.subscriptionInvoice.findUnique({
      where: { id: invoiceId },
      include: { subscription: true },
    });
    if (!inv) throw new NotFoundException('Invoice not found');
    if (inv.status === 'PAID') return inv;
    const planMatch = /\[PLAN:([A-Z0-9_]+)\]/.exec(inv.description);
    const newPlan = planMatch ? await this.db.plan.findUnique({ where: { code: planMatch[1] } }) : null;
    const result = await this.prisma.platformTx(async (tx) => {
      const paid = await tx.subscriptionInvoice.update({
        where: { id: invoiceId },
        data: { status: 'PAID', paidAt: new Date(), reference: dto.reference },
      });
      await tx.subscription.update({
        where: { id: inv.subscriptionId },
        data: {
          status: 'ACTIVE',
          currentPeriodStart: inv.periodStart,
          currentPeriodEnd: inv.periodEnd,
          graceUntil: null,
          planId: newPlan?.id,
        },
      });
      const t = await tx.tenant.findUnique({ where: { id: inv.tenantId } });
      if (t.status === 'SUSPENDED')
        await tx.tenant.update({ where: { id: inv.tenantId }, data: { status: 'ACTIVE', suspendedReason: null } });
      return paid;
    });
    this.cache.invalidate(inv.tenantId);
    await this.audit.log({
      action: 'SUBSCRIPTION_INVOICE_PAID',
      entity: 'SubscriptionInvoice',
      entityId: invoiceId,
      tenantId: inv.tenantId,
      after: { reference: dto.reference },
    });
    return result;
  }

  listSubscriptionInvoices(q: { tenantId?: string; status?: string; page?: number; pageSize?: number }) {
    const { skip, take } = paginate(q.page, q.pageSize);
    const where: any = {};
    if (q.tenantId) where.tenantId = q.tenantId;
    if (q.status) where.status = q.status;
    return this.db.subscriptionInvoice.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        subscription: { select: { tenant: { select: { name: true, code: true } }, plan: { select: { name: true } } } },
      },
    });
  }

  // ─────────────────────────── Plans ───────────────────────────
  plans() {
    return this.db.plan.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { subscriptions: true } } },
    });
  }

  async createPlan(dto: PlanDto) {
    this.validateFeatures(dto.features);
    const plan = await this.db.plan.create({ data: { ...dto, code: dto.code.toUpperCase() } });
    await this.audit.log({ action: 'PLAN_CREATED', entity: 'Plan', entityId: plan.id, tenantId: null, after: dto });
    return plan;
  }

  async updatePlan(id: string, dto: Partial<PlanDto>) {
    if (dto.features) this.validateFeatures(dto.features);
    const before = await this.db.plan.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Plan not found');
    const plan = await this.db.plan.update({ where: { id }, data: { ...dto, code: dto.code?.toUpperCase() } });
    const subs = await this.db.subscription.findMany({ where: { planId: id }, select: { tenantId: true } });
    subs.forEach((s) => this.cache.invalidate(s.tenantId));
    await this.audit.log({ action: 'PLAN_UPDATED', entity: 'Plan', entityId: id, tenantId: null, before, after: dto });
    return plan;
  }

  private validateFeatures(features: string[]) {
    const bad = features.filter((f) => !ALL_FEATURES.includes(f));
    if (bad.length) throw new BadRequestException(`Unknown features: ${bad.join(', ')}`);
  }

  // ─────────────────────────── Platform users ───────────────────────────
  platformUsers() {
    return this.db.platformUser.findMany({ orderBy: { createdAt: 'asc' } });
  }

  async createPlatformUser(dto: PlatformUserDto) {
    const password = dto.password ?? randomPassword();
    const u = await this.db.platformUser.create({
      data: {
        email: dto.email.toLowerCase(),
        name: dto.name,
        role: dto.role ?? 'SUPPORT',
        passwordHash: await bcrypt.hash(password, 10),
      },
    });
    await this.audit.log({
      action: 'PLATFORM_USER_CREATED',
      entity: 'PlatformUser',
      entityId: u.id,
      tenantId: null,
      after: { email: u.email, role: u.role },
    });
    return { ...u, temporaryPassword: dto.password ? undefined : password };
  }

  async updatePlatformUser(id: string, dto: Partial<PlatformUserDto>) {
    if (id === ctx().userId && dto.isActive === false) throw new BadRequestException('You cannot deactivate yourself');
    const data: any = { name: dto.name, role: dto.role, isActive: dto.isActive };
    if (dto.password) data.passwordHash = await bcrypt.hash(dto.password, 10);
    const u = await this.db.platformUser.update({ where: { id }, data });
    await this.audit.log({
      action: 'PLATFORM_USER_UPDATED',
      entity: 'PlatformUser',
      entityId: id,
      tenantId: null,
      after: { name: dto.name, role: dto.role, isActive: dto.isActive },
    });
    return u;
  }

  // ─────────────────────────── Audit & sync overview ───────────────────────────
  async auditLogs(q: PlatformAuditDto) {
    const { skip, take, page, pageSize } = paginate(q.page, q.pageSize);
    const where: any = {};
    if (q.tenantId) where.tenantId = q.tenantId;
    if (q.entity) where.entity = q.entity;
    if (q.actorType) where.actorType = q.actorType;
    if (q.action) where.action = { contains: q.action, mode: 'insensitive' };
    if (q.search)
      where.OR = [{ actorName: { contains: q.search, mode: 'insensitive' } }, { entityId: { contains: q.search } }];
    const [items, total] = await Promise.all([
      this.db.auditLog.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
      this.db.auditLog.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async syncOverview() {
    const devices = await this.db.device.findMany({ where: { isActive: true }, orderBy: { lastSeenAt: 'desc' } });
    const tenants = await this.db.tenant.findMany({
      where: { id: { in: [...new Set(devices.map((d) => d.tenantId))] } },
      select: { id: true, name: true, code: true },
    });
    const conflicts = await this.db.syncConflict.groupBy({
      by: ['tenantId'],
      where: { status: 'OPEN' },
      _count: { _all: true },
    });
    const failed = await this.db.syncOperation.groupBy({
      by: ['tenantId'],
      where: { status: 'FAILED', createdAt: { gte: addDays(new Date(), -7) } },
      _count: { _all: true },
    });
    return tenants.map((t) => {
      const ds = devices.filter((d) => d.tenantId === t.id);
      return {
        tenant: t,
        devices: ds.length,
        pendingOperations: ds.reduce((a, d) => a + d.pendingCount, 0),
        offlineDevices: ds.filter((d) => d.lastSeenAt < addDays(new Date(), -1)).length,
        openConflicts: conflicts.find((c) => c.tenantId === t.id)?._count._all ?? 0,
        failedOps7d: failed.find((c) => c.tenantId === t.id)?._count._all ?? 0,
        lastSeenAt: ds[0]?.lastSeenAt ?? null,
      };
    });
  }
}

function addMonths(d: Date, months: number) {
  const r = new Date(d);
  r.setUTCMonth(r.getUTCMonth() + months);
  return r;
}
