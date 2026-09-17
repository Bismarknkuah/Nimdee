import { Body, Controller, Get, Param, Post, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { RequireFeature } from '../common/decorators';
import { tid } from '../common/context/request-context';
import { InitiateOnlineDto } from '../fees/dto';
import { SubmitDto } from '../assignments/dto';
import { PdfService } from '../pdf/pdf.service';
import { PrismaService } from '../prisma/prisma.service';
import { TenantCacheService } from '../tenants/tenant-cache.service';
import { PortalService } from './portal.service';

@ApiTags('portal')
@RequireFeature('PARENT_PORTAL')
@Controller('portal')
export class PortalController {
  constructor(
    private readonly portal: PortalService,
    private readonly pdf: PdfService,
    private readonly tenants: TenantCacheService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('overview') overview() {
    return this.portal.overview();
  }
  @Get('children/:id') child(@Param('id') id: string) {
    return this.portal.child(id);
  }
  @Get('children/:id/attendance') attendance(
    @Param('id') id: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.portal.childAttendance(id, from, to);
  }
  @Get('children/:id/results') results(@Param('id') id: string) {
    return this.portal.childResults(id);
  }
  @Get('children/:id/fees') fees(@Param('id') id: string) {
    return this.portal.childFees(id);
  }
  @Get('children/:id/timetable') timetable(@Param('id') id: string) {
    return this.portal.childTimetable(id);
  }
  @Get('children/:id/wallet') wallet(@Param('id') id: string) {
    return this.portal.childWallet(id);
  }
  @Get('children/:id/canteen-plan') canteenPlan(@Param('id') id: string) {
    return this.portal.childCanteenPlan(id);
  }
  @Post('children/:id/canteen-plan') choosePlan(@Param('id') id: string, @Body() body: { planId: string }) {
    return this.portal.chooseCanteenPlan(id, body?.planId);
  }
  @Get('children/:id/assignments') assignments(@Param('id') id: string) {
    return this.portal.childAssignments(id);
  }
  @Post('children/:id/assignments/:assignmentId/submit') submit(
    @Param('id') id: string,
    @Param('assignmentId') aid: string,
    @Body() dto: SubmitDto,
  ) {
    return this.portal.submitAssignment(id, aid, dto);
  }
  @Get('children/:id/discipline') discipline(@Param('id') id: string) {
    return this.portal.childDiscipline(id);
  }
  @Get('children/:id/health') health(@Param('id') id: string) {
    return this.portal.childHealth(id);
  }
  @Get('children/:id/transport') transport(@Param('id') id: string) {
    return this.portal.childTransport(id);
  }
  @Get('children/:id/library') library(@Param('id') id: string) {
    return this.portal.childLibrary(id);
  }
  @Get('children/:id/events') events(@Param('id') id: string) {
    return this.portal.childEvents(id);
  }
  @Post('payments/initiate') pay(@Body() dto: InitiateOnlineDto) {
    return this.portal.pay(dto);
  }
  @Get('payments/verify/:reference') verify(@Param('reference') ref: string) {
    return this.portal.verifyPayment(ref);
  }

  @Get('children/:id/results/:sheetId/report-card.pdf')
  async reportCard(@Param('id') id: string, @Param('sheetId') sheetId: string, @Res() res: Response) {
    const { buffer, filename } = await this.portal.childReportCard(id, sheetId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.send(buffer);
  }

  @Get('payments/:id/receipt.pdf')
  async receipt(@Param('id') id: string, @Res() res: Response) {
    const p = await this.portal.receiptPdf(id);
    const snap = await this.tenants.get(tid());
    const school = await this.prisma.db.tenant.findUnique({
      where: { id: tid() },
      select: { address: true, phone: true, email: true },
    });
    const buf = await this.pdf.receipt({
      school: { name: snap.name, code: snap.code, primaryColor: snap.primaryColor, currency: snap.currency, ...school },
      payment: p,
      student: p.student,
      invoice: p.invoice,
      balance: Number(p.student.account?.balance ?? 0),
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${p.receiptNumber ?? 'receipt'}.pdf"`);
    res.send(buf);
  }
}
