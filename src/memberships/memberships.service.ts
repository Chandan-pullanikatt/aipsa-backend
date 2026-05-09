import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { JoinSchoolDto } from './dto/join-school.dto';

const ROLE_MAP: Record<string, string> = {
  teacher: 'Teacher',
  staff: 'Staff',
  manager: 'Manager',
};

@Injectable()
export class MembershipsService {
  constructor(
    private prisma: PrismaService,
    private gateway: RealtimeGateway,
  ) {}

  async joinSchool(userId: string, dto: JoinSchoolDto) {
    console.log(`[MEMBERSHIP] Attempting to join with code: "${dto.code}"`);
    const inviteCode = await this.prisma.inviteCode.findUnique({
      where: { code: dto.code.trim() },
    });

    if (!inviteCode) {
      throw new BadRequestException('Invalid invite code. Please check and try again.');
    }

    // Check if already a member
    const existing = await this.prisma.membership.findUnique({
      where: { userId_schoolId: { userId, schoolId: inviteCode.schoolId } },
    });
    if (existing) {
      throw new BadRequestException('You are already a member of this school.');
    }

    const role = ROLE_MAP[inviteCode.roleKey] || 'Staff';

    // Create membership
    await this.prisma.membership.create({
      data: { userId, schoolId: inviteCode.schoolId, role },
    });

    // Fetch school + its groups in parallel
    const [school, groups] = await Promise.all([
      this.prisma.school.findUnique({ where: { id: inviteCode.schoolId } }),
      this.prisma.group.findMany({ where: { schoolId: inviteCode.schoolId } }),
    ]);

    // Add new member to all groups in this school
    if (groups.length) {
      await this.prisma.groupMember.createMany({
        data: groups.map((g) => ({ userId, groupId: g.id })),
        skipDuplicates: true,
      });
    }

    // --- NOTIFICATIONS FOR OWNERS ---
    try {
      const owners = await this.prisma.membership.findMany({
        where: { schoolId: inviteCode.schoolId, role: 'Owner' },
      });
      const profile = await this.prisma.profile.findUnique({ where: { id: userId } });
      const joinerName = profile?.name || profile?.email;

      if (owners.length) {
        const notifs = await Promise.all(
          owners.map((owner) =>
            this.prisma.notification.create({
              data: {
                userId: owner.userId,
                title: 'New Member Joined',
                message: `${joinerName} has joined ${school?.name || 'the school'} as a ${role}.`,
                type: 'success',
              },
            }),
          ),
        );

        // Emit to each owner via their private socket room
        notifs.forEach((n) => {
          this.gateway.server.to(`user:${n.userId}`).emit('notification:created', n);
        });
      }

      // --- REAL-TIME STATE UPDATE FOR ALL SCHOOL MEMBERS ---
      this.gateway.server.to(`school:${inviteCode.schoolId}`).emit('membership:created', {
        userId,
        schoolId: inviteCode.schoolId,
        role,
      });

      const fullProfile = await this.prisma.profile.findUnique({ where: { id: userId } });
      if (fullProfile) {
        this.gateway.server.to(`school:${inviteCode.schoolId}`).emit('user:joined', {
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
      schoolId: inviteCode.schoolId,
      role,
      school: school
        ? { id: school.id, name: school.name, address: school.address, type: school.type }
        : null,
      groups: groups.map((g) => ({
        id: g.id,
        schoolId: g.schoolId,
        name: g.name,
        parentId: g.parentId || null,
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
    // Must be Owner to remove others; cannot remove yourself via this endpoint
    const requesterMembership = await this.prisma.membership.findUnique({
      where: { userId_schoolId: { userId: requesterId, schoolId } },
    });

    if (!requesterMembership || requesterMembership.role !== 'Owner') {
      throw new ForbiddenException('Only school Owners can remove members');
    }

    if (requesterId === targetUserId) {
      throw new BadRequestException('Owners cannot remove themselves');
    }

    // Delete membership
    await this.prisma.membership.deleteMany({
      where: { userId: targetUserId, schoolId },
    });

    // Delete group memberships for this school's groups
    const groupIds = (
      await this.prisma.group.findMany({
        where: { schoolId },
        select: { id: true },
      })
    ).map((g) => g.id);

    if (groupIds.length) {
      await this.prisma.groupMember.deleteMany({
        where: { userId: targetUserId, groupId: { in: groupIds } },
      });
    }

    return { success: true };
  }
}
