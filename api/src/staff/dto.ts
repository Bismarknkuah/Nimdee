import { IsBoolean, IsDateString, IsEmail, IsEnum, IsNumber, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { PaginationDto } from '../common/dto/pagination.dto';

export class ListStaffDto extends PaginationDto {
  @IsOptional() @IsEnum(['TEACHING', 'NON_TEACHING']) staffType?: 'TEACHING' | 'NON_TEACHING';
  @IsOptional() @IsEnum(['ACTIVE', 'ON_LEAVE', 'SUSPENDED', 'TERMINATED']) status?: string;
}

export class CreateStaffDto {
  @IsString() @MaxLength(60) firstName: string;
  @IsString() @MaxLength(60) lastName: string;
  @IsOptional() @IsString() gender?: string;
  @IsOptional() @IsDateString() dateOfBirth?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsEnum(['TEACHING', 'NON_TEACHING']) staffType?: 'TEACHING' | 'NON_TEACHING';
  @IsOptional() @IsString() department?: string;
  @IsOptional() @IsString() position?: string;
  @IsOptional() qualifications?: any;
  @IsOptional() @IsDateString() employmentDate?: string;
  @IsOptional() @IsNumber() basicSalary?: number;
  /** Create a portal login immediately (requires email). Teachers get the Teacher role. */
  @IsOptional() @IsBoolean() createLogin?: boolean;
  @IsOptional() @IsString() roleName?: string;
  /** Set a specific temporary password instead of letting the system generate one */
  @IsOptional() @IsString() @MinLength(8) @MaxLength(72) password?: string;
}

export class UpdateStaffDto {
  @IsOptional() @IsString() @MaxLength(60) firstName?: string;
  @IsOptional() @IsString() @MaxLength(60) lastName?: string;
  @IsOptional() @IsString() gender?: string;
  @IsOptional() @IsDateString() dateOfBirth?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsEnum(['TEACHING', 'NON_TEACHING']) staffType?: 'TEACHING' | 'NON_TEACHING';
  @IsOptional() @IsString() department?: string;
  @IsOptional() @IsString() position?: string;
  @IsOptional() qualifications?: any;
  @IsOptional() @IsDateString() employmentDate?: string;
  @IsOptional() @IsNumber() basicSalary?: number;
  @IsOptional() @IsEnum(['ACTIVE', 'ON_LEAVE', 'SUSPENDED', 'TERMINATED']) status?: any;
}
