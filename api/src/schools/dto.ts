import { IsArray, IsEnum,
  IsBoolean,
  IsEmail,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterSchoolDto {
  @IsString() @MinLength(3) @MaxLength(120) name: string;
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9-]{3,40}$/, { message: 'slug may only contain lowercase letters, numbers and hyphens' })
  slug?: string;
  @IsOptional() @IsString() type?: string;
  @IsOptional() @IsString() @MaxLength(2) country?: string;
  @IsOptional() @IsString() region?: string;
  @IsOptional() @IsString() district?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() registrationNumber?: string;
  @IsString() @MaxLength(60) adminFirstName: string;
  @IsString() @MaxLength(60) adminLastName: string;
  @IsEmail() adminEmail: string;
  @IsString() @MinLength(8) adminPassword: string;
  @IsOptional() @IsString() planCode?: string;
  /** Which basic-school levels the school runs (defaults to all three) */
  @IsOptional() @IsArray() @IsEnum(['KG', 'PRIMARY', 'JHS'], { each: true }) levels?: Array<'KG' | 'PRIMARY' | 'JHS'>;
  /** Day school, boarding school or both */
  @IsOptional() @IsEnum(['DAY', 'BOARDING', 'DAY_AND_BOARDING']) residency?: 'DAY' | 'BOARDING' | 'DAY_AND_BOARDING';
  /** Create the standard classes and GES subjects immediately (default true) */
  @IsOptional() @IsBoolean() setupStandardClasses?: boolean;
}

/**
 * Same shape as public self-registration, but for a platform team member setting a school up on an
 * owner's behalf: they may not know what password the owner wants, so it's optional here (a temporary
 * one is generated and handed back, exactly like adding a staff member) — and it always activates the
 * school immediately, skipping the pending-approval step, since the platform admin is the approver.
 */
export class PlatformCreateSchoolDto extends RegisterSchoolDto {
  @IsOptional() @IsString() @MinLength(8) declare adminPassword: string;
}

export class UpdateSchoolProfileDto {
  @IsOptional() @IsString() @MinLength(3) @MaxLength(120) name?: string;
  @IsOptional() @IsString() type?: string;
  @IsOptional() @IsString() registrationNumber?: string;
  @IsOptional() @IsString() region?: string;
  @IsOptional() @IsString() district?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsNumber() gpsLat?: number;
  @IsOptional() @IsNumber() gpsLng?: number;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() website?: string;
  @IsOptional() @IsString() principalName?: string;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsString() timezone?: string;
}

export class UpdateBrandingDto {
  @IsOptional() @IsString() logoUrl?: string;
  @IsOptional() @IsString() faviconUrl?: string;
  @IsOptional() @Matches(/^#[0-9a-fA-F]{6}$/) primaryColor?: string;
  @IsOptional() @Matches(/^#[0-9a-fA-F]{6}$/) secondaryColor?: string;
  @IsOptional() @IsString() fontFamily?: string;
}

export class UpdateFeaturesDto {
  @IsArray() @IsString({ each: true }) disabledFeatures: string[];
}

export class UpdateSettingsDto {
  @IsOptional() @IsObject() academic?: any;
  @IsOptional() @IsObject() attendance?: any;
  @IsOptional() @IsObject() finance?: any;
  @IsOptional() @IsObject() sync?: any;
  @IsOptional() @IsObject() canteen?: any;
  @IsOptional() @IsObject() communication?: any;
  @IsOptional() @IsObject() school?: any;
}

export class AddDomainDto {
  @IsString()
  @Matches(/^(?!-)([a-z0-9-]{1,63}\.)+[a-z]{2,}$/i, { message: 'Enter a valid domain such as portal.myschool.edu.gh' })
  domain: string;
}

export class WebsiteConfigDto {
  @IsOptional() nav?: any[];
  @IsOptional() @IsObject() footer?: any;
  @IsOptional() sections?: any[];
  @IsOptional() @IsObject() pages?: any;
  @IsOptional() @IsBoolean() published?: boolean;
  @IsOptional() @IsIn(['classic', 'modern', 'bold']) theme?: string;
}
