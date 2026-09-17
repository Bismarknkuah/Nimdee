import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequireAnyPermission, RequireFeature, RequirePermissions } from '../common/decorators';
import { CreatePayrollDto, LeaveRequestDto, LeaveReviewDto, UpdatePayrollItemsDto } from './dto';
import { HrService } from './hr.service';

@ApiTags('hr')
@RequireFeature('HR')
@Controller('hr')
export class HrController {
  constructor(private readonly hr: HrService) {}

  @Get('summary') @RequireAnyPermission('HR_MANAGE', 'PAYROLL_MANAGE') summary() {
    return this.hr.summary();
  }
  @Get('leave') @RequireAnyPermission('LEAVE_REQUEST', 'HR_MANAGE') leave(@Query() q: any) {
    return this.hr.leaveRequests({
      ...q,
      page: Number(q.page) || 1,
      pageSize: Number(q.pageSize) || 25,
      mine: q.mine === 'true',
    });
  }
  @Post('leave') @RequireAnyPermission('LEAVE_REQUEST', 'HR_MANAGE') request(@Body() dto: LeaveRequestDto) {
    return this.hr.requestLeave(dto);
  }
  @Post('leave/:id/review') @RequirePermissions('HR_MANAGE') review(
    @Param('id') id: string,
    @Body() dto: LeaveReviewDto,
  ) {
    return this.hr.reviewLeave(id, dto);
  }
  @Post('leave/:id/cancel') @RequireAnyPermission('LEAVE_REQUEST', 'HR_MANAGE') cancel(@Param('id') id: string) {
    return this.hr.cancelLeave(id);
  }
  @Get('on-leave') @RequirePermissions('STAFF_VIEW') onLeave() {
    return this.hr.onLeave();
  }

  @Get('payroll') @RequirePermissions('PAYROLL_MANAGE') runs() {
    return this.hr.payrollRuns();
  }
  @Post('payroll') @RequirePermissions('PAYROLL_MANAGE') create(@Body() dto: CreatePayrollDto) {
    return this.hr.createPayroll(dto);
  }
  @Get('payroll/:id') @RequirePermissions('PAYROLL_MANAGE') run(@Param('id') id: string) {
    return this.hr.payrollRun(id);
  }
  @Put('payroll/:id/items') @RequirePermissions('PAYROLL_MANAGE') items(
    @Param('id') id: string,
    @Body() dto: UpdatePayrollItemsDto,
  ) {
    return this.hr.updatePayrollItems(id, dto);
  }
  @Post('payroll/:id/approve') @RequirePermissions('PAYROLL_MANAGE') approve(@Param('id') id: string) {
    return this.hr.transitionPayroll(id, 'approve');
  }
  @Post('payroll/:id/pay') @RequirePermissions('PAYROLL_MANAGE') pay(@Param('id') id: string) {
    return this.hr.transitionPayroll(id, 'pay');
  }
  @Post('payroll/:id/reopen') @RequirePermissions('PAYROLL_MANAGE') reopen(@Param('id') id: string) {
    return this.hr.transitionPayroll(id, 'reopen');
  }
  @Get('payroll/:id/payslips/:staffId') @RequireAnyPermission('LEAVE_REQUEST', 'PAYROLL_MANAGE') payslip(
    @Param('id') id: string,
    @Param('staffId') staffId: string,
  ) {
    return this.hr.payslip(id, staffId);
  }
}
