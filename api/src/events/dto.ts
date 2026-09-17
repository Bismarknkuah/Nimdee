import { IsBoolean, IsDateString, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export const EVENT_TYPES = ['ACADEMIC', 'HOLIDAY', 'EXAM', 'MEETING', 'SPORTS', 'CULTURAL', 'TRIP', 'OTHER'] as const;

export class EventDto {
  @IsString() @MaxLength(140) title: string;
  @IsOptional() @IsString() @MaxLength(4000) description?: string;
  @IsOptional() @IsEnum(EVENT_TYPES) type?: (typeof EVENT_TYPES)[number];
  @IsDateString() startAt: string;
  @IsOptional() @IsDateString() endAt?: string;
  @IsOptional() @IsBoolean() allDay?: boolean;
  @IsOptional() @IsString() @MaxLength(200) location?: string;
  @IsOptional() @IsEnum(['ALL', 'PARENTS', 'TEACHERS', 'STAFF', 'STUDENTS', 'CLASS']) audienceType?:
    'ALL' | 'PARENTS' | 'TEACHERS' | 'STAFF' | 'STUDENTS' | 'CLASS';
  @IsOptional() @IsString() classId?: string;
  @IsOptional() @IsBoolean() isPublic?: boolean;
  @IsOptional() @IsBoolean() notify?: boolean;
}

export class ListEventsDto {
  @IsOptional() @IsString() from?: string;
  @IsOptional() @IsString() to?: string;
  @IsOptional() @IsEnum(EVENT_TYPES) type?: string;
  @IsOptional() @IsString() classId?: string;
}
