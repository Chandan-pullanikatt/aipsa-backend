import { IsString, IsUUID, IsOptional, MinLength, MaxLength } from 'class-validator';

export class CreateGroupDto {
  @IsUUID()
  schoolId: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsUUID()
  parentId?: string;

  @IsOptional()
  @IsUUID(undefined, { each: true })
  userIds?: string[];
}
