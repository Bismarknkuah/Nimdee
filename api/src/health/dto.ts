import { IsBoolean, IsDateString, IsEnum, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';

export class HealthRecordDto {
  @IsOptional() @IsString() @MaxLength(5) bloodGroup?: string;
  @IsOptional() @IsString() @MaxLength(1000) allergies?: string;
  @IsOptional() @IsString() @MaxLength(1000) conditions?: string;
  @IsOptional() @IsString() @MaxLength(1000) medications?: string;
  @IsOptional() immunizations?: Array<{ name: string; date?: string }>;
  @IsOptional() @IsString() @MaxLength(80) doctorName?: string;
  @IsOptional() @IsString() @MaxLength(30) doctorPhone?: string;
  @IsOptional() @IsString() @MaxLength(80) insuranceProvider?: string;
  @IsOptional() @IsString() @MaxLength(60) insuranceNumber?: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}

export class HealthVisitDto {
  @IsString() studentId: string;
  @IsOptional() @IsDateString() date?: string;
  @IsOptional() @IsEnum(['SICK_BAY', 'INJURY', 'CHECKUP', 'MEDICATION', 'EMERGENCY', 'OTHER']) type?:
    'SICK_BAY' | 'INJURY' | 'CHECKUP' | 'MEDICATION' | 'EMERGENCY' | 'OTHER';
  @IsString() @MaxLength(1000) complaint: string;
  @IsOptional() @IsString() @MaxLength(1000) treatment?: string;
  @IsOptional() @IsNumber() temperature?: number;
  @IsOptional() @IsBoolean() referredOut?: boolean;
  @IsOptional() @IsBoolean() notifyParent?: boolean;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
}
