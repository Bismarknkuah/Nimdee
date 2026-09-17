import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { TenantCacheService } from '../tenants/tenant-cache.service';
import { tid } from '../common/context/request-context';
import { addDays, money, nextSequence, pad } from '../common/utils';

const GRACE_DAYS = 14;

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private cache: TenantCacheService,
  ) {}

  /** School-facing view of its own subscription, usage and invoices. */
  async mine() {
    const tenantId = tid();
    const [snap, sub, students, staff, plans] = await Promise.all([
      this.cache.get(tenantId),
      this.prisma.db.subscription.findUnique({
        where: { tenantId },
        include: { plan: true, invoices: { orderBy: { createdAt: 'desc' }, take: 24 } },
      }),
      this.prisma.db.student.count({ where: { status: 'ACTIVE' } }),
      this.prisma.db.staff.count({ where: { status: 'ACTIVE' } }),
      this.prisma.platform.plan.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } }),
    ]);
    const daysLeft = sub ? Math.ceil((sub.currentPeriodEnd.getTime() - Date.now()) / 86400000) : null;
    return {
      subscription: sub,
      usage: {
        students,
        staff,
        studentLimit: sub?.plan.studentLimit ?? 0,
        studentUsagePercent: sub?.plan.studentLimit ? Math.round((students / sub.plan.studentLimit) * 100) : 0,
      },
      daysLeft,
      features: snap?.features ?? [],
      plans,
      schoolStatus: snap?.status,
    };
  }

  /** Requests a plan change: a pending invoice is issued; the plan switches when the platform marks it paid. */
  async requestChange(planCode: string, billingCycle: 'MONTHLY' | 'YEARLY') {
    const tenantId = tid();
    const plan = await this.prisma.platform.plan.findFirst({ where: { code: planCode.toUpperCase(), isActive: true } });
    if (!plan) throw new BadRequestException('Plan not found');
    const sub = await this.prisma.db.subscription.findUnique({ where: { tenantId }, include: { plan: true } });
    if (!sub) throw new BadRequestException('No subscription found');
    const pending = await this.prisma.db.subscriptionInvoice.findFirst({ where: { tenantId, status: 'PENDING' } });
    if (pending)
      throw new BadRequestException(
        `Invoice ${pending.number} is still pending. Settle it before requesting another change.`,
      );
    const amount = money(billingCycle === 'MONTHLY' ? plan.priceMonthly : plan.priceYearly);
    const periodStart = sub.currentPeriodEnd > new Date() && sub.planId === plan.id ? sub.currentPeriodEnd : new Date();
    const periodEnd = new Date(periodStart);
    periodEnd.setUTCMonth(periodEnd.getUTCMonth() + (billingCycle === 'MONTHLY' ? 1 : 12));
    const seq = await nextSequence(this.prisma, 'PLATFORM', 'sub-invoice');
    const inv = await this.prisma.db.subscriptionInvoice.create({
      data: {
        tenantId,
        subscriptionId: sub.id,
        number: `SUB-${new Date().getFullYear()}-${pad(seq, 6)}`,
        description: `${plan.name} plan (${billingCycle.toLowerCase()}) [PLAN:${plan.code}]`,
        amount,
        currency: plan.currency,
        dueDate: addDays(new Date(), 7),
        periodStart,
        periodEnd,
      },
    });
    await this.prisma.db.subscription.update({ where: { tenantId }, data: { billingCycle } });
    await this.audit.log({
      action: 'SUBSCRIPTION_CHANGE_REQUESTED',
      entity: 'Subscription',
      entityId: sub.id,
      after: { plan: plan.code, billingCycle, invoice: inv.number },
    });
    const bank = (await this.cache.get(tenantId))?.settings;
    return {
      invoice: inv,
      instructions:
        'Pay this invoice to the platform (bank transfer or mobile money) and quote the invoice number. Your plan is upgraded as soon as the payment is confirmed.',
      bankDetails: process.env.PLATFORM_BANK_DETAILS ?? null,
      currency: plan.currency,
      note: bank ? undefined : undefined,
    };
  }

  /** Daily lifecycle: trial → grace → suspended; renewal reminders. */
  @Cron('0 2 * * *')
  async lifecycle() {
    const now = new Date();
    const subs = await this.prisma.platform.subscription.findMany({
      where: { status: { in: ['TRIAL', 'ACTIVE', 'PAST_DUE', 'GRACE'] } },
      include: { tenant: { select: { id: true, name: true, status: true } } },
    });
    let changed = 0;
    for (const s of subs) {
      let next: any = null;
      if (s.status === 'TRIAL' && s.trialEndsAt && s.trialEndsAt < now)
        next = { status: 'GRACE', graceUntil: addDays(now, GRACE_DAYS) };
      else if (s.status === 'ACTIVE' && s.currentPeriodEnd < now)
        next = { status: 'PAST_DUE', graceUntil: addDays(now, GRACE_DAYS) };
      else if ((s.status === 'GRACE' || s.status === 'PAST_DUE') && s.graceUntil && s.graceUntil < now)
        next = { status: 'SUSPENDED' };
      if (next) {
        await this.prisma.platform.subscription.update({ where: { id: s.id }, data: next });
        if (next.status === 'SUSPENDED' && s.tenant.status === 'ACTIVE')
          await this.prisma.platform.tenant.update({
            where: { id: s.tenantId },
            data: {
              status: 'SUSPENDED',
              suspendedReason: 'Subscription expired. Settle the outstanding invoice to reactivate.',
            },
          });
        this.cache.invalidate(s.tenantId);
        await this.audit.log({
          action: `SUBSCRIPTION_${next.status}`,
          entity: 'Subscription',
          entityId: s.id,
          tenantId: s.tenantId,
          before: { status: s.status },
          after: next,
          actorType: 'SYSTEM',
          actorName: 'scheduler',
        });
        changed++;
        await this.notifyAdmins(
          s.tenantId,
          `Subscription ${next.status.toLowerCase().replace('_', ' ')}`,
          next.status === 'SUSPENDED'
            ? 'Your school has been suspended because the subscription expired. Settle the invoice to reactivate.'
            : `Your subscription is in ${next.status.toLowerCase()} — please renew within ${GRACE_DAYS} days to avoid interruption.`,
        );
      } else if (s.status === 'ACTIVE' || s.status === 'TRIAL') {
        const end = s.status === 'TRIAL' ? s.trialEndsAt : s.currentPeriodEnd;
        const daysLeft = end ? Math.ceil((end.getTime() - now.getTime()) / 86400000) : null;
        if (daysLeft === 7 || daysLeft === 1)
          await this.notifyAdmins(
            s.tenantId,
            `${s.status === 'TRIAL' ? 'Trial' : 'Subscription'} ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`,
            'Visit Settings → Subscription to renew or change your plan.',
          );
      }
    }
    if (changed) this.logger.log(`Subscription lifecycle updated ${changed} subscription(s)`);
  }

  private async notifyAdmins(tenantId: string, title: string, body: string) {
    try {
      const db = this.prisma.forTenant(tenantId);
      const admins = await db.user.findMany({
        where: {
          isActive: true,
          roles: { some: { role: { permissions: { hasSome: ['*', 'SUBSCRIPTION_MANAGE'] } } } },
        },
        select: { id: true },
      });
      if (admins.length)
        await db.notification.createMany({
          data: admins.map((u) => ({ tenantId, userId: u.id, title, body, type: 'SUBSCRIPTION' })),
        });
    } catch {
      /* best-effort */
    }
  }
}
