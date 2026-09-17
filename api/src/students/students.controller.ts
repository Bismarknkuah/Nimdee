import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { StudentImportService } from './import.service';
import { ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../common/decorators';
import {
  CreateGuardianDto,
  CreateStudentDto,
  LinkGuardianDto,
  ListGuardiansDto,
  ListStudentsDto,
  PromoteDto,
  UpdateStudentDto,
  VerifyQrDto,
} from './dto';
import { GuardiansService } from './guardians.service';
import { StudentsService } from './students.service';

@ApiTags('students')
@Controller()
export class StudentsController {
  constructor(
    private readonly students: StudentsService,
    private readonly guardians: GuardiansService,
    private readonly importer: StudentImportService,
  ) {}

  @Get('students') @RequirePermissions('STUDENT_VIEW') list(@Query() q: ListStudentsDto) {
    return this.students.list(q);
  }
  @Post('students') @RequirePermissions('STUDENT_CREATE') create(@Body() dto: CreateStudentDto) {
    return this.students.create(dto);
  }
  @Post('students/promote') @RequirePermissions('STUDENT_EDIT') promote(@Body() dto: PromoteDto) {
    return this.students.promote(dto);
  }
  @Get('students/import/template.csv') @RequirePermissions('STUDENT_CREATE') template(@Res() res: Response) {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="students-import-template.csv"');
    res.send('\uFEFF' + this.importer.template());
  }
  @Post('students/import/preview') @RequirePermissions('STUDENT_CREATE') preview(@Body() body: { csv: string }) {
    return this.importer.validate(body?.csv ?? '').then(({ checked, ...r }) => r);
  }
  @Post('students/import') @RequirePermissions('STUDENT_CREATE') import(
    @Body() body: { csv: string; skipDuplicates?: boolean },
  ) {
    return this.importer.commit(body?.csv ?? '', { skipDuplicates: body?.skipDuplicates });
  }
  @Post('students/verify-qr') @RequirePermissions('STUDENT_VIEW') verify(@Body() dto: VerifyQrDto) {
    return this.students.verifyQr(dto.payload);
  }
  @Get('students/:id') @RequirePermissions('STUDENT_VIEW') get(@Param('id') id: string) {
    return this.students.get(id);
  }
  @Patch('students/:id') @RequirePermissions('STUDENT_EDIT') update(
    @Param('id') id: string,
    @Body() dto: UpdateStudentDto,
  ) {
    return this.students.update(id, dto);
  }
  @Get('students/:id/id-card') @RequirePermissions('STUDENT_VIEW') idCard(@Param('id') id: string) {
    return this.students.idCard(id);
  }
  @Post('students/:id/login') @RequirePermissions('USERS_MANAGE') studentLogin(@Param('id') id: string) {
    return this.students.createLogin(id);
  }
  @Post('students/:id/guardians') @RequirePermissions('GUARDIAN_MANAGE') link(
    @Param('id') id: string,
    @Body() dto: LinkGuardianDto,
  ) {
    return this.guardians.link(id, dto);
  }
  @Delete('students/:id/guardians/:guardianId') @RequirePermissions('GUARDIAN_MANAGE') unlink(
    @Param('id') id: string,
    @Param('guardianId') gid: string,
  ) {
    return this.guardians.unlink(id, gid);
  }

  @Get('guardians') @RequirePermissions('STUDENT_VIEW') listGuardians(@Query() q: ListGuardiansDto) {
    return this.guardians.list(q);
  }
  @Post('guardians') @RequirePermissions('GUARDIAN_MANAGE') createGuardian(@Body() dto: CreateGuardianDto) {
    return this.guardians.create(dto);
  }
  @Get('guardians/:id') @RequirePermissions('STUDENT_VIEW') getGuardian(@Param('id') id: string) {
    return this.guardians.get(id);
  }
  @Patch('guardians/:id') @RequirePermissions('GUARDIAN_MANAGE') updateGuardian(
    @Param('id') id: string,
    @Body() dto: Partial<CreateGuardianDto>,
  ) {
    return this.guardians.update(id, dto);
  }
  @Post('guardians/:id/login') @RequirePermissions('GUARDIAN_MANAGE') guardianLogin(
    @Param('id') id: string,
    @Body() body: { email?: string },
  ) {
    return this.guardians.createLogin(id, body?.email);
  }
}
