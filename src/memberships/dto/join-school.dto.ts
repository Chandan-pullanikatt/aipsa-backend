import { IsString, MinLength } from 'class-validator';

export class JoinSchoolDto {
  @IsString()
  @MinLength(1)
  code: string;
}
