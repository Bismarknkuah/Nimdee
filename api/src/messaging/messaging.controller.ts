import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequireFeature, RequirePermissions } from '../common/decorators';
import { SendMessageDto, StartThreadDto } from './dto';
import { MessagingService } from './messaging.service';

@ApiTags('messaging')
@RequireFeature('MESSAGING')
@Controller('messages')
export class MessagingController {
  constructor(private readonly messaging: MessagingService) {}

  @Get('contacts') @RequirePermissions('MESSAGES_SEND') contacts() {
    return this.messaging.contacts();
  }
  @Get('threads') @RequirePermissions('MESSAGES_SEND') threads() {
    return this.messaging.threads();
  }
  @Get('unread-count') @RequirePermissions('MESSAGES_SEND') unread() {
    return this.messaging.unreadCount().then((count) => ({ count }));
  }
  @Post('threads') @RequirePermissions('MESSAGES_SEND') start(@Body() dto: StartThreadDto) {
    return this.messaging.start(dto);
  }
  @Get('threads/:id') @RequirePermissions('MESSAGES_SEND') thread(@Param('id') id: string) {
    return this.messaging.thread(id);
  }
  @Post('threads/:id') @RequirePermissions('MESSAGES_SEND') send(@Param('id') id: string, @Body() dto: SendMessageDto) {
    return this.messaging.send(id, dto);
  }
}
