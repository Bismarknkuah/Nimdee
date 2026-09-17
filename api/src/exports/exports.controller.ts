import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { RequirePermissions } from '../common/decorators';
import { ExportsService } from './exports.service';

const send = (res: Response, name: string, data: string) => {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${name}-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send('\uFEFF' + data);
};

@ApiTags('exports')
@RequirePermissions('EXPORT_DATA')
@Controller('exports')
export class ExportsController {
  constructor(private readonly exports: ExportsService) {}
  @Get('students.csv') async students(@Res() res: Response, @Query('classId') classId?: string) {
    send(res, 'students', await this.exports.students(classId));
  }
  @Get('staff.csv') async staff(@Res() res: Response) {
    send(res, 'staff', await this.exports.staff());
  }
  @Get('invoices.csv') async invoices(@Res() res: Response, @Query('termId') termId?: string) {
    send(res, 'invoices', await this.exports.invoices(termId));
  }
  @Get('payments.csv') async payments(@Res() res: Response, @Query('from') from?: string, @Query('to') to?: string) {
    send(res, 'payments', await this.exports.payments(from, to));
  }
  @Get('attendance.csv') async attendance(
    @Res() res: Response,
    @Query('classId') classId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    send(res, 'attendance', await this.exports.attendance(classId, from, to));
  }
  @Get('results.csv') async results(
    @Res() res: Response,
    @Query('termId') termId: string,
    @Query('classId') classId?: string,
  ) {
    send(res, 'results', await this.exports.results(termId, classId));
  }
}
