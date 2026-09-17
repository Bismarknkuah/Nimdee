import {
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

export class UpdateSettingsDto {
  @IsOptional() @IsObject() academic?: any;
  @IsOptional() @IsObject() attendance?: any;
  @IsOptional() @IsObject() finance?: any;
  @IsOptional() @IsObject() sync?: any;
  @IsOptional() @IsObject() canteen?: any;
  @IsOptional() @IsObject() communication?: any;
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
