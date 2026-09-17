import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationDto } from '../common/dto/pagination.dto';

export class FeeCategoryDto {
  @IsString() @MaxLength(60) name: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class FeeStructureDto {
  @IsString() academicYearId: string;
  @IsOptional() @IsString() termId?: string | null;
  @IsOptional() @IsString() classId?: string | null;
  @IsOptional() @IsString() level?: string | null;
  @IsString() categoryId: string;
  @IsNumber() @Min(0) amount: number;
  @IsOptional() @IsEnum(['ALL', 'BOARDING', 'DAY']) appliesTo?: 'ALL' | 'BOARDING' | 'DAY';
}

export class DiscountDto {
  @IsString() studentId: string;
  @IsString() @MaxLength(80) name: string;
  @IsEnum(['PERCENT', 'FIXED']) type: 'PERCENT' | 'FIXED';
  @IsNumber() @Min(0) value: number;
  @IsOptional() @IsString() categoryId?: string;
  @IsOptional() @IsString() academicYearId?: string;
  @IsOptional() @IsString() reason?: string;
}

export class GenerateInvoicesDto {
  @IsString() termId: string;
  @IsOptional() @IsString() classId?: string;
  @IsOptional() @IsDateString() dueDate?: string;
  @IsOptional() @IsBoolean() regenerate?: boolean;
}

export class ListInvoicesDto extends PaginationDto {
  @IsOptional() @IsString() termId?: string;
  @IsOptional() @IsString() classId?: string;
  @IsOptional() @IsString() studentId?: string;
  @IsOptional() @IsEnum(['ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED']) status?: string;
}

export class RecordPaymentDto {
  @IsString() studentId: string;
  @IsOptional() @IsString() invoiceId?: string;
  @IsNumber() @Min(0.01) amount: number;
  @IsEnum(['CASH', 'MOBILE_MONEY', 'CARD', 'BANK_TRANSFER', 'CHEQUE']) method:
    'CASH' | 'MOBILE_MONEY' | 'CARD' | 'BANK_TRANSFER' | 'CHEQUE';
  @IsOptional() @IsString() @MaxLength(80) reference?: string;
  @IsOptional() @IsDateString() paidAt?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsEmail() payerEmail?: string;
}

export class ListPaymentsDto extends PaginationDto {
  @IsOptional() @IsString() studentId?: string;
  @IsOptional() @IsString() from?: string;
  @IsOptional() @IsString() to?: string;
  @IsOptional() @IsString() method?: string;
  @IsOptional() @IsString() status?: string;
}

export class ReverseDto {
  @IsString() @MaxLength(300) reason: string;
}

export class InitiateOnlineDto {
  @IsString() studentId: string;
  @IsOptional() @IsString() invoiceId?: string;
  @IsNumber() @Min(1) amount: number;
  @IsEmail() email: string;
  @IsOptional() @IsEnum(['FEES', 'WALLET']) purpose?: 'FEES' | 'WALLET';
  @IsOptional() @IsString() callbackUrl?: string;
}
