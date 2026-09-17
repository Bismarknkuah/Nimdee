import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
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

export class AssessmentDto {
  @IsString() termId: string;
  @IsString() classId: string;
  @IsString() subjectId: string;
  @IsString() @MaxLength(80) name: string;
  @IsOptional() @IsEnum(['CA', 'EXAM', 'PROJECT', 'PRACTICAL']) type?: 'CA' | 'EXAM' | 'PROJECT' | 'PRACTICAL';
  @IsOptional() @IsNumber() @Min(1) maxScore?: number;
  @IsOptional() @IsNumber() @Min(0) weight?: number;
  @IsOptional() @IsDateString() date?: string;
}

export class MarkItemDto {
  @IsString() studentId: string;
  @IsOptional() @IsNumber() @Min(0) score?: number | null;
}
export class SaveMarksDto {
  @IsArray() @ArrayNotEmpty() @ValidateNested({ each: true }) @Type(() => MarkItemDto) marks: MarkItemDto[];
}

export class ComputeDto {
  @IsString() termId: string;
  @IsString() classId: string;
  @IsOptional() @IsBoolean() force?: boolean;
}

export class WorkflowDto {
  @IsString() termId: string;
  @IsString() classId: string;
  @IsOptional() @IsArray() studentIds?: string[];
  @IsOptional() @IsString() @MaxLength(300) reason?: string;
}

export class CommentsDto {
  @IsOptional() @IsString() @MaxLength(400) classTeacherComment?: string;
  @IsOptional() @IsString() @MaxLength(400) headComment?: string;
  @IsOptional() @IsString() @MaxLength(120) conduct?: string;
  @IsOptional() @IsString() @MaxLength(40) promotionStatus?: string;
}
