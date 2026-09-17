import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '../common/dto/pagination.dto';

export class BookDto {
  @IsOptional() @IsString() @MaxLength(20) isbn?: string;
  @IsString() @MaxLength(200) title: string;
  @IsString() @MaxLength(120) author: string;
  @IsOptional() @IsString() @MaxLength(60) category?: string;
  @IsOptional() @IsString() @MaxLength(120) publisher?: string;
  @IsOptional() @Type(() => Number) @IsInt() year?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) copiesTotal?: number;
  @IsOptional() @IsString() @MaxLength(60) location?: string;
}

export class ListBooksDto extends PaginationDto {
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsBoolean() availableOnly?: boolean;
}

export class BorrowDto {
  @IsString() bookId: string;
  @IsOptional() @IsString() studentId?: string;
  @IsOptional() @IsString() staffId?: string;
  @IsOptional() @IsDateString() dueAt?: string;
  @IsOptional() @IsString() notes?: string;
}

export class ReturnDto {
  @IsOptional() @IsBoolean() lost?: boolean;
  @IsOptional() @IsNumber() @Min(0) fine?: number;
  @IsOptional() @IsBoolean() finePaid?: boolean;
}

export class ListLoansDto extends PaginationDto {
  @IsOptional() @IsEnum(['BORROWED', 'RETURNED', 'OVERDUE', 'LOST']) status?: string;
  @IsOptional() @IsString() studentId?: string;
  @IsOptional() @IsString() bookId?: string;
}
