import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../common/decorators';
import { AcademicService } from './academic.service';
import { RolloverService } from './rollover.service';
import { RolloverDto } from './rollover.dto';
import { ClassDto, RoomDto, SetClassSubjectsDto, SubjectDto, TermDto, YearDto } from './dto';

@ApiTags('academic')
@Controller('academic')
export class AcademicController {
  constructor(
    private readonly academic: AcademicService,
    private readonly rollover: RolloverService,
  ) {}

  @Get('current') current() {
    return this.academic.current();
  }

  /** Ghana basic-school presets (KG / Primary / JHS classes, GES subjects, residency) and what this school has set up. */
  @Get('ghana-basic') ghanaBasic() {
    return this.academic.ghanaBasicCatalogue();
  }
  /** Creates the standard classes + GES subjects for the school's levels and links the promotion path. Idempotent. */
  @Post('ghana-basic/setup') @RequirePermissions('ACADEMIC_MANAGE') ghanaBasicSetup(@Body() body: { levels?: Array<'KG' | 'PRIMARY' | 'JHS'>; attachSubjects?: boolean }) {
    return this.academic.ghanaBasicSetup(body ?? {});
  }
  @Get('years') years() {
    return this.academic.years();
  }
  @Post('rollover/preview') @RequirePermissions('ACADEMIC_MANAGE') rolloverPreview(@Body() dto: Partial<RolloverDto>) {
    return this.rollover.preview(dto);
  }
  @Post('rollover') @RequirePermissions('SCHOOL_MANAGE') rolloverCommit(@Body() dto: RolloverDto) {
    return this.rollover.commit(dto);
  }
  @Post('years') @RequirePermissions('ACADEMIC_MANAGE') createYear(@Body() dto: YearDto) {
    return this.academic.createYear(dto);
  }
  @Patch('years/:id') @RequirePermissions('ACADEMIC_MANAGE') updateYear(
    @Param('id') id: string,
    @Body() dto: Partial<YearDto>,
  ) {
    return this.academic.updateYear(id, dto);
  }

  @Get('terms') terms(@Query('academicYearId') y?: string) {
    return this.academic.terms(y);
  }
  @Post('terms') @RequirePermissions('ACADEMIC_MANAGE') createTerm(@Body() dto: TermDto) {
    return this.academic.createTerm(dto);
  }
  @Patch('terms/:id') @RequirePermissions('ACADEMIC_MANAGE') updateTerm(
    @Param('id') id: string,
    @Body() dto: Partial<TermDto>,
  ) {
    return this.academic.updateTerm(id, dto);
  }

  @Get('classes') classes() {
    return this.academic.classes();
  }
  @Get('classes/:id') getClass(@Param('id') id: string) {
    return this.academic.getClass(id);
  }
  @Post('classes') @RequirePermissions('ACADEMIC_MANAGE') createClass(@Body() dto: ClassDto) {
    return this.academic.createClass(dto);
  }
  @Patch('classes/:id') @RequirePermissions('ACADEMIC_MANAGE') updateClass(
    @Param('id') id: string,
    @Body() dto: Partial<ClassDto>,
  ) {
    return this.academic.updateClass(id, dto);
  }
  @Delete('classes/:id') @RequirePermissions('ACADEMIC_MANAGE') deleteClass(@Param('id') id: string) {
    return this.academic.deleteClass(id);
  }
  @Put('classes/:id/subjects') @RequirePermissions('ACADEMIC_MANAGE') setSubjects(
    @Param('id') id: string,
    @Body() dto: SetClassSubjectsDto,
  ) {
    return this.academic.setClassSubjects(id, dto);
  }

  @Get('subjects') subjects() {
    return this.academic.subjects();
  }
  @Post('subjects') @RequirePermissions('ACADEMIC_MANAGE') createSubject(@Body() dto: SubjectDto) {
    return this.academic.createSubject(dto);
  }
  @Patch('subjects/:id') @RequirePermissions('ACADEMIC_MANAGE') updateSubject(
    @Param('id') id: string,
    @Body() dto: Partial<SubjectDto>,
  ) {
    return this.academic.updateSubject(id, dto);
  }
  @Delete('subjects/:id') @RequirePermissions('ACADEMIC_MANAGE') deleteSubject(@Param('id') id: string) {
    return this.academic.deleteSubject(id);
  }

  @Get('rooms') rooms() {
    return this.academic.rooms();
  }
  @Post('rooms') @RequirePermissions('ACADEMIC_MANAGE') createRoom(@Body() dto: RoomDto) {
    return this.academic.createRoom(dto);
  }
  @Delete('rooms/:id') @RequirePermissions('ACADEMIC_MANAGE') deleteRoom(@Param('id') id: string) {
    return this.academic.deleteRoom(id);
  }
}
