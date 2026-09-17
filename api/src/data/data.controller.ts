import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { AllowInactiveTenant, RequirePermissions } from '../common/decorators';
import { DataExportService, ExportFormat } from './data-export.service';

/** School data ownership: summaries, history and full downloads (admins only). */
@ApiTags('data')
@Controller('data')
export class DataController {
  constructor(private readonly exports: DataExportService) {}
  @Get('summary') @RequirePermissions('SCHOOL_MANAGE') @AllowInactiveTenant() summary() {
    return this.exports.summary();
  }
  @Get('exports') @RequirePermissions('SCHOOL_MANAGE') @AllowInactiveTenant() history() {
    return this.exports.history();
  }
  @Get('export.zip')
  @RequirePermissions('SCHOOL_MANAGE')
  @AllowInactiveTenant()
  async download(@Res() res: Response, @Query('format') format?: string) {
    const f = (
      ['ALL', 'JSON', 'CSV', 'SQL'].includes((format ?? '').toUpperCase()) ? (format as string).toUpperCase() : 'ALL'
    ) as ExportFormat;
    await this.exports.streamZip(res, f);
  }
}
