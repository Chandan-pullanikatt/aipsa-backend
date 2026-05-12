import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { ConfigService } from '@nestjs/config';
import { CreateEmailInviteDto } from './dto/create-email-invite.dto';

const INVITE_EXPIRES_DAYS = 7;

@Injectable()
export class EmailInvitesService {
  private readonly frontendUrl: string;

  constructor(
    private prisma: PrismaService,
    private mail: MailService,
    private config: ConfigService,
  ) {
    this.frontendUrl = this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:5173';
  }

  async create(requesterId: string, dto: CreateEmailInviteDto) {
    // Only Owner/Admin can send invites; Admin cannot invite another Admin beyond maxAdmins
    const requester = await this.prisma.membership.findUnique({
      where: { userId_schoolId: { userId: requesterId, schoolId: dto.schoolId } },
    });
    if (!requester || !['Owner', 'Admin'].includes(requester.role)) {
      throw new ForbiddenException('Only Owners and Admins can send invites');
    }

    // Enforce maxAdmins for Admin invites
    if (dto.role === 'Admin') {
      const school = await this.prisma.school.findUnique({ where: { id: dto.schoolId } });
      const adminCount = await this.prisma.membership.count({
        where: { schoolId: dto.schoolId, role: 'Admin' },
      });
      // Also count pending Admin email invites
      const pendingAdminInvites = await this.prisma.emailInvite.count({
        where: { schoolId: dto.schoolId, role: 'Admin', usedAt: null, expiresAt: { gt: new Date() } },
      });
      if (school && (adminCount + pendingAdminInvites) >= school.maxAdmins) {
        throw new BadRequestException(
          `This school already has the maximum number of Admins (${school.maxAdmins}).`,
        );
      }
    }

    const school = await this.prisma.school.findUnique({ where: { id: dto.schoolId } });
    if (!school) throw new NotFoundException('School not found');

    // Cancel any existing pending invite for the same email+school
    await this.prisma.emailInvite.deleteMany({
      where: { schoolId: dto.schoolId, email: dto.email.toLowerCase(), usedAt: null },
    });

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + INVITE_EXPIRES_DAYS * 24 * 60 * 60 * 1000);

    const invite = await this.prisma.emailInvite.create({
      data: {
        schoolId: dto.schoolId,
        email: dto.email.toLowerCase(),
        role: dto.role,
        token,
        expiresAt,
      },
    });

    const requesterProfile = await this.prisma.profile.findUnique({ where: { id: requesterId } });
    const inviterName = requesterProfile?.name || requesterProfile?.email || 'Someone';

    await this.mail.sendInviteEmail(
      dto.email,
      token,
      school.name,
      dto.role,
      inviterName,
      this.frontendUrl,
    );

    return {
      id: invite.id,
      email: invite.email,
      role: invite.role,
      expiresAt: invite.expiresAt,
      createdAt: invite.createdAt,
    };
  }

  async list(requesterId: string, schoolId: string) {
    const membership = await this.prisma.membership.findUnique({
      where: { userId_schoolId: { userId: requesterId, schoolId } },
    });
    if (!membership || !['Owner', 'Admin'].includes(membership.role)) {
      throw new ForbiddenException('Only Owners and Admins can view pending invites');
    }

    const invites = await this.prisma.emailInvite.findMany({
      where: { schoolId, usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });

    return invites.map((i) => ({
      id: i.id,
      email: i.email,
      role: i.role,
      expiresAt: i.expiresAt,
      createdAt: i.createdAt,
    }));
  }

  async cancel(requesterId: string, inviteId: string) {
    const invite = await this.prisma.emailInvite.findUnique({ where: { id: inviteId } });
    if (!invite) throw new NotFoundException('Invite not found');

    const membership = await this.prisma.membership.findUnique({
      where: { userId_schoolId: { userId: requesterId, schoolId: invite.schoolId } },
    });
    if (!membership || !['Owner', 'Admin'].includes(membership.role)) {
      throw new ForbiddenException('Only Owners and Admins can cancel invites');
    }

    await this.prisma.emailInvite.delete({ where: { id: inviteId } });
    return { success: true };
  }

  async preview(token: string) {
    const invite = await this.prisma.emailInvite.findUnique({ where: { token } });
    if (!invite || invite.usedAt || new Date() > invite.expiresAt) {
      throw new NotFoundException('This invite link is invalid or has expired.');
    }

    const school = await this.prisma.school.findUnique({ where: { id: invite.schoolId } });
    return {
      schoolName: school?.name ?? 'Unknown School',
      role: invite.role,
      email: invite.email,
      expiresAt: invite.expiresAt,
    };
  }
}
