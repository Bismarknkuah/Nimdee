import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { RequireFeature, RequirePermissions } from '../common/decorators';
import { AssessmentDto, CommentsDto, ComputeDto, SaveMarksDto, WorkflowDto } from './dto';
import { ResultsService } from './results.service';

@ApiTags('results')
@RequireFeature('RESULTS')
@Controller('results')
export class ResultsController {
  constructor(private readonly results: ResultsService) {}

  @Get('workflow') @RequirePermissions('RESULT_VIEW') workflow() {
    return this.results.workflowInfo();
  }
  @Get('assessments') @RequirePermissions('RESULT_VIEW') assessments(
    @Query('termId') termId: string,
    @Query('classId') classId?: string,
    @Query('subjectId') subjectId?: string,
  ) {
    return this.results.assessments(termId, classId, subjectId);
  }
  @Post('assessments') @RequirePermissions('RESULT_ENTER') createAssessment(@Body() dto: AssessmentDto) {
    return this.results.createAssessment(dto);
  }
  @Patch('assessments/:id') @RequirePermissions('RESULT_ENTER') updateAssessment(
    @Param('id') id: string,
    @Body() dto: Partial<AssessmentDto>,
  ) {
    return this.results.updateAssessment(id, dto);
  }
  @Delete('assessments/:id') @RequirePermissions('RESULT_ENTER') deleteAssessment(@Param('id') id: string) {
    return this.results.deleteAssessment(id);
  }
  @Get('assessments/:id/marks') @RequirePermissions('RESULT_VIEW') marks(@Param('id') id: string) {
    return this.results.marks(id);
  }
  @Put('assessments/:id/marks') @RequirePermissions('RESULT_ENTER') saveMarks(
    @Param('id') id: string,
    @Body() dto: SaveMarksDto,
  ) {
    return this.results.saveMarks(id, dto);
  }

  @Post('compute') @RequirePermissions('RESULT_ENTER') compute(@Body() dto: ComputeDto) {
    return this.results.compute(dto);
  }
  @Post('submit') @RequirePermissions('RESULT_ENTER') submit(@Body() dto: WorkflowDto) {
    return this.results.transition('submit', dto);
  }
  @Post('review') @RequirePermissions('RESULT_REVIEW') review(@Body() dto: WorkflowDto) {
    return this.results.transition('review', dto);
  }
  @Post('approve') @RequirePermissions('RESULT_APPROVE') approve(@Body() dto: WorkflowDto) {
    return this.results.transition('approve', dto);
  }
  @Post('publish') @RequirePermissions('RESULT_PUBLISH') publish(@Body() dto: WorkflowDto) {
    return this.results.transition('publish', dto);
  }
  @Post('reject') @RequirePermissions('RESULT_REVIEW') reject(@Body() dto: WorkflowDto) {
    return this.results.transition('reject', dto);
  }

  @Get('overview') @RequirePermissions('RESULT_VIEW') overview(@Query('termId') termId: string) {
    return this.results.termOverview(termId);
  }
  @Get('sheets') @RequirePermissions('RESULT_VIEW') sheets(
    @Query('termId') termId: string,
    @Query('classId') classId?: string,
    @Query('status') status?: string,
  ) {
    return this.results.sheets(termId, classId, status);
  }
  @Get('sheets/:id') @RequirePermissions('RESULT_VIEW') sheet(@Param('id') id: string) {
    return this.results.sheet(id);
  }
  @Patch('sheets/:id/comments') @RequirePermissions('RESULT_ENTER') comments(
    @Param('id') id: string,
    @Body() dto: CommentsDto,
  ) {
    return this.results.comments(id, dto);
  }
  @Get('sheets/:id/report-card.pdf')
  @RequirePermissions('RESULT_VIEW')
  async pdf(@Param('id') id: string, @Res() res: Response) {
    const { buffer, filename } = await this.results.reportCardPdf(id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.send(buffer);
  }
}
