import {
  Injectable,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { JoinSchoolDto } from './dto/join-school.dto';

const ROLE_MAP: Record<string, string> = {
  manager: 'Manager',
  user:    'User',
};

@Injectable()
export class MembershipsService {
  constructor(
    private prisma: PrismaService,
    private gateway: RealtimeGateway,
  ) {}

  async joinSchool(userId: string, dto: JoinSchoolDto) {
    const inviteCode = await this.prisma.inviteCode.findUnique({
      where: { code: dto.code.trim() },
    });

    if (!inviteCode) {
      throw new BadRequestException('Invalid invite code. Please check and try again.');
    }

    const existing = await this.prisma.membership.findUnique({
      where: { userId_schoolId: { userId, schoolId: inviteCode.schoolId } },
    });
    if (existing) {
      throw new BadRequestException('You are already a member of this school.');
    }

    const role = ROLE_MAP[inviteCode.roleKey] || 'User';
    return this.createMembership(userId, inviteCode.schoolId, role);
  }

  async acceptEmailInvite(userId: string, token: string) {
    const invite = await this.prisma.emailInvite.findUnique({ where: { token } });

    if (!invite) throw new BadRequestException('Invalid or expired invite link.');
    if (invite.usedAt) throw new BadRequestException('This invite link has already been used.');
    if (new Date() > invite.expiresAt) throw new BadRequestException('This invite link has expired.');

    // Verify email matches logged-in user
    const profile = await this.prisma.profile.findUnique({ where: { id: userId } });
    if (!profile || profile.email.toLowerCase() !== invite.email.toLowerCase()) {
      throw new ForbiddenException('This invite was sent to a different email address.');
    }

    const existing = await this.prisma.membership.findUnique({
      where: { userId_schoolId: { userId, schoolId: invite.schoolId } },
    });
    if (existing) throw new BadRequestException('You are already a member of this school.');

    // Enforce maxAdmins if role is Admin
    if (invite.role === 'Admin') {
      const school = await this.prisma.school.findUnique({ where: { id: invite.schoolId } });
      const adminCount = await this.prisma.membership.count({
        where: { schoolId: invite.schoolId, role: 'Admin' },
      });
      if (school && adminCount >= school.maxAdmins) {
        throw new BadRequestException(
          `This school already has the maximum number of Admins (${school.maxAdmins}).`,
        );
      }
    }

    // Mark invite as used
    await this.prisma.emailInvite.update({
      where: { id: invite.id },
      data: { usedAt: new Date() },
    });

    return this.createMembership(userId, invite.schoolId, invite.role);
  }

  private async createMembership(userId: string, schoolId: string, role: string) {
    await this.prisma.membership.create({
      data: { userId, schoolId, role },
    });

    const [school, groups] = await Promise.all([
      this.prisma.school.findUnique({ where: { id: schoolId } }),
      this.prisma.group.findMany({ where: { schoolId } }),
    ]);

    if (groups.length) {
      await this.prisma.groupMember.createMany({
        data: groups.map((g) => ({ userId, groupId: g.id })),
        skipDuplicates: true,
      });
    }

    try {
      const owners = await this.prisma.membership.findMany({
        where: { schoolId, role: { in: ['Owner', 'Admin'] } },
      });
      const profile = await this.prisma.profile.findUnique({ where: { id: userId } });
      const joinerName = profile?.name || profile?.email;

      if (owners.length) {
        const notifs = await Promise.all(
          owners.map((o) =>
            this.prisma.notification.create({
              data: {
                userId: o.userId,
                title: 'New Member Joined',
                message: `${joinerName} has joined ${school?.name || 'the school'} as a ${role}.`,
                type: 'success',
              },
            }),
          ),
        );
        notifs.forEach((n) => {
          this.gateway.server.to(`user:${n.userId}`).emit('notification:created', n);
        });
      }

      this.gateway.server.to(`school:${schoolId}`).emit('membership:created', {
        userId, schoolId, role,
      });

      const fullProfile = await this.prisma.profile.findUnique({ where: { id: userId } });
      if (fullProfile) {
        this.gateway.server.to(`school:${schoolId}`).emit('user:joined', {
          id: fullProfile.id,
          email: fullProfile.email,
          name: fullProfile.name,
        });
      }
    } catch (err) {
      console.error('[MEMBERSHIP] Failed to create join notifications:', err);
    }

    return {
      success: true,
      schoolId,
      role,
      school: school
        ? { id: school.id, name: school.name, address: school.address, type: school.type }
        : null,
      groups: groups.map((g) => ({
        id: g.id, schoolId: g.schoolId, name: g.name, parentId: g.parentId || null,
      })),
      groupMemberships: groups.map((g) => ({ userId, groupId: g.id })),
    };
  }

  async getNotifications(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }

  async markAsRead(userId: string, notificationId: string) {
    await this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { read: true },
    });
    return { success: true };
  }

  async removeMember(requesterId: string, schoolId: string, targetUserId: string) {
    const requesterMembership = await this.prisma.membership.findUnique({
      where: { userId_schoolId: { userId: requesterId, schoolId } },
    });

    if (!requesterMembership || !['Owner', 'Admin'].includes(requesterMembership.role)) {
      throw new ForbiddenException('Only Owners and Admins can remove members');
    }

    if (requesterId === targetUserId) {
      throw new BadRequestException('You cannot remove yourself');
    }

    const target = await this.prisma.membership.findUnique({
      where: { userId_schoolId: { userId: targetUserId, schoolId } },
    });
    if (target?.role === 'Owner') {
      throw new ForbiddenException('The school Owner cannot be removed');
    }

    await this.prisma.membership.deleteMany({ where: { userId: targetUserId, schoolId } });

    const groupIds = (
      await this.prisma.group.findMany({ where: { schoolId }, select: { id: true } })
    ).map((g) => g.id);

    if (groupIds.length) {
      await this.prisma.groupMember.deleteMany({
        where: { userId: targetUserId, groupId: { in: groupIds } },
      });
    }

    return { success: true };
  }
}
