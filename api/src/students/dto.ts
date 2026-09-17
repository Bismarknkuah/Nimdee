import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '../common/dto/pagination.dto';

const GENDERS = ['MALE', 'FEMALE', 'OTHER'] as const;
const STATUSES = ['ACTIVE', 'INACTIVE', 'GRADUATED', 'TRANSFERRED', 'SUSPENDED'] as const;

export class ListStudentsDto extends PaginationDto {
  @IsOptional() @IsString() classId?: string;
  @IsOptional() @IsEnum(STATUSES) status?: (typeof STATUSES)[number];
  @IsOptional() @IsEnum(GENDERS) gender?: (typeof GENDERS)[number];
}

export class GuardianInlineDto {
  @IsString() @MaxLength(60) firstName: string;
  @IsString() @MaxLength(60) lastName: string;
  @IsString() @MaxLength(30) phone: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() relationship?: string;
  @IsOptional() @IsString() occupation?: string;
  @IsOptional() @IsString() address?: string;
}

export class CreateStudentDto {
  @IsString() @MaxLength(60) firstName: string;
  @IsString() @MaxLength(60) lastName: string;
  @IsOptional() @IsString() @MaxLength(80) otherNames?: string;
  @IsEnum(GENDERS) gender: (typeof GENDERS)[number];
  @IsDateString() dateOfBirth: string;
  @IsOptional() @IsString() classId?: string;
  @IsOptional() @IsString() house?: string;
  @IsOptional() @IsDateString() admissionDate?: string;
  @IsOptional() @IsBoolean() isBoarding?: boolean;
  @IsOptional() @IsString() photoUrl?: string;
  @IsOptional() @IsString() previousSchool?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() medicalNotes?: string;
  @IsOptional() @IsString() emergencyContactName?: string;
  @IsOptional() @IsString() emergencyContactPhone?: string;
  @IsOptional() @ValidateNested() @Type(() => GuardianInlineDto) guardian?: GuardianInlineDto;
  @IsOptional() @IsString() guardianId?: string;
}

export class UpdateStudentDto {
  @IsOptional() @IsString() @MaxLength(60) firstName?: string;
  @IsOptional() @IsString() @MaxLength(60) lastName?: string;
  @IsOptional() @IsString() otherNames?: string;
  @IsOptional() @IsEnum(GENDERS) gender?: (typeof GENDERS)[number];
  @IsOptional() @IsDateString() dateOfBirth?: string;
  @IsOptional() @IsString() classId?: string | null;
  @IsOptional() @IsString() house?: string;
  @IsOptional() @IsBoolean() isBoarding?: boolean;
  @IsOptional() @IsString() photoUrl?: string;
  @IsOptional() @IsString() previousSchool?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() medicalNotes?: string;
  @IsOptional() @IsString() emergencyContactName?: string;
  @IsOptional() @IsString() emergencyContactPhone?: string;
  @IsOptional() @IsEnum(STATUSES) status?: (typeof STATUSES)[number];
}

export class PromoteDto {
  @IsArray() @ArrayNotEmpty() studentIds: string[];
  @IsString() toClassId: string;
}

export class VerifyQrDto {
  @IsString() payload: string;
}

export class CreateGuardianDto extends GuardianInlineDto {}

export class LinkGuardianDto {
  @IsOptional() @IsString() guardianId?: string;
  @IsOptional() @ValidateNested() @Type(() => GuardianInlineDto) guardian?: GuardianInlineDto;
  @IsOptional() @IsString() relationship?: string;
  @IsOptional() @IsBoolean() isPrimary?: boolean;
}

export class ListGuardiansDto extends PaginationDto {}
