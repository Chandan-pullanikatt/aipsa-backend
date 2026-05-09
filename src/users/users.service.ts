import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async updateMe(userId: string, dto: UpdateUserDto) {
    const updated = await this.prisma.profile.update({
      where: { id: userId },
      data: { name: dto.name.trim() },
    });
    return { id: updated.id, email: updated.email, name: updated.name };
  }
}
