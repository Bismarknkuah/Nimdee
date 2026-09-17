import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequireFeature, RequirePermissions } from '../common/decorators';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@RequireFeature('ANALYTICS')
@RequirePermissions('REPORTS_VIEW')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}
  @Get('enrolment') enrolment() {
    return this.reports.enrolment();
  }
  @Get('attendance') attendance(@Query('from') from?: string, @Query('to') to?: string) {
    return this.reports.attendance(from, to);
  }
  @Get('finance') finance() {
    return this.reports.finance();
  }
  @Get('academic') academic(@Query('termId') termId?: string) {
    return this.reports.academic(termId);
  }
  @Get('staff') staff() {
    return this.reports.staff();
  }
}
