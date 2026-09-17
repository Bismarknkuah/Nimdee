import { IsArray, IsBoolean, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class AnnouncementDto {
  @IsString() @MaxLength(140) title: string;
  @IsString() @MaxLength(4000) body: string;
  @IsOptional() @IsEnum(['ALL', 'PARENTS', 'TEACHERS', 'STAFF', 'STUDENTS', 'CLASS']) audienceType?:
    'ALL' | 'PARENTS' | 'TEACHERS' | 'STAFF' | 'STUDENTS' | 'CLASS';
  @IsOptional() @IsString() classId?: string;
  @IsOptional() @IsArray() channels?: string[];
  @IsOptional() @IsBoolean() isPublic?: boolean;
  @IsOptional() @IsBoolean() publish?: boolean;
}
