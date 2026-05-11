import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';

@Injectable()
export class GroupsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateGroupDto) {
    // Only Owner or Admin can create groups
    const membership = await this.prisma.membership.findUnique({
      where: { userId_schoolId: { userId, schoolId: dto.schoolId } },
    });
    if (!membership || !['Owner', 'Admin'].includes(membership.role)) {
      throw new ForbiddenException('Only Owners and Admins can create groups');
    }

    const group = await this.prisma.group.create({
      data: {
        schoolId: dto.schoolId,
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        parentId: dto.parentId || null,
      },
    });

    // If userIds provided, use them. Otherwise default to all school members (current behavior)
    let finalUserIds = dto.userIds;
    if (!finalUserIds || finalUserIds.length === 0) {
      const schoolMembers = await this.prisma.membership.findMany({
        where: { schoolId: dto.schoolId },
        select: { userId: true },
      });
      finalUserIds = schoolMembers.map((m) => m.userId);
    }

    // Ensure the creator is always in the group if not already specified
    if (!finalUserIds.includes(userId)) {
      finalUserIds.push(userId);
    }

    if (finalUserIds.length) {
      await this.prisma.groupMember.createMany({
        data: finalUserIds.map((uid) => ({ userId: uid, groupId: group.id })),
        skipDuplicates: true,
      });
    }

    return {
      id: group.id,
      schoolId: group.schoolId,
      name: group.name,
      parentId: group.parentId || null,
      groupMembers: finalUserIds.map((uid) => ({ userId: uid, groupId: group.id })),
    };
  }

  async rename(userId: string, groupId: string, dto: UpdateGroupDto) {
    const group = await this.prisma.group.findUnique({ where: { id: groupId } });
    if (!group) throw new NotFoundException('Group not found');

    await this.assertOwner(userId, group.schoolId);

    await this.prisma.group.update({
      where: { id: groupId },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.description !== undefined && { description: dto.description || null }),
      },
    });

    return { success: true };
  }

  async delete(userId: string, groupId: string) {
    const group = await this.prisma.group.findUnique({ where: { id: groupId } });
    if (!group) throw new NotFoundException('Group not found');

    await this.assertOwner(userId, group.schoolId);

    // Collect this group and all descendants recursively
    const toDelete = await this.collectDescendants(groupId);
    toDelete.push(groupId);

    // PostgreSQL ON DELETE CASCADE handles group_members, tasks, messages
    await this.prisma.group.deleteMany({ where: { id: { in: toDelete } } });

    return { success: true, deletedGroupIds: toDelete };
  }

  // ── Private helpers ──────────────────────────────────────────

  private async collectDescendants(parentId: string): Promise<string[]> {
    const children = await this.prisma.group.findMany({
      where: { parentId },
      select: { id: true },
    });
    const ids: string[] = [];
    for (const child of children) {
      ids.push(child.id);
      const nested = await this.collectDescendants(child.id);
      ids.push(...nested);
    }
    return ids;
  }

  private async assertOwner(userId: string, schoolId: string) {
    const membership = await this.prisma.membership.findUnique({
      where: { userId_schoolId: { userId, schoolId } },
    });
    if (!membership || membership.role !== 'Owner') {
      throw new ForbiddenException('Only school Owners can perform this action');
    }
  }
}
