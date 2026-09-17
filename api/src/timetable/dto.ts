import { IsBoolean, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class PeriodDto {
  @IsString() @MaxLength(30) name: string;
  @Matches(/^\d{2}:\d{2}$/) startTime: string;
  @Matches(/^\d{2}:\d{2}$/) endTime: string;
  @Type(() => Number) @IsInt() @Min(1) sequence: number;
  @IsOptional() @IsBoolean() isBreak?: boolean;
}

export class SlotDto {
  @IsString() classId: string;
  @IsString() subjectId: string;
  @IsOptional() @IsString() teacherId?: string | null;
  @IsOptional() @IsString() roomId?: string | null;
  @Type(() => Number) @IsInt() @Min(1) @Max(7) dayOfWeek: number;
  @IsString() periodId: string;
}
