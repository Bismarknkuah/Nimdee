import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequireFeature, RequirePermissions } from '../common/decorators';
import { AttendanceService } from './attendance.service';
import { MarkAttendanceDto, MarkLessonAttendanceDto } from './dto';

@ApiTags('attendance')
@RequireFeature('ATTENDANCE')
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  @Post('mark') @RequirePermissions('ATTENDANCE_MARK') mark(@Body() dto: MarkAttendanceDto) {
    return this.attendance.mark(dto);
  }
  @Get('my-lessons-today') @RequirePermissions('ATTENDANCE_MARK') myLessonsToday() {
    return this.attendance.myLessonsToday();
  }
  @Get('lessons/:slotId/roster') @RequirePermissions('ATTENDANCE_MARK') lessonRoster(
    @Param('slotId') slotId: string,
    @Query('date') date: string,
  ) {
    return this.attendance.lessonRoster(slotId, date);
  }
  @Post('lessons/mark') @RequirePermissions('ATTENDANCE_MARK') markLesson(@Body() dto: MarkLessonAttendanceDto) {
    return this.attendance.markLesson(dto);
  }
  @Get('register') @RequirePermissions('ATTENDANCE_VIEW') register(
    @Query('classId') classId: string,
    @Query('date') date: string,
  ) {
    return this.attendance.register(classId, date);
  }
  @Get('summary') @RequirePermissions('ATTENDANCE_VIEW') summary(
    @Query('classId') classId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.attendance.summary(classId, from, to);
  }
  @Get('daily') @RequirePermissions('ATTENDANCE_VIEW') daily(@Query('date') date?: string) {
    return this.attendance.daily(date);
  }
  @Get('lessons/completion-today') @RequirePermissions('ATTENDANCE_VIEW') lessonCompletionToday() {
    return this.attendance.lessonCompletionToday();
  }
  @Get('student/:id') @RequirePermissions('ATTENDANCE_VIEW') student(
    @Param('id') id: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.attendance.studentHistory(id, from, to);
  }
}
