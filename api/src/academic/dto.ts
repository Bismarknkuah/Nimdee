import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class YearDto {
  @IsString() @MaxLength(20) name: string;
  @IsDateString() startDate: string;
  @IsDateString() endDate: string;
  @IsOptional() @IsBoolean() isCurrent?: boolean;
}
export class TermDto {
  @IsString() academicYearId: string;
  @IsString() @MaxLength(30) name: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) sequence?: number;
  @IsDateString() startDate: string;
  @IsDateString() endDate: string;
  @IsOptional() @IsDateString() examStart?: string;
  @IsOptional() @IsDateString() examEnd?: string;
  @IsOptional() @IsBoolean() isCurrent?: boolean;
}
export class ClassDto {
  @IsString() @MaxLength(40) name: string;
  @IsString() @MaxLength(30) level: string;
  @IsOptional() @IsString() stream?: string;
  @IsOptional() @Type(() => Number) @IsInt() capacity?: number;
  @IsOptional() @IsString() classTeacherId?: string | null;
  @IsOptional() @IsString() nextClassId?: string | null;
  @IsOptional() @IsBoolean() isFinal?: boolean;
}
export class SubjectDto {
  @IsString() @MaxLength(60) name: string;
  @IsString() @MaxLength(12) code: string;
  @IsOptional() @IsBoolean() isCore?: boolean;
}
export class ClassSubjectItemDto {
  @IsString() subjectId: string;
  @IsOptional() @IsString() teacherId?: string | null;
}
export class SetClassSubjectsDto {
  @IsArray() @ArrayNotEmpty() subjects: ClassSubjectItemDto[];
}
export class RoomDto {
  @IsString() @MaxLength(40) name: string;
  @IsOptional() @Type(() => Number) @IsInt() capacity?: number;
}
