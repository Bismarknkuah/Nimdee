import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '../common/dto/pagination.dto';

export class ListSchoolsDto extends PaginationDto {
  @IsOptional() @IsEnum(['PENDING', 'ACTIVE', 'SUSPENDED', 'REJECTED']) status?: string;
  @IsOptional() @IsString() planCode?: string;
}

export class ReasonDto {
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}

export class SupportSessionDto {
  @IsString() @MinLength(5) @MaxLength(500) reason: string;
}

export class FeaturesDto {
  @IsArray() featureOverrides: string[];
}

export class SubscriptionUpdateDto {
  @IsOptional() @IsString() planId?: string;
  @IsOptional() @IsEnum(['TRIAL', 'ACTIVE', 'PAST_DUE', 'GRACE', 'SUSPENDED', 'CANCELLED']) status?: string;
  @IsOptional() @IsEnum(['MONTHLY', 'YEARLY']) billingCycle?: 'MONTHLY' | 'YEARLY';
  @IsOptional() @IsString() currentPeriodEnd?: string;
  @IsOptional() @IsString() trialEndsAt?: string;
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}

export class SubInvoiceDto {
  @IsOptional() @IsEnum(['MONTHLY', 'YEARLY']) billingCycle?: 'MONTHLY' | 'YEARLY';
  @IsOptional() @IsNumber() @Min(0) amount?: number;
  @IsOptional() @IsString() dueDate?: string;
  @IsOptional() @IsString() description?: string;
}

export class MarkPaidDto {
  @IsOptional() @IsString() reference?: string;
}

export class PlanDto {
  @IsString() @MaxLength(30) code: string;
  @IsString() @MaxLength(60) name: string;
  @IsOptional() @IsString() description?: string;
  @IsNumber() @Min(0) priceMonthly: number;
  @IsNumber() @Min(0) priceYearly: number;
  @IsOptional() @IsString() currency?: string;
  @IsInt() @Min(1) studentLimit: number;
  @IsArray() features: string[];
  @IsOptional() @IsInt() @Min(0) trialDays?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsInt() sortOrder?: number;
}

export class PlatformUserDto {
  @IsEmail() email: string;
  @IsString() name: string;
  @IsOptional() @IsEnum(['SUPER_ADMIN', 'SUPPORT']) role?: 'SUPER_ADMIN' | 'SUPPORT';
  @IsOptional() @IsString() @MinLength(8) password?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class PlatformAuditDto extends PaginationDto {
  @IsOptional() @IsString() tenantId?: string;
  @IsOptional() @IsString() entity?: string;
  @IsOptional() @IsString() action?: string;
  @IsOptional() @IsString() actorType?: string;
}

export class UpdateTenantDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() type?: string;
  @IsOptional() @IsString() region?: string;
  @IsOptional() @IsString() district?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() principalName?: string;
  @IsOptional() @Type(() => Number) @IsNumber() gpsLat?: number;
  @IsOptional() @Type(() => Number) @IsNumber() gpsLng?: number;
}
