import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AllowInactiveTenant, RequireFeature, RequirePermissions } from '../common/decorators';
import { CommunicationsService } from './communications.service';
import { AnnouncementDto } from './dto';

@ApiTags('communications')
@Controller()
export class CommunicationsController {
  constructor(private readonly comms: CommunicationsService) {}

  @Get('announcements') @RequireFeature('COMMUNICATIONS') @RequirePermissions('ANNOUNCEMENT_MANAGE') list() {
    return this.comms.list();
  }
  @Post('announcements') @RequireFeature('COMMUNICATIONS') @RequirePermissions('ANNOUNCEMENT_MANAGE') create(
    @Body() dto: AnnouncementDto,
  ) {
    return this.comms.create(dto);
  }
  @Patch('announcements/:id') @RequireFeature('COMMUNICATIONS') @RequirePermissions('ANNOUNCEMENT_MANAGE') update(
    @Param('id') id: string,
    @Body() dto: Partial<AnnouncementDto>,
  ) {
    return this.comms.update(id, dto);
  }
  @Post('announcements/:id/publish')
  @RequireFeature('COMMUNICATIONS')
  @RequirePermissions('ANNOUNCEMENT_MANAGE')
  publish(@Param('id') id: string) {
    return this.comms.publish(id);
  }
  @Delete('announcements/:id') @RequireFeature('COMMUNICATIONS') @RequirePermissions('ANNOUNCEMENT_MANAGE') remove(
    @Param('id') id: string,
  ) {
    return this.comms.remove(id);
  }

  @Get('notifications/me') @AllowInactiveTenant() mine() {
    return this.comms.myNotifications();
  }
  @Post('notifications/read-all') @AllowInactiveTenant() readAll() {
    return this.comms.markRead();
  }
  @Post('notifications/:id/read') @AllowInactiveTenant() read(@Param('id') id: string) {
    return this.comms.markRead(id);
  }
}
