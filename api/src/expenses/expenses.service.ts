import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ctx, tid } from '../common/context/request-context';
import { money, paginate, toDateOnly } from '../common/utils';
import { CreateExpenseDto, ListExpensesDto } from './dto';

@Injectable()
export class ExpensesService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async create(dto: CreateExpenseDto) {
    const tenantId = tid();
    const expense = await this.prisma.db.expense.create({
      data: {
        tenantId,
        category: dto.category.trim(),
        description: dto.description.trim(),
        amount: money(dto.amount),
        vendor: dto.vendor?.trim(),
        purchasedAt: toDateOnly(dto.purchasedAt),
        receiptUrl: dto.receiptUrl,
        notes: dto.notes?.trim(),
        requestedById: ctx().userId!,
      },
    });
    await this.audit.log({
      action: 'EXPENSE_RECORDED',
      entity: 'Expense',
      entityId: expense.id,
      after: { category: expense.category, amount: Number(expense.amount), vendor: expense.vendor },
    });
    return expense;
  }

  async list(q: ListExpensesDto) {
    const { skip, take, page, pageSize } = paginate(q.page, q.pageSize);
    const where: any = {};
    if (q.status) where.status = q.status;
    if (q.category) where.category = q.category;
    if (q.from || q.to)
      where.purchasedAt = { gte: q.from ? toDateOnly(q.from) : undefined, lte: q.to ? toDateOnly(q.to) : undefined };
    if (q.search)
      where.OR = [
        { description: { contains: q.search, mode: 'insensitive' } },
        { category: { contains: q.search, mode: 'insensitive' } },
        { vendor: { contains: q.search, mode: 'insensitive' } },
      ];
    const [items, total, users] = await Promise.all([
      this.prisma.db.expense.findMany({ where, skip, take, orderBy: { purchasedAt: 'desc' } }),
      this.prisma.db.expense.count({ where }),
      this.prisma.db.user.findMany({ select: { id: true, firstName: true, lastName: true } }),
    ]);
    const nameOf = (id: string | null) => {
      if (!id) return null;
      const u = users.find((x) => x.id === id);
      return u ? `${u.firstName} ${u.lastName}` : null;
    };
    return {
      items: items.map((e) => ({
        ...e,
        amount: Number(e.amount),
        requestedByName: nameOf(e.requestedById),
        approvedByName: nameOf(e.approvedById),
      })),
      total,
      page,
      pageSize,
    };
  }

  async get(id: string) {
    const e = await this.prisma.db.expense.findUnique({ where: { id } });
    if (!e) throw new NotFoundException('Expense not found');
    return { ...e, amount: Number(e.amount) };
  }

  async approve(id: string) {
    return this.decide(id, 'APPROVED');
  }

  async reject(id: string, reason: string) {
    return this.decide(id, 'REJECTED', reason);
  }

  private async decide(id: string, status: 'APPROVED' | 'REJECTED', reason?: string) {
    const e = await this.prisma.db.expense.findUnique({ where: { id } });
    if (!e) throw new NotFoundException('Expense not found');
    if (e.status !== 'PENDING') throw new BadRequestException(`This expense is already ${e.status.toLowerCase()}`);
    // A Finance Officer never approves their own request — genuine separation of duties, not just a
    // permission split, in case a school ever grants both EXPENSE_CREATE and EXPENSE_APPROVE to one role.
    if (e.requestedById === ctx().userId) throw new ForbiddenException('You cannot approve your own expense request');
    const updated = await this.prisma.db.expense.update({
      where: { id },
      data: {
        status,
        approvedById: ctx().userId,
        approvedAt: new Date(),
        rejectionReason: status === 'REJECTED' ? reason : null,
      },
    });
    await this.audit.log({
      action: status === 'APPROVED' ? 'EXPENSE_APPROVED' : 'EXPENSE_REJECTED',
      entity: 'Expense',
      entityId: id,
      before: { status: e.status },
      after: { status, reason },
    });
    return { ...updated, amount: Number(updated.amount) };
  }

  async summary() {
    const rows = await this.prisma.db.expense.groupBy({
      by: ['status'],
      _sum: { amount: true },
      _count: true,
    });
    const byStatus: Record<string, { count: number; total: number }> = {};
    for (const r of rows) byStatus[r.status] = { count: r._count, total: Number(r._sum.amount ?? 0) };
    return {
      pending: byStatus.PENDING ?? { count: 0, total: 0 },
      approved: byStatus.APPROVED ?? { count: 0, total: 0 },
      rejected: byStatus.REJECTED ?? { count: 0, total: 0 },
    };
  }
}
