import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequireAnyPermission, RequirePermissions } from '../common/decorators';
import { AdmissionsService } from './admissions.service';
import { AdmissionStatusDto, AdmitDto, ListAdmissionsDto } from './dto';

@ApiTags('admissions')
@Controller('admissions')
export class AdmissionsController {
  constructor(private readonly admissions: AdmissionsService) {}
  @Get() @RequireAnyPermission('ADMISSIONS_VIEW', 'ADMISSIONS_MANAGE') list(@Query() q: ListAdmissionsDto) {
    return this.admissions.list(q);
  }
  @Get(':id') @RequireAnyPermission('ADMISSIONS_VIEW', 'ADMISSIONS_MANAGE') get(@Param('id') id: string) {
    return this.admissions.get(id);
  }
  @Patch(':id/status') @RequirePermissions('ADMISSIONS_MANAGE') status(
    @Param('id') id: string,
    @Body() dto: AdmissionStatusDto,
  ) {
    return this.admissions.setStatus(id, dto);
  }
  @Post(':id/admit') @RequirePermissions('ADMISSIONS_MANAGE', 'STUDENT_CREATE') admit(
    @Param('id') id: string,
    @Body() dto: AdmitDto,
  ) {
    return this.admissions.admit(id, dto);
  }
}
