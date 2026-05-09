import { IsEmail } from 'class-validator';

export class SendOtpDto {
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email: string;
}
