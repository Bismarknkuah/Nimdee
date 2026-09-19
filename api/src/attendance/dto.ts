import { ArrayNotEmpty, IsArray, IsEnum, IsOptional, IsString, Matches, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export const ATTENDANCE_STATUSES = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED', 'SICK'] as const;
export type AttStatus = (typeof ATTENDANCE_STATUSES)[number];

export class AttendanceRecordDto {
  @IsString() studentId: string;
  @IsEnum(ATTENDANCE_STATUSES) status: AttStatus;
  @IsOptional() @IsString() note?: string;
}

export class MarkAttendanceDto {
  @IsString() classId: string;
  @Matches(/^\d{4}-\d{2}-\d{2}$/) date: string;
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => AttendanceRecordDto)
  records: AttendanceRecordDto[];
}

export class MarkLessonAttendanceDto {
  @IsString() timetableSlotId: string;
  @Matches(/^\d{4}-\d{2}-\d{2}$/) date: string;
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => AttendanceRecordDto)
  records: AttendanceRecordDto[];
}
