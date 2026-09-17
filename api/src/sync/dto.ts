import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsInt,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class RegisterDeviceDto {
  @IsString() @MaxLength(80) name: string;
  @IsOptional() @IsString() @MaxLength(40) platform?: string;
}

export class HeartbeatDto {
  @IsString() deviceId: string;
  @IsOptional() @IsInt() @Min(0) pendingCount?: number;
}

export class SyncOpDto {
  @IsString() @MaxLength(80) operationId: string;
  @IsEnum(['attendance', 'student']) entity: 'attendance' | 'student';
  @IsString() @MaxLength(30) action: string;
  @IsObject() payload: any;
  @IsISO8601() clientTimestamp: string;
}

export class PushDto {
  @IsString() deviceId: string;
  @IsOptional() @IsInt() @Min(0) pendingCount?: number;
  @IsArray() @ArrayNotEmpty() @ValidateNested({ each: true }) @Type(() => SyncOpDto) operations: SyncOpDto[];
}

export class ResolveConflictDto {
  @IsEnum(['SERVER', 'CLIENT']) resolution: 'SERVER' | 'CLIENT';
}
