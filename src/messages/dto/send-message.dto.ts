import { IsString, IsUUID, IsOptional, MaxLength } from 'class-validator';

export class SendMessageDto {
  @IsUUID()
  groupId: string;

  @IsString()
  @MaxLength(2000)
  content: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  metadata?: Record<string, any>;
}
