import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AssignmentDto {
  @IsString() classId: string;
  @IsString() subjectId: string;
  @IsString() @MaxLength(140) title: string;
  @IsString() @MaxLength(8000) instructions: string;
  @IsDateString() dueAt: string;
  @IsOptional() @IsNumber() @Min(1) maxScore?: number;
  @IsOptional() @IsEnum(['DRAFT', 'PUBLISHED', 'CLOSED']) status?: 'DRAFT' | 'PUBLISHED' | 'CLOSED';
  @IsOptional() @IsArray() attachments?: Array<{ name: string; url: string }>;
}

export class GradeItemDto {
  @IsString() studentId: string;
  @IsOptional() @IsEnum(['PENDING', 'SUBMITTED', 'LATE', 'GRADED', 'MISSING']) status?: string;
  @IsOptional() @IsNumber() @Min(0) score?: number | null;
  @IsOptional() @IsString() @MaxLength(1000) feedback?: string;
}

export class GradeDto {
  @IsArray() @ValidateNested({ each: true }) @Type(() => GradeItemDto) items: GradeItemDto[];
}

export class SubmitDto {
  @IsOptional() @IsString() @MaxLength(4000) note?: string;
  @IsOptional() @IsArray() attachments?: Array<{ name: string; url: string }>;
}
