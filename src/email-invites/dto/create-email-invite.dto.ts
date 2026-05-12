import { IsEmail, IsIn, IsUUID } from 'class-validator';

export class CreateEmailInviteDto {
  @IsUUID()
  schoolId: string;

  @IsEmail()
  email: string;

  @IsIn(['Admin', 'Manager', 'User'])
  role: string;
}
