import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { CreateTaskDto } from './dto/create-task.dto';
import { EditTaskDto } from './dto/edit-task.dto';

@Injectable()
export class TasksService {
  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => RealtimeGateway))
    private gateway: RealtimeGateway,
  ) {}

  async create(userId: string, dto: CreateTaskDto) {
    await this.assertGroupMember(userId, dto.groupId);

    const task = await this.prisma.task.create({
      data: {
        groupId: dto.groupId,
        title: dto.title,
        assignedTo: dto.assignedTo || null,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        priority: dto.priority || 'medium',
        status: 'pending',
        createdBy: userId,
      },
    });

    const formatted = this.fmt(task);
    this.gateway.server.to(`tasks:${task.groupId}`).emit('task:created', formatted);
    return formatted;
  }

  async toggle(userId: string, taskId: string) {
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Task not found');
    await this.assertGroupMember(userId, task.groupId);

    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    const updated = await this.prisma.task.update({
      where: { id: taskId },
      data: { status: newStatus },
    });

    const formatted = this.fmt(updated);
    this.gateway.server.to(`tasks:${updated.groupId}`).emit('task:updated', formatted);
    return formatted;
  }

  async edit(userId: string, taskId: string, dto: EditTaskDto) {
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Task not found');
    await this.assertGroupMember(userId, task.groupId);

    const data: any = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.assignedTo !== undefined) data.assignedTo = dto.assignedTo || null;
    if (dto.dueDate !== undefined) data.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
    if (dto.priority !== undefined) data.priority = dto.priority;

    const updated = await this.prisma.task.update({ where: { id: taskId }, data });

    const formatted = this.fmt(updated);
    this.gateway.server.to(`tasks:${updated.groupId}`).emit('task:updated', formatted);
    return formatted;
  }

  async remove(userId: string, taskId: string) {
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Task not found');
    await this.assertGroupMember(userId, task.groupId);

    await this.prisma.task.delete({ where: { id: taskId } });

    this.gateway.server
      .to(`tasks:${task.groupId}`)
      .emit('task:deleted', { id: taskId });

    return { success: true };
  }

  // ── Private helpers ──────────────────────────────────────────

  private async assertGroupMember(userId: string, groupId: string) {
    const member = await this.prisma.groupMember.findUnique({
      where: { userId_groupId: { userId, groupId } },
    });
    if (!member) throw new ForbiddenException('You are not a member of this group');
  }

  private fmt(task: any) {
    return {
      id: task.id,
      groupId: task.groupId,
      title: task.title,
      assignedTo: task.assignedTo,
      dueDate: task.dueDate,
      priority: task.priority,
      status: task.status,
      createdBy: task.createdBy,
    };
  }
}
