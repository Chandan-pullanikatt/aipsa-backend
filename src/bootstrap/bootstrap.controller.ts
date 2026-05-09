import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

@Controller('app')
export class BootstrapController {
  constructor(private prisma: PrismaService) {}

  @Get('bootstrap')
  @UseGuards(JwtAuthGuard)
  async bootstrap(@Req() req: any) {
    const userId: string = req.user.id;

    // Round 1 — profile + memberships in parallel
    const [profile, memberships, notifications] = await Promise.all([
      this.prisma.profile.findUnique({ where: { id: userId } }),
      this.prisma.membership.findMany({ where: { userId } }),
      this.prisma.notification.findMany({
        where: { userId, read: false },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    if (!profile) {
      return {
        user: { id: userId, email: req.user.email, name: '' },
        schools: [],
        memberships: [],
        groups: [],
        groupMembers: [],
        tasks: [],
        users: [],
        inviteCodes: {},
        notifications: [],
      };
    }

    const schoolIds = memberships.map((m) => m.schoolId);

    if (schoolIds.length === 0) {
      return {
        user: { id: profile.id, email: profile.email, name: profile.name },
        schools: [],
        memberships: [],
        groups: [],
        groupMembers: [],
        tasks: [],
        users: [{ id: profile.id, email: profile.email, name: profile.name }],
        inviteCodes: {},
        notifications: notifications.map((n) => ({
          id: n.id, title: n.title, message: n.message,
          type: n.type, read: n.read, createdAt: n.createdAt,
        })),
      };
    }

    // Round 2 — schools, groups, invite codes in parallel
    const [schools, groups, inviteCodeRows] = await Promise.all([
      this.prisma.school.findMany({ where: { id: { in: schoolIds } } }),
      this.prisma.group.findMany({ where: { schoolId: { in: schoolIds } } }),
      this.prisma.inviteCode.findMany({ where: { schoolId: { in: schoolIds } } }),
    ]);

    const groupIds = groups.map((g) => g.id);

    // Round 3 — group members, tasks, school member profiles, and ALL memberships for these schools
    const [groupMembers, tasks, users, allMemberships] = await Promise.all([
      groupIds.length
        ? this.prisma.groupMember.findMany({ where: { groupId: { in: groupIds } } })
        : Promise.resolve([]),
      groupIds.length
        ? this.prisma.task.findMany({ where: { groupId: { in: groupIds } } })
        : Promise.resolve([]),
      this.prisma.profile.findMany({
        where: { memberships: { some: { schoolId: { in: schoolIds } } } },
      }),
      this.prisma.membership.findMany({
        where: { schoolId: { in: schoolIds } },
      }),
    ]);

    // Top-up: fetch profiles for group members not already in the users list
    const knownIds = new Set(users.map((u) => u.id));
    const extraIds = [...new Set(groupMembers.map((gm) => gm.userId))].filter(
      (id) => !knownIds.has(id),
    );
    const extraUsers = extraIds.length
      ? await this.prisma.profile.findMany({ where: { id: { in: extraIds } } })
      : [];
    const allUsers = [...users, ...extraUsers];

    // Build inviteCodes map: { [schoolId]: { teacher, staff, manager } }
    const inviteCodes: Record<string, Record<string, string>> = {};
    inviteCodeRows.forEach((ic) => {
      if (!inviteCodes[ic.schoolId]) inviteCodes[ic.schoolId] = {};
      inviteCodes[ic.schoolId][ic.roleKey] = ic.code;
    });

    return {
      user: { id: profile.id, email: profile.email, name: profile.name },
      schools: schools.map((s) => ({
        id: s.id,
        name: s.name,
        address: s.address,
        type: s.type,
      })),
      memberships: allMemberships.map((m) => ({
        userId: m.userId,
        schoolId: m.schoolId,
        role: m.role,
      })),
      groups: groups.map((g) => ({
        id: g.id,
        schoolId: g.schoolId,
        name: g.name,
        parentId: g.parentId || null,
      })),
      groupMembers: groupMembers.map((gm) => ({
        userId: gm.userId,
        groupId: gm.groupId,
      })),
      tasks: tasks.map((t) => ({
        id: t.id,
        groupId: t.groupId,
        title: t.title,
        assignedTo: t.assignedTo,
        dueDate: t.dueDate,
        priority: t.priority,
        status: t.status,
        createdBy: t.createdBy,
      })),
      users: allUsers.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
      })),
      inviteCodes,
      notifications: notifications.map((n) => ({
        id: n.id,
        title: n.title,
        message: n.message,
        type: n.type,
        read: n.read,
        createdAt: n.createdAt,
      })),
    };
  }
}
