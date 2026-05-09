import { IsString, MinLength, MaxLength } from 'class-validator';

export class CreateSchoolDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name: string;

  @IsString()
  @MaxLength(500)
  address: string;

  @IsString()
  type: string;
}
