import { IsString, IsOptional, MaxLength, IsIn } from 'class-validator';

export class EditTaskDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  title?: string;

  @IsOptional()
  assignedTo?: string | null;

  @IsOptional()
  dueDate?: string | null;

  @IsOptional()
  @IsIn(['low', 'medium', 'high'])
  priority?: string;
}
