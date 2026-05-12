import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class MailService {
  private readonly apiKey: string;
  private readonly fromEmail: string;
  private readonly fromName: string;

  constructor(private config: ConfigService) {
    this.apiKey = this.config.get<string>('ZEPTO_API_KEY') ?? '';
    this.fromEmail = this.config.get<string>('ZEPTO_FROM_EMAIL') ?? '';
    this.fromName = this.config.get<string>('ZEPTO_FROM_NAME') ?? 'AIPSA OMS';
  }

  async sendInviteEmail(
    toEmail: string,
    token: string,
    schoolName: string,
    role: string,
    inviterName: string,
    frontendUrl: string,
  ): Promise<void> {
    const link = `${frontendUrl}/join?token=${token}`;

    if (!this.apiKey || this.apiKey.includes('your-zepto-api-key')) {
      console.log(`\n========================================`);
      console.log(`[MOCK EMAIL] Invite to: ${toEmail}`);
      console.log(`[MOCK EMAIL] School: ${schoolName} | Role: ${role}`);
      console.log(`[MOCK EMAIL] Link: ${link}`);
      console.log(`========================================\n`);
      return;
    }

    try {
      await axios.post(
        'https://api.zeptomail.in/v1.1/email',
        {
          from: { address: this.fromEmail, name: this.fromName },
          to: [{ email_address: { address: toEmail } }],
          subject: `You've been invited to join ${schoolName} on AIPSA`,
          htmlbody: `
            <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px">
              <h2 style="color:#1a1a1a">You're Invited!</h2>
              <p style="color:#555">
                <strong>${inviterName}</strong> has invited you to join
                <strong>${schoolName}</strong> as a <strong>${role}</strong>
                on AIPSA Office Management System.
              </p>
              <a href="${link}"
                 style="display:inline-block;background:#1a5c3a;color:#fff;
                        padding:14px 28px;border-radius:8px;font-weight:700;
                        font-size:16px;text-decoration:none;margin:24px 0">
                Accept Invitation
              </a>
              <p style="color:#888;font-size:13px">
                This link expires in <strong>7 days</strong> and can only be used once.
                If you did not expect this invitation, you can ignore this email.
              </p>
            </div>
          `,
        },
        {
          headers: {
            Authorization: this.apiKey,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
        },
      );
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Mail send failed';
      throw new Error(`Failed to send invite email: ${msg}`);
    }
  }

  async sendOtp(toEmail: string, code: string): Promise<void> {
    if (!this.apiKey || this.apiKey.includes('your-zepto-api-key')) {
      const mock = this.config.get<string>('MOCK_OTP');
      console.log(`\n\n========================================`);
      console.log(`[MOCK EMAIL] To: ${toEmail}`);
      console.log(`[MOCK EMAIL] OTP Code: ${code}`);
      if (mock) {
        console.log(`[MOCK INFO] A global mock OTP is also active: ${mock}`);
      }
      console.log(`========================================\n\n`);
      return;
    }

    try {
      await axios.post(
        'https://api.zeptomail.in/v1.1/email',
        {
          from: { address: this.fromEmail, name: this.fromName },
          to: [{ email_address: { address: toEmail } }],
          subject: `${code} — your AIPSA OMS login code`,
          htmlbody: `
            <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px">
              <h2 style="color:#1a1a1a">Your Login Code</h2>
              <p style="color:#555">Use the code below to sign in to AIPSA Office Management System.</p>
              <div style="font-size:36px;font-weight:700;letter-spacing:8px;color:#1a1a1a;
                          background:#f5f5f5;padding:20px 32px;border-radius:8px;
                          text-align:center;margin:24px 0">
                ${code}
              </div>
              <p style="color:#888;font-size:14px">
                This code expires in <strong>10 minutes</strong> and can only be used once.
                If you did not request this, ignore this email.
              </p>
            </div>
          `,
        },
        {
          headers: {
            Authorization: this.apiKey,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
        },
      );
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Mail send failed';
      throw new InternalServerErrorException(`Failed to send OTP email: ${msg}`);
    }
  }
}
