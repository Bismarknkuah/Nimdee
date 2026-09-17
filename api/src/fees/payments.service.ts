import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { createHmac } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { TenantCacheService } from '../tenants/tenant-cache.service';
import { ctx, requestContext, tid } from '../common/context/request-context';
import { money, randomToken } from '../common/utils';
import { InitiateOnlineDto } from './dto';
import { FeesService } from './fees.service';

const PAYSTACK = 'https://api.paystack.co';

/** Online payments through Paystack (school-level keys override the platform key). */
@Injectable()
export class PaymentsGatewayService {
  private readonly logger = new Logger(PaymentsGatewayService.name);
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private tenants: TenantCacheService,
    private fees: FeesService,
  ) {}

  private async secretFor(tenantId: string) {
    const s = await this.tenants.settings(tenantId);
    return s.finance.paystackSecretKey || process.env.PAYSTACK_SECRET_KEY || '';
  }

  async initiate(dto: InitiateOnlineDto) {
    const tenantId = tid();
    const snap = await this.tenants.get(tenantId);
    const secret = await this.secretFor(tenantId);
    if (!secret)
      throw new BadRequestException({
        code: 'PAYMENTS_NOT_CONFIGURED',
        message: 'Online payments are not configured for this school yet.',
      });
    const student = await this.prisma.db.student.findUnique({ where: { id: dto.studentId } });
    if (!student) throw new NotFoundException('Student not found');
    if (dto.invoiceId) {
      const inv = await this.prisma.db.invoice.findUnique({ where: { id: dto.invoiceId } });
      if (!inv || inv.studentId !== student.id)
        throw new BadRequestException('Invoice does not belong to this student');
    }
    const amount = money(dto.amount);
    const reference = `SOS-${snap.code.replace(/[^A-Z0-9]/g, '')}-${Date.now().toString(36).toUpperCase()}${randomToken(2).toUpperCase()}`;
    const payment = await this.prisma.db.payment.create({
      data: {
        tenantId,
        invoiceId: dto.invoiceId ?? null,
        studentId: student.id,
        purpose: dto.purpose ?? 'FEES',
        amount,
        method: 'ONLINE',
        provider: 'PAYSTACK',
        reference,
        status: 'PENDING',
        payerEmail: dto.email,
        guardianId: ctx().guardianId ?? null,
        recordedById: ctx().userId,
      },
    });
    const res = await fetch(`${PAYSTACK}/transaction/initialize`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: dto.email,
        amount: Math.round(Number(amount) * 100),
        reference,
        currency: snap.currency,
        callback_url: dto.callbackUrl ?? `${process.env.WEB_APP_URL ?? ''}/pay/callback`,
        metadata: { tenantId, paymentId: payment.id, purpose: payment.purpose, studentId: student.studentId },
      }),
    }).catch((e) => {
      throw new BadRequestException(`Payment gateway unreachable: ${e.message}`);
    });
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok || !json.status) {
      await this.prisma.db.payment.update({
        where: { id: payment.id },
        data: { status: 'FAILED', notes: json.message ?? 'Initialisation failed' },
      });
      throw new BadRequestException(json.message ?? 'Could not initialise payment');
    }
    await this.audit.log({
      action: 'ONLINE_PAYMENT_INITIATED',
      entity: 'Payment',
      entityId: payment.id,
      after: { reference, amount: Number(amount), purpose: payment.purpose },
    });
    return {
      paymentId: payment.id,
      reference,
      authorizationUrl: json.data.authorization_url,
      accessCode: json.data.access_code,
    };
  }

  /** Client-side confirmation after redirect (webhook remains the source of truth). */
  async verify(reference: string) {
    const tenantId = tid();
    const p = await this.prisma.db.payment.findFirst({ where: { reference } });
    if (!p) throw new NotFoundException('Payment not found');
    if (p.status === 'SUCCESS') return { status: 'SUCCESS', payment: p };
    const secret = await this.secretFor(tenantId);
    const res = await fetch(`${PAYSTACK}/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${secret}` },
    });
    const json: any = await res.json().catch(() => ({}));
    if (json?.data?.status === 'success' && Math.round(Number(p.amount) * 100) <= Number(json.data.amount)) {
      const payment = await this.fees.finalizeOnlinePayment(
        p.id,
        String(json.data.id),
        json.data.paid_at ? new Date(json.data.paid_at) : undefined,
      );
      return { status: 'SUCCESS', payment };
    }
    if (json?.data?.status === 'failed' || json?.data?.status === 'abandoned') {
      await this.prisma.db.payment.update({
        where: { id: p.id },
        data: { status: 'FAILED', notes: json.data.gateway_response },
      });
      return { status: 'FAILED', payment: p };
    }
    return { status: 'PENDING', payment: p };
  }

  /** Paystack webhook (public). Signature is checked against the school's secret; processing is idempotent. */
  async webhook(rawBody: Buffer, signature: string | undefined) {
    let event: any;
    try {
      event = JSON.parse(rawBody.toString('utf8'));
    } catch {
      throw new BadRequestException('Invalid JSON');
    }
    const reference: string | undefined = event?.data?.reference;
    if (!reference) return { ok: true, ignored: true };
    const p = await this.prisma.platform.payment.findFirst({
      where: { reference },
      select: { id: true, tenantId: true, status: true, amount: true },
    });
    if (!p) return { ok: true, ignored: true };
    const secret = await this.secretFor(p.tenantId);
    if (!secret || !signature || createHmac('sha512', secret).update(rawBody).digest('hex') !== signature)
      throw new ForbiddenException('Invalid webhook signature');
    const store = { ...ctx(), tenantId: p.tenantId, actorType: 'SYSTEM' as const, actorName: 'Paystack webhook' };
    await requestContext.run(store, async () => {
      if (event.event === 'charge.success' && Math.round(Number(p.amount) * 100) <= Number(event.data.amount ?? 0)) {
        await this.fees.finalizeOnlinePayment(
          p.id,
          String(event.data.id),
          event.data.paid_at ? new Date(event.data.paid_at) : undefined,
        );
      } else if (event.event === 'charge.failed' && p.status === 'PENDING') {
        await this.prisma.forTenant(p.tenantId).payment.update({
          where: { id: p.id },
          data: { status: 'FAILED', notes: event.data.gateway_response ?? 'failed' },
        });
      }
    });
    this.logger.log(`Webhook ${event.event} for ${reference} processed`);
    return { ok: true };
  }
}
