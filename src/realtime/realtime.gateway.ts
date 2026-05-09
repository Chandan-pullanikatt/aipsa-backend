import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@WebSocketGateway({
  cors: {
    origin: (origin: string, cb: Function) => cb(null, true),
    credentials: true,
  },
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        client.disconnect();
        return;
      }

      const payload = this.jwt.verify(token, {
        secret: this.config.get<string>('JWT_SECRET'),
      });
      client.data.userId = payload.sub;
      client.join(`user:${payload.sub}`);
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    // Socket.IO automatically removes the client from all rooms on disconnect
  }

  // ── Task room — user calls this after login ──────────────────

  @SubscribeMessage('join:tasks')
  handleJoinTasks(
    @ConnectedSocket() client: Socket,
    @MessageBody() groupIds: string[],
  ) {
    if (!Array.isArray(groupIds)) return;
    groupIds.forEach((id) => client.join(`tasks:${id}`));
  }

  @SubscribeMessage('join:school')
  handleJoinSchool(
    @ConnectedSocket() client: Socket,
    @MessageBody() schoolId: string,
  ) {
    if (!schoolId) return;
    client.join(`school:${schoolId}`);
  }

  // ── Chat room — user calls this when opening a group chat ────

  @SubscribeMessage('join:chat')
  handleJoinChat(
    @ConnectedSocket() client: Socket,
    @MessageBody() groupId: string,
  ) {
    client.join(`chat:${groupId}`);
  }

  @SubscribeMessage('leave:chat')
  handleLeaveChat(
    @ConnectedSocket() client: Socket,
    @MessageBody() groupId: string,
  ) {
    client.leave(`chat:${groupId}`);
  }
}
