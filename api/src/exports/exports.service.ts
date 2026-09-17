import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { csv, isoDate, toDateOnly } from '../common/utils';

@Injectable()
export class ExportsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  private async logged(name: string, rows: number) {
    await this.audit.log({ action: 'DATA_EXPORTED', entity: 'Export', entityId: name, after: { rows } });
  }

  async students(classId?: string) {
    const rows = await this.prisma.db.student.findMany({
      where: { classId: classId || undefined, status: 'ACTIVE' },
      orderBy: [{ class: { name: 'asc' } }, { lastName: 'asc' }],
      include: {
        class: { select: { name: true } },
        guardians: { where: { isPrimary: true }, include: { guardian: true } },
        account: { select: { balance: true } },
      },
    });
    await this.logged('students', rows.length);
    return csv(
      rows.map((s) => ({
        studentId: s.studentId,
        firstName: s.firstName,
        lastName: s.lastName,
        otherNames: s.otherNames,
        gender: s.gender,
        dateOfBirth: isoDate(s.dateOfBirth),
        class: s.class?.name,
        status: s.status,
        boarding: s.isBoarding ? 'YES' : 'NO',
        admissionDate: isoDate(s.admissionDate),
        guardian: s.guardians[0] ? `${s.guardians[0].guardian.firstName} ${s.guardians[0].guardian.lastName}` : '',
        guardianPhone: s.guardians[0]?.guardian.phone ?? '',
        balance: Number(s.account?.balance ?? 0),
      })),
    );
  }

  async invoices(termId?: string) {
    const rows = await this.prisma.db.invoice.findMany({
      where: { termId: termId || undefined },
      orderBy: { number: 'asc' },
      include: {
        student: { select: { studentId: true, firstName: true, lastName: true, class: { select: { name: true } } } },
      },
    });
    await this.logged('invoices', rows.length);
    return csv(
      rows.map((i) => ({
        number: i.number,
        studentId: i.student.studentId,
        student: `${i.student.firstName} ${i.student.lastName}`,
        class: i.student.class?.name,
        subtotal: Number(i.subtotal),
        discount: Number(i.discountTotal),
        total: Number(i.total),
        paid: Number(i.paidTotal),
        balance: Number(i.total.minus(i.paidTotal)),
        status: i.status,
        issuedAt: isoDate(i.issuedAt),
        dueDate: isoDate(i.dueDate),
      })),
    );
  }

  async payments(from?: string, to?: string) {
    const rows = await this.prisma.db.payment.findMany({
      where: {
        status: { in: ['SUCCESS', 'REVERSED'] },
        paidAt: { gte: from ? toDateOnly(from) : undefined, lte: to ? new Date(to + 'T23:59:59.999Z') : undefined },
      },
      orderBy: { paidAt: 'asc' },
      include: {
        student: { select: { studentId: true, firstName: true, lastName: true } },
        invoice: { select: { number: true } },
      },
    });
    await this.logged('payments', rows.length);
    return csv(
      rows.map((p) => ({
        receipt: p.receiptNumber,
        date: p.paidAt.toISOString(),
        studentId: p.student.studentId,
        student: `${p.student.firstName} ${p.student.lastName}`,
        invoice: p.invoice?.number ?? '',
        purpose: p.purpose,
        amount: Number(p.amount),
        method: p.method,
        reference: p.reference ?? '',
        status: p.status,
      })),
    );
  }

  async attendance(classId?: string, from?: string, to?: string) {
    const rows = await this.prisma.db.attendance.findMany({
      where: {
        classId: classId || undefined,
        date: { gte: from ? toDateOnly(from) : undefined, lte: to ? toDateOnly(to) : undefined },
      },
      orderBy: [{ date: 'asc' }],
      include: {
        student: { select: { studentId: true, firstName: true, lastName: true, class: { select: { name: true } } } },
      },
    });
    await this.logged('attendance', rows.length);
    return csv(
      rows.map((a) => ({
        date: isoDate(a.date),
        studentId: a.student.studentId,
        student: `${a.student.firstName} ${a.student.lastName}`,
        class: a.student.class?.name,
        status: a.status,
        note: a.note ?? '',
        source: a.source,
      })),
    );
  }

  async results(termId: string, classId?: string) {
    const rows = await this.prisma.db.resultSheet.findMany({
      where: { termId, classId: classId || undefined },
      orderBy: [{ classId: 'asc' }, { position: 'asc' }],
      include: {
        student: { select: { studentId: true, firstName: true, lastName: true, class: { select: { name: true } } } },
      },
    });
    await this.logged('results', rows.length);
    return csv(
      rows.map((r) => {
        const subjects = (r.subjects as any[]) ?? [];
        const base: any = {
          studentId: r.student.studentId,
          student: `${r.student.firstName} ${r.student.lastName}`,
          class: r.student.class?.name,
          average: Number(r.average),
          position: r.position ?? '',
          grade: r.overallGrade ?? '',
          status: r.status,
        };
        for (const s of subjects) base[s.code] = s.total;
        return base;
      }),
    );
  }

  async staff() {
    const rows = await this.prisma.db.staff.findMany({
      where: { status: { not: 'TERMINATED' } },
      orderBy: { lastName: 'asc' },
    });
    await this.logged('staff', rows.length);
    return csv(
      rows.map((s) => ({
        employeeId: s.employeeId,
        firstName: s.firstName,
        lastName: s.lastName,
        staffType: s.staffType,
        department: s.department ?? '',
        position: s.position ?? '',
        phone: s.phone ?? '',
        email: s.email ?? '',
        status: s.status,
      })),
    );
  }
}
