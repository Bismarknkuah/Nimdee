import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequireFeature, RequirePermissions } from '../common/decorators';
import { HeartbeatDto, PushDto, RegisterDeviceDto, ResolveConflictDto } from './dto';
import { SyncService } from './sync.service';

@ApiTags('sync')
@RequireFeature('OFFLINE_SYNC')
@Controller('sync')
export class SyncController {
  constructor(private readonly sync: SyncService) {}

  @Post('devices/register') register(@Body() dto: RegisterDeviceDto) {
    return this.sync.registerDevice(dto);
  }
  @Post('devices/heartbeat') heartbeat(@Body() dto: HeartbeatDto) {
    return this.sync.heartbeat(dto);
  }
  @Post('push') push(@Body() dto: PushDto) {
    return this.sync.push(dto);
  }
  @Get('pull') pull(@Query('since') since?: string, @Query('classIds') classIds?: string) {
    return this.sync.pull(since, classIds);
  }

  @Get('devices') @RequirePermissions('SYNC_MANAGE') devices() {
    return this.sync.devices();
  }
  @Post('devices/:id/disable') @RequirePermissions('SYNC_MANAGE') disable(@Param('id') id: string) {
    return this.sync.setDeviceActive(id, false);
  }
  @Post('devices/:id/enable') @RequirePermissions('SYNC_MANAGE') enable(@Param('id') id: string) {
    return this.sync.setDeviceActive(id, true);
  }
  @Get('operations') @RequirePermissions('SYNC_MANAGE') operations(
    @Query('deviceId') deviceId?: string,
    @Query('status') status?: string,
  ) {
    return this.sync.operations(deviceId, status);
  }
  @Get('conflicts') @RequirePermissions('SYNC_MANAGE') conflicts(@Query('status') status?: string) {
    return this.sync.conflicts(status);
  }
  @Post('conflicts/:id/resolve') @RequirePermissions('SYNC_MANAGE') resolve(
    @Param('id') id: string,
    @Body() dto: ResolveConflictDto,
  ) {
    return this.sync.resolveConflict(id, dto);
  }
}
