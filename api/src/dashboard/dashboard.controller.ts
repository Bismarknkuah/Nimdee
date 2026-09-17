import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequireFeature, RequirePermissions } from '../common/decorators';
import { DashboardService } from './dashboard.service';

@ApiTags('dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}
  @Get('school') @RequirePermissions('REPORTS_VIEW') school() {
    return this.dashboard.school();
  }
  @Get('teacher') teacher() {
    return this.dashboard.teacher();
  }
  @Get('finance') @RequireFeature('FEES') @RequirePermissions('FEES_VIEW') finance() {
    return this.dashboard.finance();
  }
  @Get('canteen') @RequireFeature('CANTEEN') @RequirePermissions('CANTEEN_VIEW') canteen() {
    return this.dashboard.canteen();
  }
}
