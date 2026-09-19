import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequireFeature, RequirePermissions } from '../common/decorators';
import { CreateExpenseDto, ListExpensesDto, RejectExpenseDto } from './dto';
import { ExpensesService } from './expenses.service';

@ApiTags('expenses')
@RequireFeature('FEES')
@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expenses: ExpensesService) {}

  @Get() @RequirePermissions('EXPENSE_VIEW') list(@Query() q: ListExpensesDto) {
    return this.expenses.list(q);
  }
  @Get('summary') @RequirePermissions('EXPENSE_VIEW') summary() {
    return this.expenses.summary();
  }
  @Get(':id') @RequirePermissions('EXPENSE_VIEW') get(@Param('id') id: string) {
    return this.expenses.get(id);
  }
  @Post() @RequirePermissions('EXPENSE_CREATE') create(@Body() dto: CreateExpenseDto) {
    return this.expenses.create(dto);
  }
  @Post(':id/approve') @RequirePermissions('EXPENSE_APPROVE') approve(@Param('id') id: string) {
    return this.expenses.approve(id);
  }
  @Post(':id/reject') @RequirePermissions('EXPENSE_APPROVE') reject(
    @Param('id') id: string,
    @Body() dto: RejectExpenseDto,
  ) {
    return this.expenses.reject(id, dto.reason);
  }
}
