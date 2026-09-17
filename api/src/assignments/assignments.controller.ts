import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequireFeature, RequirePermissions } from '../common/decorators';
import { AssignmentsService } from './assignments.service';
import { AssignmentDto, GradeDto } from './dto';

@ApiTags('assignments')
@RequireFeature('ASSIGNMENTS')
@Controller('assignments')
export class AssignmentsController {
  constructor(private readonly assignments: AssignmentsService) {}

  @Get() @RequirePermissions('ASSIGNMENTS_VIEW') list(
    @Query('classId') classId?: string,
    @Query('subjectId') subjectId?: string,
    @Query('status') status?: string,
  ) {
    return this.assignments.list({ classId, subjectId, status });
  }
  @Get('teacher-summary') summary() {
    return this.assignments.teacherSummary();
  }
  @Post() @RequirePermissions('ASSIGNMENTS_MANAGE') create(@Body() dto: AssignmentDto) {
    return this.assignments.create(dto);
  }
  @Get(':id') @RequirePermissions('ASSIGNMENTS_VIEW') get(@Param('id') id: string) {
    return this.assignments.get(id);
  }
  @Patch(':id') @RequirePermissions('ASSIGNMENTS_MANAGE') update(
    @Param('id') id: string,
    @Body() dto: Partial<AssignmentDto>,
  ) {
    return this.assignments.update(id, dto);
  }
  @Delete(':id') @RequirePermissions('ASSIGNMENTS_MANAGE') remove(@Param('id') id: string) {
    return this.assignments.remove(id);
  }
  @Put(':id/grades') @RequirePermissions('ASSIGNMENTS_MANAGE') grade(@Param('id') id: string, @Body() dto: GradeDto) {
    return this.assignments.grade(id, dto);
  }
}
