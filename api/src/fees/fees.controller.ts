import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { RequireFeature, RequirePermissions } from '../common/decorators';
import { tid } from '../common/context/request-context';
import { PdfService } from '../pdf/pdf.service';
import { PrismaService } from '../prisma/prisma.service';
import { TenantCacheService } from '../tenants/tenant-cache.service';
import {
  DiscountDto,
  FeeCategoryDto,
  FeeStructureDto,
  GenerateInvoicesDto,
  InitiateOnlineDto,
  ListInvoicesDto,
  ListPaymentsDto,
  RecordPaymentDto,
  ReverseDto,
} from './dto';
import { FeesService } from './fees.service';
import { PaymentsGatewayService } from './payments.service';
import { FeeRemindersService, ReminderOptions } from './reminders.service';

@ApiTags('fees')
@RequireFeature('FEES')
@Controller('fees')
export class FeesController {
  constructor(
    private readonly fees: FeesService,
    private readonly gateway: PaymentsGatewayService,
    private readonly pdf: PdfService,
    private readonly tenants: TenantCacheService,
    private readonly prisma: PrismaService,
    private readonly reminders: FeeRemindersService,
  ) {}

  @Get('categories') @RequirePermissions('FEES_VIEW') categories() {
    return this.fees.categories();
  }
  @Post('categories') @RequirePermissions('FEES_MANAGE') createCategory(@Body() dto: FeeCategoryDto) {
    return this.fees.createCategory(dto);
  }
  @Patch('categories/:id') @RequirePermissions('FEES_MANAGE') updateCategory(
    @Param('id') id: string,
    @Body() dto: Partial<FeeCategoryDto>,
  ) {
    return this.fees.updateCategory(id, dto);
  }

  @Get('structures') @RequirePermissions('FEES_VIEW') structures(@Query('academicYearId') y?: string) {
    return this.fees.structures(y);
  }
  @Post('structures') @RequirePermissions('FEES_MANAGE') createStructure(@Body() dto: FeeStructureDto) {
    return this.fees.createStructure(dto);
  }
  @Patch('structures/:id') @RequirePermissions('FEES_MANAGE') updateStructure(
    @Param('id') id: string,
    @Body() dto: Partial<FeeStructureDto>,
  ) {
    return this.fees.updateStructure(id, dto);
  }
  @Delete('structures/:id') @RequirePermissions('FEES_MANAGE') deleteStructure(@Param('id') id: string) {
    return this.fees.deleteStructure(id);
  }

  @Get('discounts') @RequirePermissions('FEES_VIEW') discounts(@Query('studentId') s?: string) {
    return this.fees.discounts(s);
  }
  @Post('discounts') @RequirePermissions('DISCOUNT_MANAGE') createDiscount(@Body() dto: DiscountDto) {
    return this.fees.createDiscount(dto);
  }
  @Delete('discounts/:id') @RequirePermissions('DISCOUNT_MANAGE') deleteDiscount(@Param('id') id: string) {
    return this.fees.deleteDiscount(id);
  }

  @Post('invoices/generate') @RequirePermissions('INVOICE_CREATE') generate(@Body() dto: GenerateInvoicesDto) {
    return this.fees.generateInvoices(dto);
  }
  @Get('invoices') @RequirePermissions('FEES_VIEW') invoices(@Query() q: ListInvoicesDto) {
    return this.fees.listInvoices(q);
  }
  @Get('invoices/:id') @RequirePermissions('FEES_VIEW') invoice(@Param('id') id: string) {
    return this.fees.getInvoice(id);
  }
  @Post('invoices/:id/cancel') @RequirePermissions('FEES_MANAGE') cancel(
    @Param('id') id: string,
    @Body() dto: ReverseDto,
  ) {
    return this.fees.cancelInvoice(id, dto.reason);
  }

  @Get('payments') @RequirePermissions('FEES_VIEW') payments(@Query() q: ListPaymentsDto) {
    return this.fees.listPayments(q);
  }
  @Post('payments') @RequirePermissions('PAYMENT_RECORD') record(@Body() dto: RecordPaymentDto) {
    return this.fees.recordPayment(dto);
  }
  @Post('payments/online/initiate') @RequirePermissions('PAYMENT_RECORD') initiate(@Body() dto: InitiateOnlineDto) {
    return this.gateway.initiate(dto);
  }
  @Get('payments/online/verify/:reference') @RequirePermissions('FEES_VIEW') verify(@Param('reference') ref: string) {
    return this.gateway.verify(ref);
  }
  @Get('payments/:id') @RequirePermissions('FEES_VIEW') payment(@Param('id') id: string) {
    return this.fees.getPayment(id);
  }
  @Post('payments/:id/reverse') @RequirePermissions('REFUND_APPROVE') reverse(
    @Param('id') id: string,
    @Body() dto: ReverseDto,
  ) {
    return this.fees.reversePayment(id, dto.reason);
  }

  @Get('payments/:id/receipt.pdf')
  @RequirePermissions('FEES_VIEW')
  async receipt(@Param('id') id: string, @Res() res: Response) {
    const p = await this.fees.getPayment(id);
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

  @Post('reminders') @RequirePermissions('FEES_MANAGE') sendReminders(@Body() body: ReminderOptions) {
    return this.reminders.send(body ?? {});
  }
  @Get('students/:id/statement') @RequirePermissions('FEES_VIEW') statement(@Param('id') id: string) {
    return this.fees.statement(id);
  }
  @Get('summary') @RequirePermissions('FEES_VIEW') summary(@Query('termId') termId?: string) {
    return this.fees.summary(termId);
  }
}
