import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { TenantCacheService } from '../tenants/tenant-cache.service';
import { ProvidersService } from '../communications/providers.service';
import { templates } from '../communications/templates';
import { requestContext, tid } from '../common/context/request-context';
import { addDays, fmtMoney, isoDate, startOfToday } from '../common/utils';

export interface ReminderOptions {
  termId?: string;
  classId?: string;
  studentIds?: string[];
  channels?: Array<'IN_APP' | 'SMS' | 'EMAIL'>;
  onlyOverdue?: boolean;
  minBalance?: number;
}

/** Fee reminders to guardians — on demand from the finance screens and automatically before installments fall due. */
@Injectable()
export class FeeRemindersService {
  private readonly logger = new Logger(FeeRemindersService.name);
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private tenants: TenantCacheService,
    private providers: ProvidersService,
  ) {}

  async send(opts: ReminderOptions) {
    const db = this.prisma.db;
    const snap = await this.tenants.get(tid());
    const channels = opts.channels?.length ? opts.channels : ['IN_APP', 'SMS'];
    const where: any = { status: { in: opts.onlyOverdue ? ['OVERDUE'] : ['ISSUED', 'PARTIALLY_PAID', 'OVERDUE'] } };
    if (opts.termId) where.termId = opts.termId;
    if (opts.classId) where.student = { classId: opts.classId };
    if (opts.studentIds?.length) where.studentId = { in: opts.studentIds };
    const invoices = await db.invoice.findMany({
      where,
      include: {
        student: {
          include: {
            class: { select: { name: true } },
            guardians: { include: { guardian: { include: { user: { select: { id: true, email: true } } } } } },
          },
        },
        installments: { where: { status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] } }, orderBy: { sequence: 'asc' } },
      },
    });
    const brand = {
      name: snap.name,
      primaryColor: snap.primaryColor,
      logoUrl: snap.logoUrl,
      portalUrl: process.env.WEB_APP_URL,
    };
    let notified = 0,
      sms = 0,
      emails = 0,
      skipped = 0;
    const smsQueue: Array<{ to: string; text: string }> = [];
    const emailQueue: Array<{ to: string; subject: string; text: string; html: string }> = [];
    const notifications: any[] = [];
    for (const inv of invoices) {
      const balance = Number(inv.total) - Number(inv.paidTotal);
      if (balance <= 0 || (opts.minBalance && balance < opts.minBalance)) {
        skipped++;
        continue;
      }
      const next = inv.installments[0];
      const t = templates.feeReminder(brand, {
        student: `${inv.student.firstName} ${inv.student.lastName}`,
        invoice: inv.number,
        balance: fmtMoney(balance, snap.currency),
        dueDate: isoDate(inv.dueDate),
        nextInstallment: next
          ? `${fmtMoney(Number(next.amount) - Number(next.paidAmount), snap.currency)} by ${isoDate(next.dueDate)}`
          : undefined,
        url: brand.portalUrl ? `${brand.portalUrl}/school` : undefined,
        overdue: inv.status === 'OVERDUE',
      });
      for (const link of inv.student.guardians) {
        const g = link.guardian;
        if (channels.includes('IN_APP') && g.user?.id)
          notifications.push({
            tenantId: tid(),
            userId: g.user.id,
            title: t.subject,
            body: t.text.slice(0, 500),
            type: 'FINANCE',
            data: { invoiceId: inv.id, studentId: inv.studentId },
          });
        if (channels.includes('SMS') && g.phone && snap.settings.communication.smsEnabled !== false)
          smsQueue.push({ to: g.phone, text: t.text });
        if (channels.includes('EMAIL') && (g.email || g.user?.email))
          emailQueue.push({ to: (g.email ?? g.user?.email) as string, subject: t.subject, text: t.text, html: t.html });
      }
      notified++;
    }
    if (notifications.length) await db.notification.createMany({ data: notifications });
    // group SMS by identical text is not possible per recipient; send in small batches
    for (const m of smsQueue) {
      const r = await this.providers.sendSms([m.to], m.text, snap.settings.communication.smsSenderId);
      sms += r.sent;
    }
    for (const m of emailQueue) {
      const r = await this.providers.sendEmail([m.to], m.subject, m.text, m.html);
      emails += r.sent;
    }
    await this.audit.log({
      action: 'FEE_REMINDERS_SENT',
      entity: 'Invoice',
      entityId: opts.termId ?? 'all',
      after: {
        invoices: notified,
        skipped,
        inApp: notifications.length,
        sms,
        emails,
        channels,
        onlyOverdue: !!opts.onlyOverdue,
      },
    });
    return { invoices: notified, skipped, inApp: notifications.length, sms, emails };
  }

  /** 08:00 daily: remind guardians of installments due in 3 days (in-app + SMS when enabled). */
  @Cron('0 8 * * *')
  async upcomingInstallments() {
    const tenants = await this.prisma.platform.tenant.findMany({ where: { status: 'ACTIVE' }, select: { id: true } });
    for (const t of tenants) {
      await requestContext.run({ tenantId: t.id, actorType: 'SYSTEM', actorName: 'scheduler' }, async () => {
        const due = await this.prisma.db.installment.findMany({
          where: {
            status: { in: ['PENDING', 'PARTIAL'] },
            dueDate: { gte: addDays(startOfToday(), 3), lt: addDays(startOfToday(), 4) },
            invoice: { status: { not: 'CANCELLED' } },
          },
          select: { invoice: { select: { studentId: true } } },
        });
        const studentIds = [...new Set(due.map((d) => d.invoice.studentId))];
        if (studentIds.length)
          await this.send({ studentIds, channels: ['IN_APP', 'SMS'] }).catch((e) => this.logger.error(e.message));
      });
    }
  }
}
