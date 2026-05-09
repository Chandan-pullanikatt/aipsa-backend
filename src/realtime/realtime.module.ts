import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { RealtimeGateway } from './realtime.gateway';
import { TasksModule } from '../tasks/tasks.module';
import { MessagesModule } from '../messages/messages.module';

@Module({
  imports: [
    JwtModule.register({}),
    forwardRef(() => TasksModule),
    forwardRef(() => MessagesModule),
  ],
  providers: [RealtimeGateway],
  exports: [RealtimeGateway],
})
export class RealtimeModule {}
