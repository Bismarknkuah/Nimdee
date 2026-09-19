import { IsDateString, IsNumber, IsOptional, IsString, Min, MaxLength } from 'class-validator';
import { PaginationDto } from '../common/dto/pagination.dto';

/** A starting set of categories offered in the UI; the field itself is free text so a Headmaster can
 *  type anything the school actually spends on, the same way Fee Categories work for income. */
export const EXPENSE_CATEGORIES = [
  'Supplies',
  'Maintenance & Repairs',
  'Utilities',
  'Transport & Fuel',
  'Stationery & Printing',
  'Equipment',
  'Furniture',
  'Cleaning',
  'Events & Functions',
  'Other',
] as const;

export class CreateExpenseDto {
  @IsString() @MaxLength(60) category: string;
  @IsString() @MaxLength(500) description: string;
  @IsNumber() @Min(0.01) amount: number;
  @IsOptional() @IsString() @MaxLength(120) vendor?: string;
  @IsDateString() purchasedAt: string;
  @IsOptional() @IsString() @MaxLength(2_500_000) receiptUrl?: string;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
}

export class ListExpensesDto extends PaginationDto {
  @IsOptional() @IsString() status?: 'PENDING' | 'APPROVED' | 'REJECTED';
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
}

export class RejectExpenseDto {
  @IsString() @MaxLength(500) reason: string;
}
