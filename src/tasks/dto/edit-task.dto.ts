import { IsString, IsOptional, MaxLength, IsIn, IsArray } from 'class-validator';

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

  @IsOptional()
  @IsArray()
  todoItems?: Array<{ id: string; text: string; done: boolean }> | null;
}
