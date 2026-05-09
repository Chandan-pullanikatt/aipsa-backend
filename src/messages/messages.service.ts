import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { SendMessageDto } from './dto/send-message.dto';
import { VotePollDto } from './dto/vote-poll.dto';
import { ToggleTodoDto } from './dto/toggle-todo.dto';

@Injectable()
export class MessagesService {
  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => RealtimeGateway))
    private gateway: RealtimeGateway,
  ) {}

  async getMessages(userId: string, groupId: string, limit = 50, before?: string) {
    // Run membership check and message fetch in parallel to halve latency
    const [, messages] = await Promise.all([
      this.assertGroupMember(userId, groupId),
      this.prisma.message.findMany({
        where: {
          groupId,
          ...(before ? { createdAt: { lt: new Date(before) } } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
    ]);

    // Reverse so they're in chronological order for display
    const sorted = messages.reverse();
    const hasMore = messages.length === limit;
    const cursor = sorted.length > 0 ? sorted[0].createdAt.toISOString() : null;

    return {
      messages: sorted.map(this.fmt),
      hasMore,
      cursor,
    };
  }

  async send(userId: string, dto: SendMessageDto) {
    await this.assertGroupMember(userId, dto.groupId);

    const profile = await this.prisma.profile.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    });
    const senderName = profile?.name || profile?.email || '';

    const msg = await this.prisma.message.create({
      data: {
        groupId: dto.groupId,
        senderId: userId,
        senderName,
        content: dto.content,
        type: dto.type || 'text',
        metadata: dto.metadata || {},
      },
    });

    const formatted = this.fmt(msg);
    this.gateway.server.to(`chat:${msg.groupId}`).emit('message:created', formatted);
    return formatted;
  }

  async votePoll(userId: string, messageId: string, dto: VotePollDto) {
    const msg = await this.prisma.message.findUnique({ where: { id: messageId } });
    if (!msg) throw new NotFoundException('Message not found');
    await this.assertGroupMember(userId, msg.groupId);

    const metadata = msg.metadata as any;
    const pollOptions: any[] = metadata?.pollOptions || [];

    // Toggle vote: remove from all options, add to selected
    const newOptions = pollOptions.map((opt: any) => {
      const votes: string[] = (opt.votes || []).filter((v: string) => v !== userId);
      if (opt.id === dto.optionId) votes.push(userId);
      return { ...opt, votes };
    });

    const updated = await this.prisma.message.update({
      where: { id: messageId },
      data: { metadata: { ...metadata, pollOptions: newOptions } },
    });

    const formatted = this.fmt(updated);
    this.gateway.server.to(`chat:${msg.groupId}`).emit('message:updated', formatted);
    return formatted;
  }

  async toggleTodo(userId: string, messageId: string, dto: ToggleTodoDto) {
    const msg = await this.prisma.message.findUnique({ where: { id: messageId } });
    if (!msg) throw new NotFoundException('Message not found');
    await this.assertGroupMember(userId, msg.groupId);

    const metadata = msg.metadata as any;
    const todoItems: any[] = metadata?.todoItems || [];

    const newItems = todoItems.map((item: any) =>
      item.id === dto.itemId ? { ...item, done: !item.done } : item,
    );

    const updated = await this.prisma.message.update({
      where: { id: messageId },
      data: { metadata: { ...metadata, todoItems: newItems } },
    });

    const formatted = this.fmt(updated);
    this.gateway.server.to(`chat:${msg.groupId}`).emit('message:updated', formatted);
    return formatted;
  }

  // ── Private helpers ──────────────────────────────────────────

  private async assertGroupMember(userId: string, groupId: string) {
    const member = await this.prisma.groupMember.findUnique({
      where: { userId_groupId: { userId, groupId } },
    });
    if (!member) throw new ForbiddenException('You are not a member of this group');
  }

  private fmt(msg: any) {
    return {
      id: msg.id,
      groupId: msg.groupId,
      senderId: msg.senderId,
      senderName: msg.senderName,
      content: msg.content,
      type: msg.type,
      timestamp: msg.createdAt,
      ...(msg.metadata || {}),
    };
  }
}
