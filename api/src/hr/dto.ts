import {
  ArrayNotEmpty,
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class LeaveRequestDto {
  @IsOptional() @IsString() staffId?: string;
  @IsEnum(['ANNUAL', 'SICK', 'MATERNITY', 'PATERNITY', 'STUDY', 'COMPASSIONATE', 'UNPAID', 'OTHER']) type: string;
  @IsDateString() startDate: string;
  @IsDateString() endDate: string;
  @IsOptional() @IsString() @MaxLength(1000) reason?: string;
}

export class LeaveReviewDto {
  @IsEnum(['APPROVED', 'REJECTED']) status: 'APPROVED' | 'REJECTED';
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

export class PayrollItemDto {
  @IsString() staffId: string;
  @IsNumber() @Min(0) basic: number;
  @IsOptional() @IsNumber() @Min(0) allowances?: number;
  @IsOptional() @IsNumber() @Min(0) deductions?: number;
  @IsOptional() @IsString() @MaxLength(300) notes?: string;
}

export class CreatePayrollDto {
  @Matches(/^\d{4}-\d{2}$/) period: string;
  @IsOptional() @IsString() notes?: string;
}

export class UpdatePayrollItemsDto {
  @IsArray() @ArrayNotEmpty() @ValidateNested({ each: true }) @Type(() => PayrollItemDto) items: PayrollItemDto[];
}
