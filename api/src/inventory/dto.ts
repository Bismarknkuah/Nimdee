import { IsEnum, IsInt, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class InventoryItemDto {
  @IsString() @MaxLength(80) name: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsInt() @Min(0) quantity?: number;
  @IsOptional() @IsInt() @Min(0) minQuantity?: number;
  @IsOptional() @IsString() unit?: string;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsNumber() @Min(0) unitCost?: number;
  @IsOptional() @IsString() supplier?: string;
}

export class InventoryMoveDto {
  @IsEnum(['IN', 'OUT', 'ADJUST', 'WASTE']) type: 'IN' | 'OUT' | 'ADJUST' | 'WASTE';
  @IsInt() quantity: number;
  @IsOptional() @IsString() reason?: string;
}
