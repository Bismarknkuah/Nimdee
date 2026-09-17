import { Body, Controller, Get, Param, Patch, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { requestContext, ctx } from '../common/context/request-context';
import { DataExportService, ExportFormat } from '../data/data-export.service';
import { ApiTags } from '@nestjs/swagger';
import { PlatformOnly } from '../common/decorators';
import {
  FeaturesDto,
  ListSchoolsDto,
  MarkPaidDto,
  PlanDto,
  PlatformAuditDto,
  PlatformUserDto,
  ReasonDto,
  SubInvoiceDto,
  SubscriptionUpdateDto,
  SupportSessionDto,
  UpdateTenantDto,
} from './dto';
import { PlatformService } from './platform.service';

@ApiTags('platform')
@PlatformOnly()
@Controller('platform')
export class PlatformController {
  constructor(
    private readonly platform: PlatformService,
    private readonly exports: DataExportService,
  ) {}

  @Get('stats') stats() {
    return this.platform.stats();
  }
  @Get('schools') schools(@Query() q: ListSchoolsDto) {
    return this.platform.listSchools(q);
  }
  @Get('schools/:id') school(@Param('id') id: string) {
    return this.platform.getSchool(id);
  }
  @Patch('schools/:id') update(@Param('id') id: string, @Body() dto: UpdateTenantDto) {
    return this.platform.updateSchool(id, dto);
  }
  @Post('schools/:id/approve') approve(@Param('id') id: string, @Body() dto: ReasonDto) {
    return this.platform.setStatus(id, 'ACTIVE', dto.reason);
  }
  @Post('schools/:id/activate') activate(@Param('id') id: string, @Body() dto: ReasonDto) {
    return this.platform.setStatus(id, 'ACTIVE', dto.reason);
  }
  @Post('schools/:id/suspend') suspend(@Param('id') id: string, @Body() dto: ReasonDto) {
    return this.platform.setStatus(id, 'SUSPENDED', dto.reason);
  }
  @Post('schools/:id/reject') reject(@Param('id') id: string, @Body() dto: ReasonDto) {
    return this.platform.setStatus(id, 'REJECTED', dto.reason);
  }
  @Patch('schools/:id/features') features(@Param('id') id: string, @Body() dto: FeaturesDto) {
    return this.platform.setFeatures(id, dto);
  }
  @Post('schools/:id/support-session') support(@Param('id') id: string, @Body() dto: SupportSessionDto) {
    return this.platform.supportSession(id, dto.reason);
  }
  @Patch('schools/:id/subscription') subscription(@Param('id') id: string, @Body() dto: SubscriptionUpdateDto) {
    return this.platform.updateSubscription(id, dto);
  }
  @Post('schools/:id/subscription/invoices') createInvoice(@Param('id') id: string, @Body() dto: SubInvoiceDto) {
    return this.platform.createSubscriptionInvoice(id, dto);
  }

  /** Platform-side copy of a school's full data (audited, runs under that school's tenant context). */
  @Get('schools/:id/data-summary') dataSummary(@Param('id') id: string) {
    return requestContext.run({ ...ctx(), tenantId: id }, () => this.exports.summary());
  }
  @Get('schools/:id/export.zip')
  async exportSchool(@Param('id') id: string, @Res() res: Response, @Query('format') format?: string) {
    const f = (
      ['ALL', 'JSON', 'CSV', 'SQL'].includes((format ?? '').toUpperCase()) ? (format as string).toUpperCase() : 'ALL'
    ) as ExportFormat;
    await requestContext.run({ ...ctx(), tenantId: id }, () => this.exports.streamZip(res, f));
  }

  @Get('subscription-invoices') subInvoices(@Query() q: any) {
    return this.platform.listSubscriptionInvoices(q);
  }
  @Post('subscription-invoices/:id/mark-paid') markPaid(@Param('id') id: string, @Body() dto: MarkPaidDto) {
    return this.platform.markInvoicePaid(id, dto);
  }

  @Get('plans') plans() {
    return this.platform.plans();
  }
  @Post('plans') createPlan(@Body() dto: PlanDto) {
    return this.platform.createPlan(dto);
  }
  @Patch('plans/:id') updatePlan(@Param('id') id: string, @Body() dto: Partial<PlanDto>) {
    return this.platform.updatePlan(id, dto);
  }

  @Get('users') users() {
    return this.platform.platformUsers();
  }
  @Post('users') createUser(@Body() dto: PlatformUserDto) {
    return this.platform.createPlatformUser(dto);
  }
  @Patch('users/:id') updateUser(@Param('id') id: string, @Body() dto: Partial<PlatformUserDto>) {
    return this.platform.updatePlatformUser(id, dto);
  }

  @Get('audit') audit(@Query() q: PlatformAuditDto) {
    return this.platform.auditLogs(q);
  }
  @Get('sync-overview') sync() {
    return this.platform.syncOverview();
  }
}
