import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class RolloverTermDto {
  @IsString() @MaxLength(30) name: string;
  @IsDateString() startDate: string;
  @IsDateString() endDate: string;
}
export class RolloverPromotionDto {
  @IsString() fromClassId: string;
  /** Target class id, or the literal string GRADUATE */
  @IsString() toClassId: string;
}
export class RolloverDto {
  @IsString() @MaxLength(20) newYearName: string;
  @IsDateString() startDate: string;
  @IsDateString() endDate: string;
  @IsArray() @ArrayNotEmpty() @ValidateNested({ each: true }) @Type(() => RolloverTermDto) terms: RolloverTermDto[];
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RolloverPromotionDto)
  promotions?: RolloverPromotionDto[];
  /** Students below the promotion average in the last term repeat their class (default true) */
  @IsOptional() @IsBoolean() respectResults?: boolean;
  @IsOptional() @IsBoolean() copyFeeStructures?: boolean;
}
