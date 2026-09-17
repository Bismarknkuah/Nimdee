import { Controller, Get, NotFoundException, Param, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { RequireAnyPermission, RequireFeature, RequirePermissions } from '../common/decorators';
import { ctx, hasPermission, tid } from '../common/context/request-context';
import { addDays, isoDate, startOfToday, toDateOnly } from '../common/utils';
import { PrismaService } from '../prisma/prisma.service';
import { schemeForLevel } from '../common/settings';
import { TenantCacheService } from '../tenants/tenant-cache.service';
import { PdfService } from './pdf.service';

/**
 * Printable documents. Every endpoint streams a branded PDF built from live data:
 * invoices, statements of account, class lists, attendance registers, batch report cards,
 * ID card sheets, payslips, transcripts and timetables.
 */
@ApiTags('documents')
@Controller('documents')
export class DocumentsController {
  constructor(
    private readonly pdf: PdfService,
    private readonly prisma: PrismaService,
    private readonly tenants: TenantCacheService,
  ) {}

  private async school() {
    const snap = await this.tenants.get(tid());
    const t = await this.prisma.db.tenant.findUnique({
      where: { id: tid() },
      select: { address: true, phone: true, email: true, logoUrl: true },
    });
    return { name: snap.name, code: snap.code, primaryColor: snap.primaryColor, currency: snap.currency, ...t };
  }

  private send(res: Response, buffer: Buffer, filename: string) {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.send(buffer);
  }

  @Get('invoices/:id.pdf')
  @RequireFeature('FEES')
  @RequirePermissions('FEES_VIEW')
  @ApiOperation({ summary: 'Fee invoice with installment plan and payment history' })
  async invoice(@Param('id') id: string, @Res() res: Response) {
    const invoice = await this.prisma.db.invoice.findUnique({
      where: { id },
      include: {
        student: {
          select: {
            id: true,
            studentId: true,
            firstName: true,
            lastName: true,
            class: { select: { name: true } },
            guardians: { where: { isPrimary: true }, include: { guardian: true } },
          },
        },
        lines: { include: { category: { select: { name: true } } } },
        installments: { orderBy: { sequence: 'asc' } },
        payments: { where: { status: 'SUCCESS' }, orderBy: { paidAt: 'asc' } },
      },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    const [term, year, school] = await Promise.all([
      this.prisma.db.term.findUnique({ where: { id: invoice.termId } }),
      this.prisma.db.academicYear.findUnique({ where: { id: invoice.academicYearId } }),
      this.school(),
    ]);
    const buf = await this.pdf.invoice({
      school,
      invoice: { ...invoice, term, academicYear: year },
      student: invoice.student,
      guardian: invoice.student.guardians[0]?.guardian,
      currency: school.currency,
    });
    this.send(res, buf, `${invoice.number}.pdf`);
  }

  @Get('students/:id/statement.pdf')
  @RequireFeature('FEES')
  @RequirePermissions('FEES_VIEW')
  @ApiOperation({ summary: 'Statement of account (invoices, payments, running balance)' })
  async statement(@Param('id') id: string, @Res() res: Response) {
    const db = this.prisma.db;
    const student = await db.student.findUnique({
      where: { id },
      include: { class: { select: { name: true } }, account: true },
    });
    if (!student) throw new NotFoundException('Student not found');
    const [invoices, ledger, school] = await Promise.all([
      db.invoice.findMany({ where: { studentId: id }, orderBy: { issuedAt: 'desc' }, include: { installments: true } }),
      db.ledgerEntry.findMany({ where: { studentId: id }, orderBy: { createdAt: 'asc' }, take: 300 }),
      this.school(),
    ]);
    const terms = await db.term.findMany({
      where: { id: { in: [...new Set(invoices.map((i) => i.termId))] } },
      select: { id: true, name: true },
    });
    const buf = await this.pdf.statement({
      school,
      student,
      ledger,
      invoices: invoices.map((i) => ({ ...i, term: terms.find((t) => t.id === i.termId) })),
      balance: student.account?.balance ?? 0,
      currency: school.currency,
    });
    this.send(res, buf, `${student.studentId}-statement.pdf`);
  }

  @Get('classes/:id/list.pdf')
  @RequirePermissions('STUDENT_VIEW')
  @ApiOperation({ summary: 'Class list with guardian phone numbers' })
  async classList(@Param('id') id: string, @Res() res: Response) {
    const cls = await this.prisma.db.schoolClass.findUnique({
      where: { id },
      include: {
        classTeacher: { select: { firstName: true, lastName: true } },
        students: {
          where: { status: 'ACTIVE' },
          orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
          include: {
            guardians: {
              where: { isPrimary: true },
              include: { guardian: { select: { firstName: true, lastName: true, phone: true } } },
            },
          },
        },
      },
    });
    if (!cls) throw new NotFoundException('Class not found');
    const school = await this.school();
    const buf = await this.pdf.classList({
      school,
      cls,
      students: cls.students.map((s) => ({ ...s, guardian: s.guardians[0]?.guardian ?? null })),
    });
    this.send(res, buf, `${cls.name.replace(/\s+/g, '_')}-class-list.pdf`);
  }

  @Get('classes/:id/register.pdf')
  @RequireFeature('ATTENDANCE')
  @RequirePermissions('ATTENDANCE_VIEW')
  @ApiOperation({ summary: 'Attendance register for a class over a date range (max 12 days per page)' })
  async register(
    @Param('id') id: string,
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Res() res: Response,
  ) {
    const cls = await this.prisma.db.schoolClass.findUnique({
      where: { id },
      include: {
        students: {
          where: { status: 'ACTIVE' },
          orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
          select: { id: true, studentId: true, firstName: true, lastName: true },
        },
      },
    });
    if (!cls) throw new NotFoundException('Class not found');
    const start = from ? toDateOnly(from) : addDays(startOfToday(), -11);
    const end = to ? toDateOnly(to) : startOfToday();
    const rows = await this.prisma.db.attendance.findMany({
      where: { classId: id, date: { gte: start, lte: end } },
      select: { studentId: true, date: true, status: true },
    });
    const dates = [...new Set(rows.map((r) => isoDate(r.date)))].sort();
    if (!dates.length) dates.push(isoDate(end));
    const marks: Record<string, string> = {};
    for (const r of rows) marks[`${r.studentId}|${isoDate(r.date)}`] = r.status;
    const school = await this.school();
    const buf = await this.pdf.attendanceRegister({ school, cls, students: cls.students, dates, marks });
    this.send(res, buf, `${cls.name.replace(/\s+/g, '_')}-register.pdf`);
  }

  @Get('results/report-cards.pdf')
  @RequireFeature('RESULTS')
  @RequirePermissions('RESULT_VIEW')
  @ApiOperation({ summary: 'Every report card of a class for a term in one PDF (one page per student)' })
  async reportCards(
    @Query('termId') termId: string,
    @Query('classId') classId: string,
    @Query('status') status: string | undefined,
    @Res() res: Response,
  ) {
    const db = this.prisma.db;
    const where: any = { termId, classId };
    if (status) where.status = status;
    const sheets = await db.resultSheet.findMany({
      where,
      orderBy: [{ position: 'asc' }, { average: 'desc' }],
      include: {
        student: {
          select: {
            id: true,
            studentId: true,
            firstName: true,
            lastName: true,
            otherNames: true,
            class: { select: { id: true, name: true, level: true } },
          },
        },
      },
    });
    if (!sheets.length) throw new NotFoundException('No result sheets for this class and term');
    const [term, school, snap] = await Promise.all([
      db.term.findUnique({ where: { id: termId }, include: { academicYear: true } }),
      this.school(),
      this.tenants.get(tid()),
    ]);
    const buf = await this.pdf.reportCards(
      sheets.map((s) => ({
        school,
        student: s.student,
        term,
        year: term?.academicYear,
        sheet: s,
        scheme: schemeForLevel(snap.settings, s.student.class?.level),
      })),
    );
    this.send(res, buf, `report-cards-${term?.name.replace(/\s+/g, '_') ?? 'term'}.pdf`);
  }

  @Get('students/:id/transcript.pdf')
  @RequireFeature('RESULTS')
  @RequirePermissions('RESULT_VIEW')
  @ApiOperation({ summary: 'Academic transcript — every published term for a student' })
  async transcript(@Param('id') id: string, @Res() res: Response) {
    const db = this.prisma.db;
    const student = await db.student.findUnique({
      where: { id },
      select: { id: true, studentId: true, firstName: true, lastName: true, class: { select: { name: true } } },
    });
    if (!student) throw new NotFoundException('Student not found');
    const sheets = await db.resultSheet.findMany({
      where: { studentId: id, status: 'PUBLISHED' },
      orderBy: { publishedAt: 'asc' },
    });
    const terms = await db.term.findMany({
      where: { id: { in: [...new Set(sheets.map((s) => s.termId))] } },
      include: { academicYear: { select: { name: true } } },
    });
    const school = await this.school();
    const buf = await this.pdf.transcript({
      school,
      student,
      sheets: sheets.map((s) => ({ ...s, term: terms.find((t) => t.id === s.termId) })),
    });
    this.send(res, buf, `${student.studentId}-transcript.pdf`);
  }

  @Get('students/id-cards.pdf')
  @RequirePermissions('STUDENT_VIEW')
  @ApiOperation({ summary: 'Printable ID card sheet for a class (8 cards per A4 page, signed QR codes)' })
  async idCards(@Query('classId') classId: string, @Res() res: Response) {
    const db = this.prisma.db;
    const cls = await db.schoolClass.findUnique({ where: { id: classId }, select: { name: true } });
    if (!cls) throw new NotFoundException('Class not found');
    const [students, snap, year] = await Promise.all([
      db.student.findMany({
        where: { classId, status: 'ACTIVE' },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        include: { guardians: { where: { isPrimary: true }, include: { guardian: { select: { phone: true } } } } },
      }),
      this.tenants.get(tid()),
      db.academicYear.findFirst({ where: { isCurrent: true } }),
    ]);
    const { createHmac } = await import('crypto');
    const sign = (studentId: string) =>
      createHmac('sha256', process.env.JWT_SECRET || 'dev-access-secret')
        .update(`${snap.code}|${studentId}`)
        .digest('hex')
        .slice(0, 16);
    const school = {
      name: snap.name,
      code: snap.code,
      logoUrl: snap.logoUrl,
      primaryColor: snap.primaryColor,
      secondaryColor: snap.secondaryColor,
    };
    const cards = students.map((s) => ({
      student: {
        id: s.id,
        studentId: s.studentId,
        name: `${s.firstName} ${s.otherNames ? s.otherNames + ' ' : ''}${s.lastName}`,
        className: cls.name,
        gender: s.gender,
        dateOfBirth: s.dateOfBirth,
        photoUrl: s.photoUrl,
        house: s.house,
        emergencyPhone: s.guardians[0]?.guardian.phone ?? s.emergencyContactPhone ?? '',
      },
      school,
      academicYear: year?.name ?? '',
      qrPayload: `SOS1|${snap.code}|${s.studentId}|${sign(s.studentId)}`,
    }));
    const buf = await this.pdf.idCards(cards);
    this.send(res, buf, `${cls.name.replace(/\s+/g, '_')}-id-cards.pdf`);
  }

  @Get('payroll/:runId/payslips/:staffId.pdf')
  @RequireFeature('HR')
  @RequireAnyPermission('LEAVE_REQUEST', 'PAYROLL_MANAGE')
  @ApiOperation({ summary: 'Payslip for one staff member (staff can download their own)' })
  async payslip(@Param('runId') runId: string, @Param('staffId') staffId: string, @Res() res: Response) {
    const c = ctx();
    if (staffId !== c.staffId && !hasPermission(c.permissions, 'PAYROLL_MANAGE'))
      throw new NotFoundException('Payslip not found');
    const item = await this.prisma.db.payrollItem.findUnique({
      where: { runId_staffId: { runId, staffId } },
      include: {
        staff: { select: { employeeId: true, firstName: true, lastName: true, position: true, department: true } },
        run: true,
      },
    });
    if (!item) throw new NotFoundException('Payslip not found');
    const school = await this.school();
    const buf = await this.pdf.payslip({ school, run: item.run, item });
    this.send(res, buf, `payslip-${item.run.period}-${item.staff.employeeId}.pdf`);
  }

  @Get('timetable/:kind/:id.pdf')
  @RequireFeature('TIMETABLE')
  @RequirePermissions('TIMETABLE_VIEW')
  @ApiOperation({ summary: 'Weekly timetable for a class, teacher or room' })
  async timetable(@Param('kind') kind: 'class' | 'teacher' | 'room', @Param('id') id: string, @Res() res: Response) {
    const db = this.prisma.db;
    const where: any = kind === 'teacher' ? { teacherId: id } : kind === 'room' ? { roomId: id } : { classId: id };
    const [periods, slots, school] = await Promise.all([
      db.period.findMany({ orderBy: { sequence: 'asc' } }),
      db.timetableSlot.findMany({
        where,
        include: {
          subject: { select: { name: true } },
          class: { select: { name: true } },
          room: { select: { name: true } },
          teacher: { select: { firstName: true, lastName: true } },
        },
      }),
      this.school(),
    ]);
    let title = '';
    if (kind === 'class')
      title = (await db.schoolClass.findUnique({ where: { id }, select: { name: true } }))?.name ?? 'Class';
    if (kind === 'teacher') {
      const t = await db.staff.findUnique({ where: { id }, select: { firstName: true, lastName: true } });
      title = t ? `${t.firstName} ${t.lastName}` : 'Teacher';
    }
    if (kind === 'room') title = (await db.room.findUnique({ where: { id }, select: { name: true } }))?.name ?? 'Room';
    const buf = await this.pdf.timetable({ school, title, periods, slots });
    this.send(res, buf, `timetable-${title.replace(/\s+/g, '_')}.pdf`);
  }
}
