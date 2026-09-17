import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../common/decorators';
import { CreateUserDto, ListUsersDto, RoleDto, UpdateUserDto } from './dto';
import { UsersService } from './users.service';

@ApiTags('users')
@Controller()
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('users') @RequirePermissions('USERS_MANAGE') list(@Query() q: ListUsersDto) {
    return this.users.list(q);
  }
  @Post('users') @RequirePermissions('USERS_MANAGE') create(@Body() dto: CreateUserDto) {
    return this.users.create(dto);
  }
  @Patch('users/:id') @RequirePermissions('USERS_MANAGE') update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.users.update(id, dto);
  }
  @Post('users/:id/reset-password') @RequirePermissions('USERS_MANAGE') reset(@Param('id') id: string) {
    return this.users.resetPassword(id);
  }

  @Get('roles') @RequirePermissions('USERS_MANAGE') roles() {
    return this.users.roles();
  }
  @Get('roles/permissions') @RequirePermissions('USERS_MANAGE') catalog() {
    return this.users.permissionCatalog();
  }
  @Post('roles') @RequirePermissions('ROLES_MANAGE') createRole(@Body() dto: RoleDto) {
    return this.users.createRole(dto);
  }
  @Patch('roles/:id') @RequirePermissions('ROLES_MANAGE') updateRole(
    @Param('id') id: string,
    @Body() dto: Partial<RoleDto>,
  ) {
    return this.users.updateRole(id, dto);
  }
  @Delete('roles/:id') @RequirePermissions('ROLES_MANAGE') deleteRole(@Param('id') id: string) {
    return this.users.deleteRole(id);
  }
}
