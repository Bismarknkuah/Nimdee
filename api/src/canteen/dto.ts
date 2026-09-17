import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CanteenItemDto {
  @IsString() @MaxLength(60) name: string;
  @IsOptional() @IsString() category?: string;
  @IsNumber() @Min(0) price: number;
  @IsOptional() @IsInt() @Min(0) stock?: number;
  @IsOptional() @IsInt() @Min(0) minStock?: number;
  @IsOptional() @IsString() unit?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class StockDto {
  @IsEnum(['IN', 'ADJUST', 'WASTE']) type: 'IN' | 'ADJUST' | 'WASTE';
  @IsInt() quantity: number;
  @IsOptional() @IsString() reason?: string;
}

export class TopUpDto {
  @IsNumber() @Min(0.01) amount: number;
  @IsOptional() @IsEnum(['CASH', 'MOBILE_MONEY', 'CARD', 'BANK_TRANSFER']) method?: string;
  @IsOptional() @IsString() reference?: string;
}

export class WalletSettingsDto {
  @IsOptional() @IsNumber() @Min(0) dailyLimit?: number | null;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class SaleLineDto {
  @IsString() itemId: string;
  @IsInt() @Min(1) quantity: number;
}

export class SaleDto {
  @IsOptional() @IsString() studentId?: string;
  @IsEnum(['WALLET', 'CASH']) paymentMode: 'WALLET' | 'CASH';
  @IsArray() @ArrayNotEmpty() @ValidateNested({ each: true }) @Type(() => SaleLineDto) items: SaleLineDto[];
}
