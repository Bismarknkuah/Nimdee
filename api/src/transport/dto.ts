import { IsBoolean, IsDateString, IsInt, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class RouteDto {
  @IsString() @MaxLength(80) name: string;
  @IsOptional() @IsString() @MaxLength(400) description?: string;
  @IsOptional() @IsString() @MaxLength(60) vehicle?: string;
  @IsOptional() @IsString() @MaxLength(80) driverName?: string;
  @IsOptional() @IsString() @MaxLength(30) driverPhone?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) capacity?: number;
  @IsOptional() @IsNumber() @Min(0) termFee?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class StopDto {
  @IsString() @MaxLength(80) name: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) sequence?: number;
  @IsOptional() @IsString() pickupTime?: string;
  @IsOptional() @IsString() dropoffTime?: string;
}

export class AssignDto {
  @IsString() studentId: string;
  @IsString() routeId: string;
  @IsOptional() @IsString() stopId?: string;
  @IsOptional() @IsDateString() startDate?: string;
}
