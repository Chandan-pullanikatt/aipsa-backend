import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
export declare class AuthService {
    private prisma;
    private jwt;
    private config;
    private mail;
    constructor(prisma: PrismaService, jwt: JwtService, config: ConfigService, mail: MailService);
    sendOtp(dto: SendOtpDto): Promise<{
        success: boolean;
    }>;
    verifyOtp(dto: VerifyOtpDto, res: any): Promise<{
        accessToken: string;
        user: {
            id: string;
            email: string;
            name: string;
        };
    }>;
    refresh(refreshTokenCookie: string): Promise<{
        accessToken: string;
    }>;
    logout(refreshTokenCookie: string, res: any): Promise<{
        success: boolean;
    }>;
    private generateAccessToken;
    private generateRefreshToken;
    private hashToken;
}
