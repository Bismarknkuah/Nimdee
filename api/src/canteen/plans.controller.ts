import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequireFeature, RequirePermissions } from '../common/decorators';
import { CanteenPlanDto, EnrolDto, EnrolmentQueryDto, PlanItemsDto } from './plans.dto';
import { CanteenPlansService } from './plans.service';

@ApiTags('canteen-plans')
@RequireFeature('CANTEEN')
@Controller('canteen/plans')
export class CanteenPlansController {
  constructor(private readonly plans: CanteenPlansService) {}

  @Get() @RequirePermissions('CANTEEN_VIEW') list() {
    return this.plans.list();
  }
  @Get('summary') @RequirePermissions('CANTEEN_VIEW') summary() {
    return this.plans.summary();
  }
  @Get('enrolments') @RequirePermissions('CANTEEN_VIEW') enrolments(@Query() q: EnrolmentQueryDto) {
    return this.plans.enrolments(q);
  }
  @Get('student/:studentId') @RequirePermissions('CANTEEN_VIEW') student(@Param('studentId') id: string) {
    return this.plans.studentPlan(id);
  }
  @Get('feeding-classes') @RequirePermissions('CANTEEN_VIEW') feedingClasses() {
    return this.plans.feedingClasses();
  }
  @Patch('feeding-classes') @RequirePermissions('CANTEEN_MANAGE') updateFeedingClasses(
    @Body() dto: { exemptClassIds: string[] },
  ) {
    return this.plans.updateFeedingClasses(dto.exemptClassIds);
  }
  @Get('menu') @RequirePermissions('CANTEEN_VIEW') menu() {
    return this.plans.weeklyMenu();
  }
  @Patch('menu') @RequirePermissions('CANTEEN_MANAGE') updateMenu(@Body() dto: { weeklyMenu: Record<string, string> }) {
    return this.plans.updateWeeklyMenu(dto.weeklyMenu);
  }
  @Post('feeding-charges/preview') @RequirePermissions('CANTEEN_MANAGE') previewFeedingCharge(
    @Body() dto: { studentId: string; planId: string; periodType: string; referenceDate?: string },
  ) {
    return this.plans.previewFeedingCharge(dto);
  }
  @Post('feeding-charges') @RequirePermissions('CANTEEN_MANAGE') chargeFeedingPeriod(
    @Body() dto: { studentId: string; planId: string; periodType: string; referenceDate?: string; bill: boolean },
  ) {
    return this.plans.chargeFeedingPeriod(dto);
  }
  @Get('feeding-charges') @RequirePermissions('CANTEEN_VIEW') feedingChargeHistory(@Query('studentId') studentId?: string) {
    return this.plans.feedingChargeHistory(studentId);
  }
  @Post() @RequirePermissions('CANTEEN_MANAGE') create(@Body() dto: CanteenPlanDto) {
    return this.plans.create(dto);
  }
  @Post('allowances/run') @RequirePermissions('CANTEEN_MANAGE') allowances() {
    return this.plans.runAllowances();
  }
  @Get(':id') @RequirePermissions('CANTEEN_VIEW') get(@Param('id') id: string) {
    return this.plans.get(id);
  }
  @Patch(':id') @RequirePermissions('CANTEEN_MANAGE') update(
    @Param('id') id: string,
    @Body() dto: Partial<CanteenPlanDto>,
  ) {
    return this.plans.update(id, dto);
  }
  @Delete(':id') @RequirePermissions('CANTEEN_MANAGE') remove(@Param('id') id: string) {
    return this.plans.remove(id);
  }
  @Put(':id/items') @RequirePermissions('CANTEEN_MANAGE') items(@Param('id') id: string, @Body() dto: PlanItemsDto) {
    return this.plans.update(id, { itemIds: dto.itemIds });
  }
  @Post(':id/enrol') @RequirePermissions('CANTEEN_MANAGE') enrol(@Param('id') id: string, @Body() dto: EnrolDto) {
    return this.plans.enrol(id, dto);
  }
  @Post('enrolments/:id/end') @RequirePermissions('CANTEEN_MANAGE') end(@Param('id') id: string) {
    return this.plans.setEnrolmentStatus(id, 'ENDED');
  }
  @Post('enrolments/:id/suspend') @RequirePermissions('CANTEEN_MANAGE') suspend(@Param('id') id: string) {
    return this.plans.setEnrolmentStatus(id, 'SUSPENDED');
  }
  @Post('enrolments/:id/resume') @RequirePermissions('CANTEEN_MANAGE') resume(@Param('id') id: string) {
    return this.plans.setEnrolmentStatus(id, 'ACTIVE');
  }
}
