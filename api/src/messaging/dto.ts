import { ArrayNotEmpty, IsArray, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class StartThreadDto {
  @IsOptional() @IsEnum(['DIRECT', 'CLASS', 'GROUP']) type?: 'DIRECT' | 'CLASS' | 'GROUP';
  @IsOptional() @IsString() @MaxLength(140) subject?: string;
  @IsOptional() @IsArray() participantIds?: string[];
  @IsOptional() @IsString() classId?: string;
  @IsString() @MaxLength(4000) body: string;
}

export class SendMessageDto {
  @IsString() @MaxLength(4000) body: string;
}
