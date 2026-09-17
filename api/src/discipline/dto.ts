import { IsBoolean, IsDateString, IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '../common/dto/pagination.dto';

export const DISCIPLINE_CATEGORIES = [
  'LATENESS',
  'ABSENTEEISM',
  'DISRUPTION',
  'BULLYING',
  'FIGHTING',
  'DISHONESTY',
  'DRESS_CODE',
  'PROPERTY_DAMAGE',
  'DISRESPECT',
  'OTHER',
] as const;

export class ListIncidentsDto extends PaginationDto {
  @IsOptional() @IsString() studentId?: string;
  @IsOptional() @IsString() classId?: string;
  @IsOptional() @IsEnum(['OPEN', 'RESOLVED', 'ESCALATED']) status?: string;
  @IsOptional() @IsEnum(['MINOR', 'MODERATE', 'SERIOUS']) severity?: string;
  @IsOptional() @IsString() from?: string;
  @IsOptional() @IsString() to?: string;
}

export class CreateIncidentDto {
  @IsString() studentId: string;
  @IsDateString() date: string;
  @IsEnum(DISCIPLINE_CATEGORIES) category: (typeof DISCIPLINE_CATEGORIES)[number];
  @IsOptional() @IsEnum(['MINOR', 'MODERATE', 'SERIOUS']) severity?: 'MINOR' | 'MODERATE' | 'SERIOUS';
  @IsString() @MaxLength(2000) description: string;
  @IsOptional() @IsString() @MaxLength(1000) actionTaken?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) points?: number;
  @IsOptional() @IsBoolean() notifyParent?: boolean;
}

export class UpdateIncidentDto {
  @IsOptional() @IsString() @MaxLength(1000) actionTaken?: string;
  @IsOptional() @IsEnum(['OPEN', 'RESOLVED', 'ESCALATED']) status?: 'OPEN' | 'RESOLVED' | 'ESCALATED';
  @IsOptional() @IsEnum(['MINOR', 'MODERATE', 'SERIOUS']) severity?: 'MINOR' | 'MODERATE' | 'SERIOUS';
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) points?: number;
  @IsOptional() @IsBoolean() notifyParent?: boolean;
}
