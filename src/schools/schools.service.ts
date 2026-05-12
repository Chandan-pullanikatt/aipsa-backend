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

const CODE_PREFIXES: Record<string, string> = {
  manager: 'M',
  user:    'U',
};

@Injectable()
export class SchoolsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateSchoolDto) {
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
            { roleKey: 'manager', code: genCode('M') },
            { roleKey: 'user',    code: genCode('U') },
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
    await this.assertAdminOrAbove(userId, schoolId);

    const updates: any = {};
    if (dto.name !== undefined) updates.name = dto.name.trim();
    if (dto.address !== undefined) updates.address = dto.address.trim();
    if (dto.type !== undefined) updates.type = dto.type;

    await this.prisma.school.update({ where: { id: schoolId }, data: updates });
    return { success: true };
  }

  async regenerateCode(userId: string, schoolId: string, roleKey: string) {
    await this.assertAdminOrAbove(userId, schoolId);

    if (!CODE_PREFIXES[roleKey]) {
      throw new ForbiddenException('Invalid role key');
    }

    const code = genCode(CODE_PREFIXES[roleKey]);
    await this.prisma.inviteCode.upsert({
      where: { schoolId_roleKey: { schoolId, roleKey } },
      create: { schoolId, roleKey, code },
      update: { code },
    });

    return { code };
  }

  // ── Guard helpers ────────────────────────────────────────────

  async assertOwner(userId: string, schoolId: string) {
    const m = await this.prisma.membership.findUnique({
      where: { userId_schoolId: { userId, schoolId } },
    });
    if (!m || m.role !== 'Owner') {
      throw new ForbiddenException('Only school Owners can perform this action');
    }
  }

  async assertAdminOrAbove(userId: string, schoolId: string) {
    const m = await this.prisma.membership.findUnique({
      where: { userId_schoolId: { userId, schoolId } },
    });
    if (!m || !['Owner', 'Admin'].includes(m.role)) {
      throw new ForbiddenException('Only Owners and Admins can perform this action');
    }
  }

  async assertMember(userId: string, schoolId: string) {
    const m = await this.prisma.membership.findUnique({
      where: { userId_schoolId: { userId, schoolId } },
    });
    if (!m) throw new ForbiddenException('You are not a member of this school');
    return m;
  }
}
