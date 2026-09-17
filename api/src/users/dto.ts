import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PaginationDto } from '../common/dto/pagination.dto';

export class ListUsersDto extends PaginationDto {
  @IsOptional() @IsEnum(['STAFF', 'TEACHER', 'PARENT', 'STUDENT']) userType?:
    'STAFF' | 'TEACHER' | 'PARENT' | 'STUDENT';
  @IsOptional() @IsString() roleId?: string;
  @IsOptional() @IsString() isActive?: string;
}

export class CreateUserDto {
  @IsEmail() email: string;
  @IsString() @MaxLength(60) firstName: string;
  @IsString() @MaxLength(60) lastName: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsEnum(['STAFF', 'TEACHER', 'PARENT', 'STUDENT']) userType?:
    'STAFF' | 'TEACHER' | 'PARENT' | 'STUDENT';
  @IsArray() @ArrayNotEmpty() roleIds: string[];
  @IsOptional() @IsString() @MinLength(8) password?: string;
}

export class UpdateUserDto {
  @IsOptional() @IsString() @MaxLength(60) firstName?: string;
  @IsOptional() @IsString() @MaxLength(60) lastName?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsArray() roleIds?: string[];
}

export class RoleDto {
  @IsString() @MaxLength(60) name: string;
  @IsOptional() @IsString() @MaxLength(200) description?: string;
  @IsArray() permissions: string[];
}
