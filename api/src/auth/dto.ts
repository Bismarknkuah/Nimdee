import { IsEmail, IsOptional, IsString, MinLength, MaxLength } from 'class-validator';

export class LoginDto {
  @IsString() @MaxLength(80) school: string;
  @IsEmail() email: string;
  @IsString() @MinLength(4) password: string;
  @IsOptional() @IsString() deviceName?: string;
}

export class PlatformLoginDto {
  @IsEmail() email: string;
  @IsString() @MinLength(4) password: string;
}

export class RefreshDto {
  @IsString() refreshToken: string;
}

export class ChangePasswordDto {
  @IsString() currentPassword: string;
  @IsString() @MinLength(8) newPassword: string;
}

export class ForgotPasswordDto {
  @IsOptional() @IsString() @MaxLength(80) school?: string;
  @IsEmail() email: string;
}

export class ResetPasswordDto {
  @IsString() token: string;
  @IsString() @MinLength(8) password: string;
}
