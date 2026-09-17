import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequireFeature, RequirePermissions } from '../common/decorators';
import { AssignDto, RouteDto, StopDto } from './dto';
import { TransportService } from './transport.service';

@ApiTags('transport')
@RequireFeature('TRANSPORT')
@Controller('transport')
export class TransportController {
  constructor(private readonly transport: TransportService) {}

  @Get('summary') @RequirePermissions('TRANSPORT_VIEW') summary() {
    return this.transport.summary();
  }
  @Get('routes') @RequirePermissions('TRANSPORT_VIEW') routes() {
    return this.transport.routes();
  }
  @Post('routes') @RequirePermissions('TRANSPORT_MANAGE') createRoute(@Body() dto: RouteDto) {
    return this.transport.createRoute(dto);
  }
  @Get('routes/:id') @RequirePermissions('TRANSPORT_VIEW') route(@Param('id') id: string) {
    return this.transport.route(id);
  }
  @Patch('routes/:id') @RequirePermissions('TRANSPORT_MANAGE') updateRoute(
    @Param('id') id: string,
    @Body() dto: Partial<RouteDto>,
  ) {
    return this.transport.updateRoute(id, dto);
  }
  @Delete('routes/:id') @RequirePermissions('TRANSPORT_MANAGE') deleteRoute(@Param('id') id: string) {
    return this.transport.deleteRoute(id);
  }
  @Post('routes/:id/stops') @RequirePermissions('TRANSPORT_MANAGE') addStop(
    @Param('id') id: string,
    @Body() dto: StopDto,
  ) {
    return this.transport.addStop(id, dto);
  }
  @Patch('stops/:id') @RequirePermissions('TRANSPORT_MANAGE') updateStop(
    @Param('id') id: string,
    @Body() dto: Partial<StopDto>,
  ) {
    return this.transport.updateStop(id, dto);
  }
  @Delete('stops/:id') @RequirePermissions('TRANSPORT_MANAGE') deleteStop(@Param('id') id: string) {
    return this.transport.deleteStop(id);
  }
  @Post('assignments') @RequirePermissions('TRANSPORT_MANAGE') assign(@Body() dto: AssignDto) {
    return this.transport.assign(dto);
  }
  @Delete('assignments/:studentId') @RequirePermissions('TRANSPORT_MANAGE') unassign(@Param('studentId') id: string) {
    return this.transport.unassign(id);
  }
  @Get('students/:id') @RequirePermissions('TRANSPORT_VIEW') forStudent(@Param('id') id: string) {
    return this.transport.forStudent(id);
  }
}
