import { IsDateString, IsEmail, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationDto } from '../common/dto/pagination.dto';

export class ApplyDto {
  @IsString() @MaxLength(60) firstName: string;
  @IsString() @MaxLength(60) lastName: string;
  @IsEnum(['MALE', 'FEMALE', 'OTHER']) gender: 'MALE' | 'FEMALE' | 'OTHER';
  @IsDateString() dateOfBirth: string;
  @IsString() @MaxLength(40) appliedLevel: string;
  @IsOptional() @IsString() appliedClassId?: string;
  @IsString() @MaxLength(120) guardianName: string;
  @IsString() @MaxLength(30) guardianPhone: string;
  @IsOptional() @IsEmail() guardianEmail?: string;
  @IsOptional() @IsString() @MaxLength(120) previousSchool?: string;
  @IsOptional() documents?: any;
}

export class ListAdmissionsDto extends PaginationDto {
  @IsOptional()
  @IsEnum(['SUBMITTED', 'UNDER_REVIEW', 'INTERVIEW', 'ASSESSMENT', 'APPROVED', 'REJECTED', 'ADMITTED'])
  status?: string;
}

export class AdmissionStatusDto {
  @IsEnum(['UNDER_REVIEW', 'INTERVIEW', 'ASSESSMENT', 'APPROVED', 'REJECTED']) status:
    'UNDER_REVIEW' | 'INTERVIEW' | 'ASSESSMENT' | 'APPROVED' | 'REJECTED';
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
  @IsOptional() @IsDateString() interviewAt?: string;
}

export class AdmitDto {
  @IsString() classId: string;
  @IsOptional() @IsDateString() admissionDate?: string;
}
