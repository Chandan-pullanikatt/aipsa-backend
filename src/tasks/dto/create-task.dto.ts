import { IsString, IsUUID, IsOptional, MaxLength, IsIn } from 'class-validator';

export class CreateTaskDto {
  @IsUUID()
  groupId: string;

  @IsString()
  @MaxLength(500)
  title: string;

  @IsOptional()
  @IsUUID()
  assignedTo?: string;

  @IsOptional()
  @IsString()
  dueDate?: string;

  @IsOptional()
  @IsIn(['low', 'medium', 'high'])
  priority?: string;
}
