import { IsString } from 'class-validator';

export class ToggleTodoDto {
  @IsString()
  itemId: string;
}
