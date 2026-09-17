import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

const TYPES = ['PREPAID', 'PAY_AS_YOU_GO', 'MEAL_PLAN', 'CREDIT', 'ALLOWANCE'] as const;
const PERIODS = ['NONE', 'DAILY', 'WEEKLY', 'MONTHLY', 'TERM'] as const;

export class CanteenPlanDto {
  @IsString() @MaxLength(20) code: string;
  @IsString() @MaxLength(80) name: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsEnum(TYPES) type: (typeof TYPES)[number];
  @IsOptional() @IsNumber() @Min(0) price?: number;
  @IsOptional() @IsEnum(PERIODS) billingPeriod?: (typeof PERIODS)[number];
  @IsOptional() @IsInt() @Min(0) mealsPerDay?: number;
  @IsOptional() @IsNumber() @Min(0) dailyLimit?: number | null;
  @IsOptional() @IsNumber() @Min(0) creditLimit?: number | null;
  @IsOptional() @IsNumber() @Min(0) allowanceAmount?: number | null;
  @IsOptional() @IsEnum(PERIODS) allowanceFrequency?: (typeof PERIODS)[number];
  @IsOptional() @IsBoolean() billToFees?: boolean;
  @IsOptional() @IsBoolean() isDefault?: boolean;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsInt() sortOrder?: number;
  @IsOptional() @IsArray() itemIds?: string[];
}

export class PlanItemsDto {
  @IsArray() itemIds: string[];
}

export class EnrolDto {
  @IsOptional() @IsArray() studentIds?: string[];
  @IsOptional() @IsString() classId?: string;
  @IsOptional() @IsString() termId?: string;
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsDateString() endDate?: string;
  /** Bill the plan price now (meal plans / subscriptions with billToFees) */
  @IsOptional() @IsBoolean() bill?: boolean;
  @IsOptional() @IsString() notes?: string;
}

export class EnrolmentQueryDto {
  @IsOptional() @IsString() planId?: string;
  @IsOptional() @IsString() classId?: string;
  @IsOptional() @IsEnum(['ACTIVE', 'SUSPENDED', 'ENDED']) status?: string;
  @IsOptional() @IsString() search?: string;
}
