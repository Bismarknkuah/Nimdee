import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequireFeature, RequirePermissions } from '../common/decorators';
import { AnalyticsService } from './analytics.service';

@ApiTags('analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}
  @Get('enrollment') @RequirePermissions('REPORTS_VIEW', 'STUDENT_VIEW') enrollment() {
    return this.analytics.enrollment();
  }
  @Get('attendance') @RequirePermissions('REPORTS_VIEW', 'ATTENDANCE_VIEW') @RequireFeature('ATTENDANCE') attendance(
    @Query('termId') termId?: string,
  ) {
    return this.analytics.attendance(termId);
  }
  @Get('fees') @RequirePermissions('REPORTS_VIEW', 'FEES_VIEW') @RequireFeature('FEES') fees(
    @Query('termId') termId?: string,
  ) {
    return this.analytics.fees(termId);
  }
  @Get('results') @RequirePermissions('REPORTS_VIEW', 'RESULT_VIEW') @RequireFeature('RESULTS') results(
    @Query('termId') termId?: string,
  ) {
    return this.analytics.results(termId);
  }
  @Get('canteen') @RequirePermissions('REPORTS_VIEW', 'CANTEEN_VIEW') @RequireFeature('CANTEEN') canteen(
    @Query('days') days?: string,
  ) {
    return this.analytics.canteen(days ? Math.min(365, Math.max(7, Number(days))) : 30);
  }
  @Get('staff') @RequirePermissions('REPORTS_VIEW', 'STAFF_VIEW') staff() {
    return this.analytics.staff();
  }
  @Get('birthdays') @RequirePermissions('STUDENT_VIEW') birthdays(@Query('days') days?: string) {
    return this.analytics.birthdays(days ? Number(days) : 7);
  }
}
