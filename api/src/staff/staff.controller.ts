import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../common/decorators';
import { CreateStaffDto, ListStaffDto, UpdateStaffDto } from './dto';
import { StaffService } from './staff.service';

@ApiTags('staff')
@Controller('staff')
export class StaffController {
  constructor(private readonly staff: StaffService) {}

  @Get('my-classes') myClasses() {
    return this.staff.myClasses();
  }
  @Get() @RequirePermissions('STAFF_VIEW') list(@Query() q: ListStaffDto) {
    return this.staff.list(q);
  }
  @Post() @RequirePermissions('STAFF_MANAGE') create(@Body() dto: CreateStaffDto) {
    return this.staff.create(dto);
  }
  @Get(':id') @RequirePermissions('STAFF_VIEW') get(@Param('id') id: string) {
    return this.staff.get(id);
  }
  @Patch(':id') @RequirePermissions('STAFF_MANAGE') update(@Param('id') id: string, @Body() dto: UpdateStaffDto) {
    return this.staff.update(id, dto);
  }
  @Post(':id/login') @RequirePermissions('USERS_MANAGE') login(
    @Param('id') id: string,
    @Body() body: { roleName?: string; email?: string; password?: string },
  ) {
    return this.staff.createLogin(id, body?.roleName, body?.email, body?.password);
  }
}
