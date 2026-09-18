import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService, Tx } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { TenantCacheService } from '../tenants/tenant-cache.service';
import { ctx, tid } from '../common/context/request-context';
import {
  ROUND_DOWN,
  addDays,
  decMax,
  decMin,
  money,
  nextSequence,
  pad,
  paginate,
  startOfToday,
  zero,
} from '../common/utils';
import {
  DiscountDto,
  FeeCategoryDto,
  FeeStructureDto,
  GenerateInvoicesDto,
  ListInvoicesDto,
  ListPaymentsDto,
  RecordPaymentDto,
} from './dto';

const OPEN_STATUSES = ['ISSUED', 'PARTIALLY_PAID', 'OVERDUE'] as const;

@Injectable()
export class FeesService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private tenants: TenantCacheService,
  ) {}

  // ─────────────────────────── Ledger primitives ───────────────────────────
  /** Append-only ledger post + running balance update, row-locked per student. */
  async postLedger(
    tx: Tx,
    studentId: string,
    type: 'DEBIT' | 'CREDIT',
    source: string,
    refId: string | null,
    description: string,
    amount: Prisma.Decimal,
  ) {
    const tenantId = tid();
    await tx.studentAccount.upsert({ where: { studentId }, create: { tenantId, studentId }, update: {} });
    await tx.$queryRaw`SELECT "id" FROM "StudentAccount" WHERE "studentId" = ${studentId} FOR UPDATE`;
    const acct = await tx.studentAccount.findUnique({ where: { studentId } });
    const balanceAfter = money(type === 'DEBIT' ? acct.balance.plus(amount) : acct.balance.minus(amount));
    await tx.studentAccount.update({ where: { studentId }, data: { balance: balanceAfter } });
    await tx.ledgerEntry.create({
      data: {
        tenantId,
        studentId,
        type,
        source,
        refId,
        description,
        amount: money(amount),
        balanceAfter,
        createdById: ctx().userId ?? null,
      },
    });
    return balanceAfter;
  }

  /** Credits a canteen wallet (used by manual top-ups, online top-ups and refunds). */
  async creditWallet(
    tx: Tx,
    studentId: string,
    amount: Prisma.Decimal,
    opts: {
      type: 'TOPUP' | 'REFUND' | 'ADJUSTMENT' | 'ALLOWANCE';
      method?: string;
      reference?: string;
      saleId?: string;
    },
  ) {
    const tenantId = tid();
    await tx.wallet.upsert({ where: { studentId }, create: { tenantId, studentId }, update: {} });
    await tx.$queryRaw`SELECT "id" FROM "Wallet" WHERE "studentId" = ${studentId} FOR UPDATE`;
    const w = await tx.wallet.findUnique({ where: { studentId } });
    const balanceAfter = money(w.balance.plus(amount));
    await tx.wallet.update({ where: { id: w.id }, data: { balance: balanceAfter } });
    const t = await tx.walletTransaction.create({
      data: {
        tenantId,
        walletId: w.id,
        type: opts.type,
        amount: money(amount),
        balanceAfter,
        method: opts.method,
        reference: opts.reference,
        saleId: opts.saleId,
        byId: ctx().userId ?? null,
      },
    });
    return { wallet: { ...w, balance: balanceAfter }, transaction: t };
  }

  private async applyToInvoice(tx: Tx, invoiceId: string, amount: Prisma.Decimal) {
    const inv = await tx.invoice.findUnique({
      where: { id: invoiceId },
      include: { installments: { orderBy: { sequence: 'asc' } } },
    });
    const paidTotal = money(inv.paidTotal.plus(amount));
    await tx.invoice.update({
      where: { id: invoiceId },
      data: { paidTotal, status: paidTotal.gte(inv.total) ? 'PAID' : 'PARTIALLY_PAID' },
    });
    let remaining = amount;
    for (const inst of inv.installments) {
      if (remaining.lte(0)) break;
      const need = inst.amount.minus(inst.paidAmount);
      if (need.lte(0)) continue;
      const take = decMin(need, remaining);
      const paid = inst.paidAmount.plus(take);
      await tx.installment.update({
        where: { id: inst.id },
        data: { paidAmount: paid, status: paid.gte(inst.amount) ? 'PAID' : 'PARTIAL' },
      });
      remaining = remaining.minus(take);
    }
  }

  private async unapplyFromInvoice(tx: Tx, invoiceId: string, amount: Prisma.Decimal) {
    const inv = await tx.invoice.findUnique({
      where: { id: invoiceId },
      include: { installments: { orderBy: { sequence: 'desc' } } },
    });
    const paidTotal = money(decMax(inv.paidTotal.minus(amount), 0));
    const status = paidTotal.gte(inv.total)
      ? 'PAID'
      : paidTotal.gt(0)
        ? 'PARTIALLY_PAID'
        : inv.dueDate < new Date()
          ? 'OVERDUE'
          : 'ISSUED';
    await tx.invoice.update({ where: { id: invoiceId }, data: { paidTotal, status } });
    let remaining = amount;
    for (const inst of inv.installments) {
      if (remaining.lte(0)) break;
      const take = decMin(inst.paidAmount, remaining);
      if (take.lte(0)) continue;
      const paid = inst.paidAmount.minus(take);
      await tx.installment.update({
        where: { id: inst.id },
        data: {
          paidAmount: paid,
          status: paid.gte(inst.amount)
            ? 'PAID'
            : paid.gt(0)
              ? 'PARTIAL'
              : inst.dueDate < new Date()
                ? 'OVERDUE'
                : 'PENDING',
        },
      });
      remaining = remaining.minus(take);
    }
  }

  // ─────────────────────────── Categories / structures / discounts ───────────────────────────
  categories() {
    return this.prisma.db.feeCategory.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { structures: true } } },
    });
  }
  createCategory(dto: FeeCategoryDto) {
    return this.prisma.db.feeCategory.create({
      data: { tenantId: tid(), name: dto.name.trim(), description: dto.description, isActive: dto.isActive ?? true },
    });
  }
  updateCategory(id: string, dto: Partial<FeeCategoryDto>) {
    return this.prisma.db.feeCategory.update({
      where: { id },
      data: { name: dto.name?.trim(), description: dto.description, isActive: dto.isActive },
    });
  }

  structures(academicYearId?: string) {
    return this.prisma.db.feeStructure.findMany({
      where: academicYearId ? { academicYearId } : undefined,
      orderBy: [{ level: 'asc' }, { createdAt: 'asc' }],
      include: { category: { select: { id: true, name: true } } },
    });
  }
  async createStructure(dto: FeeStructureDto) {
    if (!dto.classId && !dto.level) throw new BadRequestException('Provide a classId or a level');
    const s = await this.prisma.db.feeStructure.create({
      data: {
        tenantId: tid(),
        academicYearId: dto.academicYearId,
        termId: dto.termId || null,
        classId: dto.classId || null,
        level: dto.level ? dto.level.toUpperCase() : null,
        categoryId: dto.categoryId,
        amount: money(dto.amount),
        appliesTo: dto.appliesTo ?? 'ALL',
      },
      include: { category: true },
    });
    await this.audit.log({ action: 'FEE_STRUCTURE_CREATED', entity: 'FeeStructure', entityId: s.id, after: dto });
    return s;
  }
  async updateStructure(id: string, dto: Partial<FeeStructureDto>) {
    const before = await this.prisma.db.feeStructure.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Fee structure not found');
    const s = await this.prisma.db.feeStructure.update({
      where: { id },
      data: {
        termId: dto.termId === undefined ? undefined : dto.termId || null,
        classId: dto.classId === undefined ? undefined : dto.classId || null,
        level: dto.level === undefined ? undefined : dto.level?.toUpperCase() || null,
        categoryId: dto.categoryId,
        amount: dto.amount !== undefined ? money(dto.amount) : undefined,
        appliesTo: dto.appliesTo,
      },
    });
    await this.audit.log({ action: 'FEE_STRUCTURE_UPDATED', entity: 'FeeStructure', entityId: id, before, after: dto });
    return s;
  }
  async deleteStructure(id: string) {
    await this.prisma.db.feeStructure.delete({ where: { id } });
    await this.audit.log({ action: 'FEE_STRUCTURE_DELETED', entity: 'FeeStructure', entityId: id });
    return { ok: true };
  }

  discounts(studentId?: string) {
    return this.prisma.db.studentDiscount.findMany({
      where: studentId ? { studentId } : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }
  async createDiscount(dto: DiscountDto) {
    if (dto.type === 'PERCENT' && dto.value > 100)
      throw new BadRequestException('Percentage discount cannot exceed 100');
    const d = await this.prisma.db.studentDiscount.create({
      data: {
        tenantId: tid(),
        studentId: dto.studentId,
        name: dto.name,
        type: dto.type,
        value: money(dto.value),
        categoryId: dto.categoryId || null,
        academicYearId: dto.academicYearId || null,
        reason: dto.reason,
        approvedById: ctx().userId,
      },
    });
    await this.audit.log({
      action: 'DISCOUNT_GRANTED',
      entity: 'Student',
      entityId: dto.studentId,
      after: dto,
      reason: dto.reason,
    });
    return d;
  }
  async deleteDiscount(id: string) {
    const d = await this.prisma.db.studentDiscount.delete({ where: { id } });
    await this.audit.log({ action: 'DISCOUNT_REMOVED', entity: 'Student', entityId: d.studentId, before: d });
    return { ok: true };
  }

  // ─────────────────────────── Invoicing ───────────────────────────
  async generateInvoices(dto: GenerateInvoicesDto) {
    const db = this.prisma.db;
    const tenantId = tid();
    const term = await db.term.findUnique({ where: { id: dto.termId }, include: { academicYear: true } });
    if (!term) throw new NotFoundException('Term not found');
    const settings = await this.tenants.settings(tenantId);
    const classes = dto.classId
      ? await db.schoolClass.findMany({ where: { id: dto.classId } })
      : await db.schoolClass.findMany();
    if (!classes.length) throw new BadRequestException('No classes found');
    const structures = await db.feeStructure.findMany({
      where: { academicYearId: term.academicYearId, OR: [{ termId: term.id }, { termId: null }] },
      include: { category: true },
    });
    if (!structures.length)
      throw new BadRequestException(
        'No fee structures are defined for this academic year. Add them under Fees → Fee structures first.',
      );
    const existing = await db.invoice.findMany({
      where: { termId: term.id, status: { not: 'CANCELLED' } },
      select: { id: true, studentId: true, paidTotal: true, total: true, number: true },
    });
    const existingMap = new Map(existing.map((i) => [i.studentId, i]));
    const dueDate = dto.dueDate ? new Date(dto.dueDate) : addDays(term.startDate, settings.finance.paymentGraceDays);
    const n = settings.finance.allowInstallments ? Math.max(1, Math.min(12, settings.finance.defaultInstallments)) : 1;
    const siblingPct = Number(settings.finance.siblingDiscountPercent || 0);
    const summary = { created: 0, regenerated: 0, skipped: 0, errors: [] as string[] };
    const year = term.academicYear.startDate.getUTCFullYear();

    for (const cls of classes) {
      const applicable = structures.filter((s) => s.classId === cls.id || (!s.classId && s.level === cls.level));
      if (!applicable.length) continue;
      const students = await db.student.findMany({
        where: { classId: cls.id, status: 'ACTIVE' },
        include: { guardians: { select: { guardianId: true } } },
      });
      if (!students.length) continue;
      const discounts = await db.studentDiscount.findMany({
        where: {
          studentId: { in: students.map((s) => s.id) },
          OR: [{ academicYearId: null }, { academicYearId: term.academicYearId }],
        },
      });
      const guardianIds = [...new Set(students.flatMap((s) => s.guardians.map((g) => g.guardianId)))];
      const siblingCounts =
        siblingPct > 0 && guardianIds.length
          ? await db.studentGuardian.groupBy({
              by: ['guardianId'],
              where: { guardianId: { in: guardianIds }, student: { status: 'ACTIVE' } },
              _count: { _all: true },
            })
          : [];
      const hasSiblings = (s: (typeof students)[number]) =>
        s.guardians.some((g) => (siblingCounts.find((c) => c.guardianId === g.guardianId)?._count._all ?? 0) > 1);

      for (const student of students) {
        const prev = existingMap.get(student.id);
        if (prev && !dto.regenerate) {
          summary.skipped++;
          continue;
        }
        if (prev && prev.paidTotal.gt(0)) {
          summary.errors.push(`${student.studentId}: invoice ${prev.number} already has payments`);
          continue;
        }
        const byCategory = new Map<string, (typeof applicable)[number]>();
        for (const s of applicable) {
          if (s.appliesTo === 'BOARDING' && !student.isBoarding) continue;
          if (s.appliesTo === 'DAY' && student.isBoarding) continue;
          const cur = byCategory.get(s.categoryId);
          if (!cur || (s.classId && !cur.classId) || (s.termId && !cur.termId)) byCategory.set(s.categoryId, s);
        }
        const lines = [...byCategory.values()].map((s) => {
          const amount = money(s.amount);
          let discount = zero();
          for (const d of discounts.filter(
            (d) => d.studentId === student.id && (!d.categoryId || d.categoryId === s.categoryId),
          )) {
            discount = discount.plus(d.type === 'PERCENT' ? amount.mul(d.value).div(100) : d.value);
          }
          if (siblingPct > 0 && hasSiblings(student)) discount = discount.plus(amount.mul(siblingPct).div(100));
          if (discount.gt(amount)) discount = amount;
          return { categoryId: s.categoryId, description: s.category.name, amount, discount: money(discount) };
        });
        const subtotal = money(lines.reduce((a, l) => a.plus(l.amount), zero()));
        const discountTotal = money(lines.reduce((a, l) => a.plus(l.discount), zero()));
        const total = money(subtotal.minus(discountTotal));
        if (total.lte(0)) {
          summary.skipped++;
          continue;
        }
        await this.prisma.tenantTx(async (tx) => {
          if (prev) {
            await tx.invoice.update({ where: { id: prev.id }, data: { status: 'CANCELLED', notes: 'Regenerated' } });
            await this.postLedger(
              tx,
              student.id,
              'CREDIT',
              'INVOICE_CANCELLED',
              prev.id,
              `Invoice ${prev.number} cancelled (regenerated)`,
              prev.total,
            );
          }
          const seq = await nextSequence(tx, tenantId, 'invoice');
          const number = `${settings.finance.invoicePrefix}-${year}-${pad(seq, 6)}`;
          const inv = await tx.invoice.create({
            data: {
              tenantId,
              number,
              studentId: student.id,
              academicYearId: term.academicYearId,
              termId: term.id,
              subtotal,
              discountTotal,
              total,
              dueDate,
              lines: { create: lines.map((l) => ({ tenantId, ...l })) },
              installments: {
                create: splitInstallments(total, n, dueDate, term.endDate).map((i) => ({ tenantId, ...i })),
              },
            },
          });
          await this.postLedger(
            tx,
            student.id,
            'DEBIT',
            'INVOICE',
            inv.id,
            `Invoice ${number}: ${term.name} ${term.academicYear.name}`,
            total,
          );
        });
        prev ? summary.regenerated++ : summary.created++;
      }
    }
    await this.audit.log({
      action: 'INVOICES_GENERATED',
      entity: 'Term',
      entityId: term.id,
      after: { classId: dto.classId ?? 'ALL', ...summary, errors: summary.errors.length },
    });
    return summary;
  }

  /**
   * Creates a one-off invoice for a student inside an existing transaction (canteen plans, extra charges, damages…).
   * The fee category is created on first use.
   */
  async createAdhocInvoice(
    tx: Tx,
    input: {
      studentId: string;
      termId: string;
      dueDate: Date;
      notes?: string;
      lines: Array<{ categoryName: string; description: string; amount: number; discount?: number }>;
    },
  ) {
    const tenantId = tid();
    const settings = await this.tenants.settings(tenantId);
    const term = await tx.term.findUnique({ where: { id: input.termId }, include: { academicYear: true } });
    if (!term) throw new NotFoundException('Term not found');
    const lines = [] as Array<{ categoryId: string; description: string; amount: any; discount: any }>;
    for (const l of input.lines) {
      let cat = await tx.feeCategory.findFirst({ where: { tenantId, name: l.categoryName } });
      if (!cat)
        cat = await tx.feeCategory.create({
          data: { tenantId, name: l.categoryName, description: 'Created automatically' },
        });
      lines.push({
        categoryId: cat.id,
        description: l.description,
        amount: money(l.amount),
        discount: money(l.discount ?? 0),
      });
    }
    const subtotal = money(lines.reduce((a, l) => a.plus(l.amount), zero()));
    const discountTotal = money(lines.reduce((a, l) => a.plus(l.discount), zero()));
    const total = money(subtotal.minus(discountTotal));
    if (total.lte(0)) throw new BadRequestException('Invoice total must be greater than zero');
    const seq = await nextSequence(tx, tenantId, 'invoice');
    const number = `${settings.finance.invoicePrefix}-${term.academicYear.startDate.getUTCFullYear()}-${pad(seq, 6)}`;
    const inv = await tx.invoice.create({
      data: {
        tenantId,
        number,
        studentId: input.studentId,
        academicYearId: term.academicYearId,
        termId: term.id,
        subtotal,
        discountTotal,
        total,
        dueDate: input.dueDate,
        notes: input.notes,
        lines: { create: lines.map((l) => ({ tenantId, ...l })) },
        installments: { create: [{ tenantId, sequence: 1, amount: total, dueDate: input.dueDate }] },
      },
    });
    await this.postLedger(
      tx,
      input.studentId,
      'DEBIT',
      'INVOICE',
      inv.id,
      `Invoice ${number}: ${input.lines.map((l) => l.description).join(', ')}`,
      total,
    );
    return inv;
  }

  async listInvoices(q: ListInvoicesDto) {
    const { skip, take, page, pageSize } = paginate(q.page, q.pageSize);
    const where: any = {};
    if (q.termId) where.termId = q.termId;
    if (q.studentId) where.studentId = q.studentId;
    if (q.status) where.status = q.status;
    if (q.classId) where.student = { classId: q.classId };
    if (q.search)
      where.OR = [
        { number: { contains: q.search, mode: 'insensitive' } },
        { student: { firstName: { contains: q.search, mode: 'insensitive' } } },
        { student: { lastName: { contains: q.search, mode: 'insensitive' } } },
        { student: { studentId: { contains: q.search, mode: 'insensitive' } } },
      ];
    const [items, total] = await Promise.all([
      this.prisma.db.invoice.findMany({
        where,
        skip,
        take,
        orderBy: { issuedAt: 'desc' },
        include: {
          student: {
            select: { id: true, studentId: true, firstName: true, lastName: true, class: { select: { name: true } } },
          },
        },
      }),
      this.prisma.db.invoice.count({ where }),
    ]);
    return { items: items.map((i) => ({ ...i, balance: i.total.minus(i.paidTotal) })), total, page, pageSize };
  }

  async getInvoice(id: string) {
    const inv = await this.prisma.db.invoice.findUnique({
      where: { id },
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
              include: { guardian: { select: { firstName: true, lastName: true, phone: true, email: true } } },
            },
          },
        },
        lines: { include: { category: { select: { name: true } } } },
        installments: { orderBy: { sequence: 'asc' } },
        payments: { where: { status: { in: ['SUCCESS', 'REVERSED'] } }, orderBy: { paidAt: 'desc' } },
      },
    });
    if (!inv) throw new NotFoundException('Invoice not found');
    const [term, year] = await Promise.all([
      this.prisma.db.term.findUnique({ where: { id: inv.termId } }),
      this.prisma.db.academicYear.findUnique({ where: { id: inv.academicYearId } }),
    ]);
    return { ...inv, balance: inv.total.minus(inv.paidTotal), term, academicYear: year };
  }

  async cancelInvoice(id: string, reason: string) {
    const inv = await this.prisma.db.invoice.findUnique({ where: { id } });
    if (!inv) throw new NotFoundException('Invoice not found');
    if (inv.status === 'CANCELLED') return inv;
    if (inv.paidTotal.gt(0)) throw new BadRequestException('Reverse the payments before cancelling this invoice');
    const r = await this.prisma.tenantTx(async (tx) => {
      const u = await tx.invoice.update({ where: { id }, data: { status: 'CANCELLED', notes: reason } });
      await this.postLedger(
        tx,
        inv.studentId,
        'CREDIT',
        'INVOICE_CANCELLED',
        id,
        `Invoice ${inv.number} cancelled: ${reason}`,
        inv.total,
      );
      return u;
    });
    await this.audit.log({ action: 'INVOICE_CANCELLED', entity: 'Invoice', entityId: id, reason });
    return r;
  }

  // ─────────────────────────── Payments ───────────────────────────
  async recordPayment(dto: RecordPaymentDto) {
    const amount = money(dto.amount);
    const settings = await this.tenants.settings(tid());
    const payment = await this.prisma.tenantTx(async (tx) => {
      const student = await tx.student.findUnique({ where: { id: dto.studentId } });
      if (!student) throw new NotFoundException('Student not found');
      let invoice = dto.invoiceId
        ? await tx.invoice.findUnique({ where: { id: dto.invoiceId } })
        : await tx.invoice.findFirst({
            where: { studentId: student.id, status: { in: [...OPEN_STATUSES] } },
            orderBy: { issuedAt: 'asc' },
          });
      if (dto.invoiceId && (!invoice || invoice.studentId !== student.id))
        throw new BadRequestException('Invoice does not belong to this student');
      if (invoice?.status === 'CANCELLED') throw new BadRequestException('Invoice is cancelled');
      const seq = await nextSequence(tx, tid(), 'receipt');
      const receiptNumber = `${settings.finance.receiptPrefix}-${new Date().getFullYear()}-${pad(seq, 6)}`;
      const p = await tx.payment.create({
        data: {
          tenantId: tid(),
          invoiceId: invoice?.id ?? null,
          studentId: student.id,
          purpose: 'FEES',
          amount,
          method: dto.method,
          reference: dto.reference?.trim() || null,
          status: 'SUCCESS',
          receiptNumber,
          paidAt: dto.paidAt ? new Date(dto.paidAt) : new Date(),
          recordedById: ctx().userId,
          notes: dto.notes,
          payerEmail: dto.payerEmail,
        },
      });
      if (invoice) await this.applyToInvoice(tx, invoice.id, amount);
      await this.postLedger(
        tx,
        student.id,
        'CREDIT',
        'PAYMENT',
        p.id,
        `Payment ${receiptNumber} (${dto.method.replace('_', ' ').toLowerCase()})`,
        amount,
      );
      return p;
    });
    await this.audit.log({
      action: 'PAYMENT_RECORDED',
      entity: 'Payment',
      entityId: payment.id,
      after: {
        receiptNumber: payment.receiptNumber,
        amount: Number(amount),
        method: dto.method,
        studentId: dto.studentId,
      },
    });
    await this.notifyGuardians(
      dto.studentId,
      'Payment received',
      `A payment of ${Number(amount).toFixed(2)} was recorded. Receipt ${payment.receiptNumber}.`,
      { paymentId: payment.id },
    );
    return this.getPayment(payment.id);
  }

  /** Finalises a gateway payment (idempotent). Used by webhooks and verification. */
  async finalizeOnlinePayment(paymentId: string, providerRef: string, paidAt?: Date) {
    const settings = await this.tenants.settings(tid());
    const result = await this.prisma.tenantTx(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Payment" WHERE "id" = ${paymentId} FOR UPDATE`;
      const p = await tx.payment.findUnique({ where: { id: paymentId } });
      if (!p) throw new NotFoundException('Payment not found');
      if (p.status === 'SUCCESS') return { payment: p, already: true };
      const seq = await nextSequence(tx, tid(), 'receipt');
      const receiptNumber = `${settings.finance.receiptPrefix}-${new Date().getFullYear()}-${pad(seq, 6)}`;
      const updated = await tx.payment.update({
        where: { id: paymentId },
        data: { status: 'SUCCESS', providerRef, receiptNumber, paidAt: paidAt ?? new Date() },
      });
      if (p.purpose === 'WALLET') {
        await this.creditWallet(tx, p.studentId, p.amount, {
          type: 'TOPUP',
          method: 'ONLINE',
          reference: p.reference ?? undefined,
        });
      } else {
        if (p.invoiceId) await this.applyToInvoice(tx, p.invoiceId, p.amount);
        await this.postLedger(tx, p.studentId, 'CREDIT', 'PAYMENT', p.id, `Online payment ${receiptNumber}`, p.amount);
      }
      return { payment: updated, already: false };
    });
    if (!result.already) {
      await this.audit.log({
        action: 'ONLINE_PAYMENT_CONFIRMED',
        entity: 'Payment',
        entityId: paymentId,
        after: { providerRef, amount: Number(result.payment.amount), purpose: result.payment.purpose },
      });
      await this.notifyGuardians(
        result.payment.studentId,
        'Payment confirmed',
        `Your online payment of ${Number(result.payment.amount).toFixed(2)} was confirmed. Receipt ${result.payment.receiptNumber}.`,
        { paymentId },
      );
    }
    return result.payment;
  }

  async reversePayment(id: string, reason: string) {
    const p = await this.prisma.db.payment.findUnique({ where: { id } });
    if (!p) throw new NotFoundException('Payment not found');
    if (p.status !== 'SUCCESS') throw new BadRequestException('Only successful payments can be reversed');
    const r = await this.prisma.tenantTx(async (tx) => {
      const u = await tx.payment.update({
        where: { id },
        data: { status: 'REVERSED', reversedAt: new Date(), reversalReason: reason },
      });
      if (p.purpose === 'WALLET') {
        const w = await tx.wallet.findUnique({ where: { studentId: p.studentId } });
        if (w) {
          const balanceAfter = money(w.balance.minus(p.amount));
          await tx.wallet.update({ where: { id: w.id }, data: { balance: balanceAfter } });
          await tx.walletTransaction.create({
            data: {
              tenantId: tid(),
              walletId: w.id,
              type: 'ADJUSTMENT',
              amount: money(p.amount).neg(),
              balanceAfter,
              reference: `Reversal of ${p.receiptNumber}`,
              byId: ctx().userId,
            },
          });
        }
      } else {
        if (p.invoiceId) await this.unapplyFromInvoice(tx, p.invoiceId, p.amount);
        await this.postLedger(
          tx,
          p.studentId,
          'DEBIT',
          'REVERSAL',
          p.id,
          `Reversal of ${p.receiptNumber}: ${reason}`,
          p.amount,
        );
      }
      return u;
    });
    await this.audit.log({
      action: 'PAYMENT_REVERSED',
      entity: 'Payment',
      entityId: id,
      before: { status: 'SUCCESS', amount: Number(p.amount) },
      after: { status: 'REVERSED' },
      reason,
    });
    return r;
  }

  async listPayments(q: ListPaymentsDto) {
    const { skip, take, page, pageSize } = paginate(q.page, q.pageSize);
    const where: any = {};
    if (q.studentId) where.studentId = q.studentId;
    if (q.method) where.method = q.method;
    where.status = q.status ?? 'SUCCESS';
    if (q.from || q.to)
      where.paidAt = {
        gte: q.from ? new Date(q.from) : undefined,
        lte: q.to ? new Date(q.to + 'T23:59:59.999Z') : undefined,
      };
    if (q.search)
      where.OR = [
        { receiptNumber: { contains: q.search, mode: 'insensitive' } },
        { reference: { contains: q.search, mode: 'insensitive' } },
        { student: { firstName: { contains: q.search, mode: 'insensitive' } } },
        { student: { lastName: { contains: q.search, mode: 'insensitive' } } },
        { student: { studentId: { contains: q.search, mode: 'insensitive' } } },
      ];
    const [items, total, sum] = await Promise.all([
      this.prisma.db.payment.findMany({
        where,
        skip,
        take,
        orderBy: { paidAt: 'desc' },
        include: {
          student: {
            select: { id: true, studentId: true, firstName: true, lastName: true, class: { select: { name: true } } },
          },
          invoice: { select: { number: true } },
        },
      }),
      this.prisma.db.payment.count({ where }),
      this.prisma.db.payment.aggregate({ where, _sum: { amount: true } }),
    ]);
    return { items, total, page, pageSize, sumAmount: sum._sum.amount ?? 0 };
  }

  async getPayment(id: string) {
    const p = await this.prisma.db.payment.findUnique({
      where: { id },
      include: {
        student: {
          select: {
            id: true,
            studentId: true,
            firstName: true,
            lastName: true,
            class: { select: { name: true } },
            account: { select: { balance: true } },
          },
        },
        invoice: { select: { id: true, number: true, total: true, paidTotal: true, status: true } },
      },
    });
    if (!p) throw new NotFoundException('Payment not found');
    const recordedBy = p.recordedById
      ? await this.prisma.db.user.findUnique({
          where: { id: p.recordedById },
          select: { firstName: true, lastName: true },
        })
      : null;
    return { ...p, recordedByName: recordedBy ? `${recordedBy.firstName} ${recordedBy.lastName}` : null };
  }

  async statement(studentId: string) {
    const db = this.prisma.db;
    const student = await db.student.findUnique({
      where: { id: studentId },
      include: { class: { select: { name: true } }, account: true },
    });
    if (!student) throw new NotFoundException('Student not found');
    const [invoices, payments, ledger, discounts] = await Promise.all([
      db.invoice.findMany({
        where: { studentId },
        orderBy: { issuedAt: 'desc' },
        include: {
          lines: { include: { category: { select: { name: true } } } },
          installments: { orderBy: { sequence: 'asc' } },
        },
      }),
      db.payment.findMany({
        where: { studentId, status: { in: ['SUCCESS', 'REVERSED', 'PENDING'] } },
        orderBy: { paidAt: 'desc' },
      }),
      db.ledgerEntry.findMany({ where: { studentId }, orderBy: { createdAt: 'desc' }, take: 200 }),
      db.studentDiscount.findMany({ where: { studentId } }),
    ]);
    const terms = await db.term.findMany({
      where: { id: { in: [...new Set(invoices.map((i) => i.termId))] } },
      select: { id: true, name: true, academicYear: { select: { name: true } } },
    });
    return {
      student,
      balance: student.account?.balance ?? 0,
      invoices: invoices.map((i) => ({
        ...i,
        balance: i.total.minus(i.paidTotal),
        term: terms.find((t) => t.id === i.termId),
      })),
      payments,
      ledger,
      discounts,
    };
  }

  async summary(termId?: string) {
    const db = this.prisma.db;
    const term = termId
      ? await db.term.findUnique({ where: { id: termId } })
      : ((await db.term.findFirst({ where: { isCurrent: true } })) ??
        (await db.term.findFirst({ orderBy: { startDate: 'desc' } })));
    if (!term)
      return {
        term: null,
        invoiced: 0,
        collected: 0,
        outstanding: 0,
        byClass: [],
        byStatus: {},
        byMethod: [],
        today: 0,
        overdueCount: 0,
      };
    const invoices = await db.invoice.findMany({
      where: { termId: term.id, status: { not: 'CANCELLED' } },
      select: {
        total: true,
        paidTotal: true,
        status: true,
        dueDate: true,
        student: { select: { classId: true, class: { select: { name: true } } } },
      },
    });
    const byClassMap = new Map<
      string,
      { classId: string; name: string; invoiced: Prisma.Decimal; collected: Prisma.Decimal; students: number }
    >();
    const byStatus: Record<string, number> = {};
    let invoiced = zero(),
      collected = zero(),
      overdueCount = 0;
    for (const i of invoices) {
      invoiced = invoiced.plus(i.total);
      collected = collected.plus(i.paidTotal);
      byStatus[i.status] = (byStatus[i.status] ?? 0) + 1;
      if (i.status !== 'PAID' && i.dueDate < new Date()) overdueCount++;
      const key = i.student.classId ?? 'none';
      if (!byClassMap.has(key))
        byClassMap.set(key, {
          classId: key,
          name: i.student.class?.name ?? 'Unassigned',
          invoiced: zero(),
          collected: zero(),
          students: 0,
        });
      const c = byClassMap.get(key);
      c.invoiced = c.invoiced.plus(i.total);
      c.collected = c.collected.plus(i.paidTotal);
      c.students++;
    }
    const [byMethod, today] = await Promise.all([
      db.payment.groupBy({
        by: ['method'],
        where: { status: 'SUCCESS', purpose: 'FEES', paidAt: { gte: term.startDate, lte: addDays(term.endDate, 1) } },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      db.payment.aggregate({
        where: { status: 'SUCCESS', purpose: 'FEES', paidAt: { gte: startOfToday() } },
        _sum: { amount: true },
      }),
    ]);
    return {
      term: { id: term.id, name: term.name },
      invoiced,
      collected,
      outstanding: invoiced.minus(collected),
      collectionRate: invoiced.gt(0) ? Number(collected.div(invoiced).mul(100).toFixed(1)) : 0,
      byClass: [...byClassMap.values()]
        .map((c) => ({ ...c, outstanding: c.invoiced.minus(c.collected) }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      byStatus,
      byMethod: byMethod.map((m) => ({ method: m.method, amount: m._sum.amount ?? 0, count: m._count._all })),
      today: today._sum.amount ?? 0,
      overdueCount,
    };
  }

  /** Nightly: flags overdue invoices/installments. */
  async markOverdue() {
    const now = new Date();
    const inv = await this.prisma.db.invoice.updateMany({
      where: { status: { in: ['ISSUED', 'PARTIALLY_PAID'] }, dueDate: { lt: now } },
      data: { status: 'OVERDUE' },
    });
    await this.prisma.db.installment.updateMany({
      where: { status: { in: ['PENDING', 'PARTIAL'] }, dueDate: { lt: now } },
      data: { status: 'OVERDUE' },
    });
    return inv.count;
  }

  async notifyGuardians(studentId: string, title: string, body: string, data?: any) {
    try {
      const links = await this.prisma.db.studentGuardian.findMany({
        where: { studentId },
        include: { guardian: { select: { userId: true } } },
      });
      const userIds = links.map((l) => l.guardian.userId).filter(Boolean);
      if (!userIds.length) return;
      await this.prisma.db.notification.createMany({
        data: userIds.map((userId) => ({ tenantId: tid(), userId, title, body, type: 'FINANCE', data })),
      });
    } catch {
      /* notifications are best-effort */
    }
  }
}

export function splitInstallments(total: Prisma.Decimal, n: number, firstDue: Date, termEnd: Date) {
  const base = total.div(n).toDecimalPlaces(2, ROUND_DOWN);
  const items: Array<{ sequence: number; amount: Prisma.Decimal; dueDate: Date }> = [];
  const span = Math.max(termEnd.getTime() - firstDue.getTime(), 0);
  let allocated = zero();
  for (let i = 0; i < n; i++) {
    const amount = i === n - 1 ? total.minus(allocated) : base;
    allocated = allocated.plus(amount);
    const dueDate = n === 1 ? firstDue : new Date(firstDue.getTime() + (span > 0 ? (span * i) / n : i * 30 * 86400000));
    items.push({ sequence: i + 1, amount: money(amount), dueDate });
  }
  return items;
}
