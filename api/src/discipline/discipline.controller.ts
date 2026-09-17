import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequireFeature, RequirePermissions } from '../common/decorators';
import { DisciplineService } from './discipline.service';
import { CreateIncidentDto, DISCIPLINE_CATEGORIES, ListIncidentsDto, UpdateIncidentDto } from './dto';

@ApiTags('discipline')
@RequireFeature('DISCIPLINE')
@Controller('discipline')
export class DisciplineController {
  constructor(private readonly discipline: DisciplineService) {}

  @Get('categories')
  @ApiOperation({ summary: 'Incident categories available to the school' })
  categories() {
    return DISCIPLINE_CATEGORIES;
  }

  @Get('overview')
  @RequirePermissions('DISCIPLINE_VIEW')
  @ApiOperation({ summary: 'School-wide behaviour overview (trends, categories, classes, top students)' })
  overview() {
    return this.discipline.overview();
  }

  @Get('incidents')
  @RequirePermissions('DISCIPLINE_VIEW')
  list(@Query() q: ListIncidentsDto) {
    return this.discipline.list(q);
  }

  @Post('incidents')
  @RequirePermissions('DISCIPLINE_MANAGE')
  create(@Body() dto: CreateIncidentDto) {
    return this.discipline.create(dto);
  }

  @Get('incidents/:id')
  @RequirePermissions('DISCIPLINE_VIEW')
  get(@Param('id') id: string) {
    return this.discipline.get(id);
  }

  @Patch('incidents/:id')
  @RequirePermissions('DISCIPLINE_MANAGE')
  update(@Param('id') id: string, @Body() dto: UpdateIncidentDto) {
    return this.discipline.update(id, dto);
  }

  @Delete('incidents/:id')
  @RequirePermissions('DISCIPLINE_MANAGE')
  remove(@Param('id') id: string) {
    return this.discipline.remove(id);
  }

  @Get('students/:id/summary')
  @RequirePermissions('DISCIPLINE_VIEW')
  studentSummary(@Param('id') id: string) {
    return this.discipline.studentSummary(id);
  }
}
