import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private mail: MailService,
  ) {}

  async sendOtp(dto: SendOtpDto): Promise<{ success: boolean }> {
    const email = dto.email.trim().toLowerCase();
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await this.prisma.otpRequest.create({
      data: { email, code, expiresAt },
    });

    await this.mail.sendOtp(email, code);
    return { success: true };
  }

  async verifyOtp(
    dto: VerifyOtpDto,
    res: any,
  ): Promise<{ accessToken: string; user: { id: string; email: string; name: string } }> {
    const email = dto.email.trim().toLowerCase();
    const now = new Date();

    const mockOtp = this.config.get<string>('MOCK_OTP');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let otpRecord: any = null;

    if (mockOtp && dto.token === mockOtp) {
      console.log(`[AUTH] Mock OTP bypass used for ${email}`);
    } else {
      otpRecord = await this.prisma.otpRequest.findFirst({
        where: {
          email,
          code: dto.token,
          usedAt: null,
          expiresAt: { gt: now },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (!otpRecord) {
        console.log(`[AUTH] Invalid OTP attempt for ${email}`);
        throw new BadRequestException('Invalid or expired OTP. Please request a new code.');
      }

      await this.prisma.otpRequest.update({
        where: { id: otpRecord.id },
        data: { usedAt: now },
      });
    }

    // Upsert profile — creates user on first login
    const profile = await this.prisma.profile.upsert({
      where: { email },
      create: { email, name: '' },
      update: {},
    });

    const accessToken = this.generateAccessToken(profile.id, profile.email);
    const refreshToken = await this.generateRefreshToken(profile.id);

    const refreshExpiryDays = parseInt(
      this.config.get<string>('REFRESH_TOKEN_EXPIRES_IN_DAYS') ?? '7',
    );

    const isProd = process.env.NODE_ENV === 'production';

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: isProd, // Must be true for SameSite: None
      sameSite: isProd ? 'none' : 'lax', // 'none' allows cross-site cookies in prod
      maxAge: refreshExpiryDays * 24 * 60 * 60 * 1000,
      path: '/',
    });

    return {
      accessToken,
      user: { id: profile.id, email: profile.email, name: profile.name },
    };
  }

  async refresh(refreshTokenCookie: string): Promise<{ accessToken: string }> {
    if (!refreshTokenCookie) {
      throw new UnauthorizedException('No refresh token provided');
    }

    const tokenHash = this.hashToken(refreshTokenCookie);
    const now = new Date();

    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!stored || stored.expiresAt < now) {
      throw new UnauthorizedException('Refresh token is invalid or expired');
    }

    return { accessToken: this.generateAccessToken(stored.user.id, stored.user.email) };
  }

  async logout(refreshTokenCookie: string, res: any): Promise<{ success: boolean }> {
    if (refreshTokenCookie) {
      const tokenHash = this.hashToken(refreshTokenCookie);
      await this.prisma.refreshToken
        .delete({ where: { tokenHash } })
        .catch(() => {});
    }
    const isProd = process.env.NODE_ENV === 'production';
    res.clearCookie('refreshToken', {
      path: '/',
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
    });
    return { success: true };
  }

  // ── Private helpers ──────────────────────────────────────────

  private generateAccessToken(userId: string, email: string): string {
    const secret = this.config.get<string>('JWT_SECRET') as string;
    const expiresIn = this.config.get<string>('JWT_EXPIRES_IN') ?? '15m';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this.jwt.sign({ sub: userId, email }, { secret, expiresIn: expiresIn as any });
  }

  private async generateRefreshToken(userId: string): Promise<string> {
    const token = crypto.randomBytes(64).toString('hex');
    const tokenHash = this.hashToken(token);
    const days = parseInt(this.config.get<string>('REFRESH_TOKEN_EXPIRES_IN_DAYS') ?? '7');
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    await this.prisma.refreshToken.create({
      data: { userId, tokenHash, expiresAt },
    });

    return token;
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
