import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequireFeature, RequirePermissions } from '../common/decorators';
import { EventDto, EVENT_TYPES, ListEventsDto } from './dto';
import { EventsService } from './events.service';

@ApiTags('events')
@RequireFeature('EVENTS')
@Controller('events')
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Get('types') types() {
    return EVENT_TYPES;
  }
  @Get() list(@Query() q: ListEventsDto) {
    return this.events.list(q, { forUserAudience: true });
  }
  @Get('all') @RequirePermissions('EVENTS_MANAGE') listAll(@Query() q: ListEventsDto) {
    return this.events.list(q);
  }
  @Get('upcoming') upcoming() {
    return this.events.upcoming();
  }
  @Get('calendar') calendar(@Query('year') year: string, @Query('month') month: string) {
    const now = new Date();
    return this.events.calendar(Number(year) || now.getUTCFullYear(), Number(month) || now.getUTCMonth() + 1);
  }
  @Get(':id') get(@Param('id') id: string) {
    return this.events.get(id);
  }
  @Post() @RequirePermissions('EVENTS_MANAGE') create(@Body() dto: EventDto) {
    return this.events.create(dto);
  }
  @Patch(':id') @RequirePermissions('EVENTS_MANAGE') update(@Param('id') id: string, @Body() dto: Partial<EventDto>) {
    return this.events.update(id, dto);
  }
  @Delete(':id') @RequirePermissions('EVENTS_MANAGE') remove(@Param('id') id: string) {
    return this.events.remove(id);
  }
}
