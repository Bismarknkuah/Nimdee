import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ctx, hasPermission, tid } from '../common/context/request-context';
import { money, paginate, toDateOnly, zero } from '../common/utils';
import { CreatePayrollDto, LeaveRequestDto, LeaveReviewDto, UpdatePayrollItemsDto } from './dto';

const workingDays = (start: Date, end: Date) => {
  let n = 0;
  for (let d = new Date(start); d <= end; d = new Date(d.getTime() + 86400000)) {
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) n++;
  }
  return n;
};

/** HR: leave requests with approvals and monthly payroll runs (draft → approved → paid). */
@Injectable()
export class HrService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private readonly staffSelect = {
    id: true,
    employeeId: true,
    firstName: true,
    lastName: true,
    position: true,
    department: true,
    basicSalary: true,
  } as const;

  // ── Leave ──
  async leaveRequests(q: { status?: string; staffId?: string; page?: number; pageSize?: number; mine?: boolean }) {
    const { skip, take, page, pageSize } = paginate(q.page, q.pageSize);
    const where: any = {};
    if (q.status) where.status = q.status;
    if (q.staffId) where.staffId = q.staffId;
    if (q.mine || !hasPermission(ctx().permissions, 'HR_MANAGE')) where.staffId = ctx().staffId ?? '-';
    const [items, total, pending] = await Promise.all([
      this.prisma.db.leaveRequest.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { staff: { select: this.staffSelect } },
      }),
      this.prisma.db.leaveRequest.count({ where }),
      this.prisma.db.leaveRequest.count({ where: { ...where, status: 'PENDING' } }),
    ]);
    return { items, total, page, pageSize, pending };
  }

  async requestLeave(dto: LeaveRequestDto) {
    const c = ctx();
    const staffId = hasPermission(c.permissions, 'HR_MANAGE') && dto.staffId ? dto.staffId : c.staffId;
    if (!staffId) throw new BadRequestException('No staff profile is linked to your account');
    const start = toDateOnly(dto.startDate),
      end = toDateOnly(dto.endDate);
    if (end < start) throw new BadRequestException('End date must be after start date');
    const overlap = await this.prisma.db.leaveRequest.count({
      where: { staffId, status: { in: ['PENDING', 'APPROVED'] }, startDate: { lte: end }, endDate: { gte: start } },
    });
    if (overlap) throw new BadRequestException('Overlaps an existing leave request');
    const r = await this.prisma.db.leaveRequest.create({
      data: {
        tenantId: tid(),
        staffId,
        type: dto.type as any,
        startDate: start,
        endDate: end,
        days: workingDays(start, end),
        reason: dto.reason,
      },
      include: { staff: { select: this.staffSelect } },
    });
    const approvers = await this.prisma.db.user.findMany({
      where: { isActive: true, roles: { some: { role: { permissions: { hasSome: ['*', 'HR_MANAGE'] } } } } },
      select: { id: true },
    });
    if (approvers.length)
      await this.prisma.db.notification.createMany({
        data: approvers.map((u) => ({
          tenantId: tid(),
          userId: u.id,
          title: 'Leave request',
          body: `${r.staff.firstName} ${r.staff.lastName} requested ${r.days} day(s) of ${dto.type.toLowerCase()} leave.`,
          type: 'HR',
          data: { leaveId: r.id },
        })),
      });
    await this.audit.log({
      action: 'LEAVE_REQUESTED',
      entity: 'LeaveRequest',
      entityId: r.id,
      after: { staffId, type: dto.type, days: r.days },
    });
    return r;
  }

  async reviewLeave(id: string, dto: LeaveReviewDto) {
    const r = await this.prisma.db.leaveRequest.findUnique({
      where: { id },
      include: { staff: { select: { ...this.staffSelect, userId: true } } },
    });
    if (!r) throw new NotFoundException('Leave request not found');
    if (r.status !== 'PENDING') throw new BadRequestException('Request already reviewed');
    const u = await this.prisma.db.leaveRequest.update({
      where: { id },
      data: { status: dto.status, reviewedById: ctx().userId, reviewedAt: new Date(), reviewNote: dto.note },
      include: { staff: { select: this.staffSelect } },
    });
    if (dto.status === 'APPROVED') await this.prisma.db.staff.update({ where: { id: r.staffId }, data: {} });
    if (r.staff.userId)
      await this.prisma.db.notification.create({
        data: {
          tenantId: tid(),
          userId: r.staff.userId,
          title: `Leave ${dto.status.toLowerCase()}`,
          body: `Your ${r.type.toLowerCase()} leave (${r.days} days) was ${dto.status.toLowerCase()}.${dto.note ? ` Note: ${dto.note}` : ''}`,
          type: 'HR',
          data: { leaveId: id },
        },
      });
    await this.audit.log({
      action: `LEAVE_${dto.status}`,
      entity: 'LeaveRequest',
      entityId: id,
      after: { note: dto.note },
    });
    return u;
  }

  async cancelLeave(id: string) {
    const r = await this.prisma.db.leaveRequest.findUnique({ where: { id } });
    if (!r) throw new NotFoundException('Leave request not found');
    if (r.staffId !== ctx().staffId && !hasPermission(ctx().permissions, 'HR_MANAGE')) throw new ForbiddenException();
    if (r.status === 'CANCELLED') return r;
    return this.prisma.db.leaveRequest.update({ where: { id }, data: { status: 'CANCELLED' } });
  }

  /** Who is on leave today / this week. */
  async onLeave() {
    const today = new Date();
    return this.prisma.db.leaveRequest.findMany({
      where: { status: 'APPROVED', startDate: { lte: today }, endDate: { gte: today } },
      include: { staff: { select: this.staffSelect } },
    });
  }

  // ── Payroll ──
  payrollRuns() {
    return this.prisma.db.payrollRun.findMany({ orderBy: { period: 'desc' }, take: 36 });
  }

  async payrollRun(id: string) {
    const run = await this.prisma.db.payrollRun.findUnique({
      where: { id },
      include: { items: { include: { staff: { select: this.staffSelect } }, orderBy: { staff: { lastName: 'asc' } } } },
    });
    if (!run) throw new NotFoundException('Payroll run not found');
    return run;
  }

  /** Creates a draft run pre-filled from each active staff member's basic salary. */
  async createPayroll(dto: CreatePayrollDto) {
    const existing = await this.prisma.db.payrollRun.findUnique({
      where: { tenantId_period: { tenantId: tid(), period: dto.period } },
    });
    if (existing) throw new BadRequestException(`A payroll run for ${dto.period} already exists`);
    const staff = await this.prisma.db.staff.findMany({
      where: { status: { in: ['ACTIVE', 'ON_LEAVE'] } },
      select: { id: true, basicSalary: true },
    });
    const run = await this.prisma.tenantTx(async (tx) => {
      const created = await tx.payrollRun.create({
        data: { tenantId: tid(), period: dto.period, notes: dto.notes, createdById: ctx().userId },
      });
      if (staff.length) {
        await tx.payrollItem.createMany({
          data: staff.map((s) => ({
            tenantId: tid(),
            runId: created.id,
            staffId: s.id,
            basic: money(s.basicSalary ?? 0),
            net: money(s.basicSalary ?? 0),
          })),
        });
      }
      return this.recalc(tx, created.id);
    });
    await this.audit.log({
      action: 'PAYROLL_CREATED',
      entity: 'PayrollRun',
      entityId: run.id,
      after: { period: dto.period, staff: staff.length },
    });
    return this.payrollRun(run.id);
  }

  private async recalc(tx: any, runId: string) {
    const items = await tx.payrollItem.findMany({ where: { runId } });
    let gross = zero(),
      ded = zero(),
      net = zero();
    for (const i of items) {
      gross = gross.plus(i.basic).plus(i.allowances);
      ded = ded.plus(i.deductions);
      net = net.plus(i.net);
    }
    return tx.payrollRun.update({
      where: { id: runId },
      data: { totalGross: money(gross), totalDeductions: money(ded), totalNet: money(net), staffCount: items.length },
    });
  }

  async updatePayrollItems(id: string, dto: UpdatePayrollItemsDto) {
    const run = await this.prisma.db.payrollRun.findUnique({ where: { id } });
    if (!run) throw new NotFoundException('Payroll run not found');
    if (run.status !== 'DRAFT') throw new BadRequestException('Only draft runs can be edited');
    await this.prisma.tenantTx(async (tx) => {
      for (const it of dto.items) {
        const basic = money(it.basic),
          allowances = money(it.allowances ?? 0),
          deductions = money(it.deductions ?? 0);
        const net = money(basic.plus(allowances).minus(deductions));
        await tx.payrollItem.upsert({
          where: { runId_staffId: { runId: id, staffId: it.staffId } },
          create: {
            tenantId: tid(),
            runId: id,
            staffId: it.staffId,
            basic,
            allowances,
            deductions,
            net,
            notes: it.notes,
          },
          update: { basic, allowances, deductions, net, notes: it.notes },
        });
      }
      await this.recalc(tx, id);
    });
    await this.audit.log({
      action: 'PAYROLL_ITEMS_UPDATED',
      entity: 'PayrollRun',
      entityId: id,
      after: { items: dto.items.length },
    });
    return this.payrollRun(id);
  }

  async transitionPayroll(id: string, action: 'approve' | 'pay' | 'reopen') {
    const run = await this.prisma.db.payrollRun.findUnique({ where: { id } });
    if (!run) throw new NotFoundException('Payroll run not found');
    const next = action === 'approve' ? 'APPROVED' : action === 'pay' ? 'PAID' : 'DRAFT';
    if (action === 'approve' && run.status !== 'DRAFT')
      throw new BadRequestException('Only draft runs can be approved');
    if (action === 'pay' && run.status !== 'APPROVED')
      throw new BadRequestException('Approve the run before marking it paid');
    if (action === 'reopen' && run.status === 'PAID') throw new BadRequestException('Paid runs cannot be reopened');
    const u = await this.prisma.db.payrollRun.update({
      where: { id },
      data: {
        status: next,
        approvedById: action === 'approve' ? ctx().userId : undefined,
        approvedAt: action === 'approve' ? new Date() : undefined,
        paidAt: action === 'pay' ? new Date() : undefined,
      },
    });
    await this.audit.log({
      action: `PAYROLL_${next}`,
      entity: 'PayrollRun',
      entityId: id,
      before: { status: run.status },
      after: { status: next, totalNet: Number(run.totalNet) },
    });
    return u;
  }

  async payslip(runId: string, staffId: string) {
    const item = await this.prisma.db.payrollItem.findUnique({
      where: { runId_staffId: { runId, staffId } },
      include: { staff: { select: this.staffSelect }, run: true },
    });
    if (!item) throw new NotFoundException('Payslip not found');
    if (item.staffId !== ctx().staffId && !hasPermission(ctx().permissions, 'PAYROLL_MANAGE'))
      throw new ForbiddenException();
    return item;
  }

  async summary() {
    const [pendingLeave, onLeave, lastRun, staffByType] = await Promise.all([
      this.prisma.db.leaveRequest.count({ where: { status: 'PENDING' } }),
      this.onLeave(),
      this.prisma.db.payrollRun.findFirst({ orderBy: { period: 'desc' } }),
      this.prisma.db.staff.groupBy({
        by: ['staffType'],
        where: { status: { not: 'TERMINATED' } },
        _count: { _all: true },
      }),
    ]);
    return {
      pendingLeave,
      onLeaveToday: onLeave.length,
      onLeave,
      lastPayroll: lastRun,
      staffByType: Object.fromEntries(staffByType.map((s) => [s.staffType, s._count._all])),
    };
  }
}
