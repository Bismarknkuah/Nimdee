import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequireFeature, RequirePermissions } from '../common/decorators';
import { PeriodDto, SlotDto } from './dto';
import { TimetableService } from './timetable.service';

@ApiTags('timetable')
@RequireFeature('TIMETABLE')
@Controller('timetable')
export class TimetableController {
  constructor(private readonly tt: TimetableService) {}

  @Get('periods') @RequirePermissions('TIMETABLE_VIEW') periods() {
    return this.tt.periods();
  }
  @Post('periods') @RequirePermissions('TIMETABLE_MANAGE') createPeriod(@Body() dto: PeriodDto) {
    return this.tt.createPeriod(dto);
  }
  @Patch('periods/:id') @RequirePermissions('TIMETABLE_MANAGE') updatePeriod(
    @Param('id') id: string,
    @Body() dto: Partial<PeriodDto>,
  ) {
    return this.tt.updatePeriod(id, dto);
  }
  @Delete('periods/:id') @RequirePermissions('TIMETABLE_MANAGE') deletePeriod(@Param('id') id: string) {
    return this.tt.deletePeriod(id);
  }

  @Post('slots') @RequirePermissions('TIMETABLE_MANAGE') createSlot(@Body() dto: SlotDto) {
    return this.tt.createSlot(dto);
  }
  @Patch('slots/:id') @RequirePermissions('TIMETABLE_MANAGE') updateSlot(
    @Param('id') id: string,
    @Body() dto: Partial<SlotDto>,
  ) {
    return this.tt.updateSlot(id, dto);
  }
  @Delete('slots/:id') @RequirePermissions('TIMETABLE_MANAGE') deleteSlot(@Param('id') id: string) {
    return this.tt.deleteSlot(id);
  }

  @Get('my') mine() {
    return this.tt.mine();
  }
  @Get('conflicts') @RequirePermissions('TIMETABLE_MANAGE') conflicts() {
    return this.tt.conflicts();
  }
  @Get('class/:id') @RequirePermissions('TIMETABLE_VIEW') forClass(@Param('id') id: string) {
    return this.tt.forClass(id);
  }
  @Get('teacher/:id') @RequirePermissions('TIMETABLE_VIEW') forTeacher(@Param('id') id: string) {
    return this.tt.forTeacher(id);
  }
  @Get('room/:id') @RequirePermissions('TIMETABLE_VIEW') forRoom(@Param('id') id: string) {
    return this.tt.forRoom(id);
  }
}
