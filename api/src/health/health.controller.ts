import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequireFeature, RequirePermissions } from '../common/decorators';
import { HealthRecordDto, HealthVisitDto } from './dto';
import { HealthService } from './health.service';

@ApiTags('health')
@RequireFeature('HEALTH')
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get('summary') @RequirePermissions('HEALTH_VIEW') summary() {
    return this.health.summary();
  }
  @Get('visits') @RequirePermissions('HEALTH_VIEW') visits(@Query() q: any) {
    return this.health.visits({ ...q, page: Number(q.page) || 1, pageSize: Number(q.pageSize) || 25 });
  }
  @Post('visits') @RequirePermissions('HEALTH_MANAGE') logVisit(@Body() dto: HealthVisitDto) {
    return this.health.logVisit(dto);
  }
  @Get('students/:id') @RequirePermissions('HEALTH_VIEW') record(@Param('id') id: string) {
    return this.health.record(id);
  }
  @Put('students/:id') @RequirePermissions('HEALTH_MANAGE') upsert(
    @Param('id') id: string,
    @Body() dto: HealthRecordDto,
  ) {
    return this.health.upsertRecord(id, dto);
  }
}
