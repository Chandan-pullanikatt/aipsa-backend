import { IsString, IsUUID, IsOptional, MaxLength, IsIn, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class TodoItemDto {
  @IsString()
  id: string;

  @IsString()
  @MaxLength(500)
  text: string;

  done: boolean;
}

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

  @IsOptional()
  @IsArray()
  todoItems?: TodoItemDto[];
}
