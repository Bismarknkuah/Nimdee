import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../common/decorators';
import { AuditService } from './audit.service';

@ApiTags('audit')
@Controller('audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}
  @Get() @RequirePermissions('AUDIT_VIEW') list(@Query() q: any) {
    return this.audit.list(q);
  }
}
