import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSchoolDto } from './dto/create-school.dto';
import { UpdateSchoolDto } from './dto/update-school.dto';

function genCode(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

@Injectable()
export class SchoolsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateSchoolDto) {
    // Create school + owner membership + 3 invite codes atomically
    const school = await this.prisma.school.create({
      data: {
        name: dto.name.trim(),
        address: dto.address.trim(),
        type: dto.type,
        memberships: {
          create: { userId, role: 'Owner' },
        },
        inviteCodes: {
          create: [
            { roleKey: 'teacher', code: genCode('T') },
            { roleKey: 'staff',   code: genCode('S') },
            { roleKey: 'manager', code: genCode('M') },
          ],
        },
      },
      include: { inviteCodes: true },
    });

    const inviteCodes: Record<string, string> = {};
    school.inviteCodes.forEach((ic) => {
      inviteCodes[ic.roleKey] = ic.code;
    });

    return {
      id: school.id,
      name: school.name,
      address: school.address,
      type: school.type,
      membership: { userId, schoolId: school.id, role: 'Owner' },
      inviteCodes: { [school.id]: inviteCodes },
    };
  }

  async update(userId: string, schoolId: string, dto: UpdateSchoolDto) {
    await this.assertOwner(userId, schoolId);

    const updates: any = {};
    if (dto.name !== undefined) updates.name = dto.name.trim();
    if (dto.address !== undefined) updates.address = dto.address.trim();
    if (dto.type !== undefined) updates.type = dto.type;

    await this.prisma.school.update({ where: { id: schoolId }, data: updates });
    return { success: true };
  }

  async regenerateCode(userId: string, schoolId: string, roleKey: string) {
    await this.assertOwner(userId, schoolId);

    const prefixMap: Record<string, string> = {
      teacher: 'T',
      staff: 'S',
      manager: 'M',
    };
    const code = genCode(prefixMap[roleKey] || 'T');

    await this.prisma.inviteCode.upsert({
      where: { schoolId_roleKey: { schoolId, roleKey } },
      create: { schoolId, roleKey, code },
      update: { code },
    });

    return { code };
  }

  // ── Guard helpers ────────────────────────────────────────────

  async assertOwner(userId: string, schoolId: string) {
    const membership = await this.prisma.membership.findUnique({
      where: { userId_schoolId: { userId, schoolId } },
    });
    if (!membership || membership.role !== 'Owner') {
      throw new ForbiddenException('Only school Owners can perform this action');
    }
  }

  async assertMember(userId: string, schoolId: string) {
    const membership = await this.prisma.membership.findUnique({
      where: { userId_schoolId: { userId, schoolId } },
    });
    if (!membership) {
      throw new ForbiddenException('You are not a member of this school');
    }
    return membership;
  }
}
