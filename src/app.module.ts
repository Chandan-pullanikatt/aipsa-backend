import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { MailModule } from './mail/mail.module';
import { AuthModule } from './auth/auth.module';
import { BootstrapModule } from './bootstrap/bootstrap.module';
import { UsersModule } from './users/users.module';
import { SchoolsModule } from './schools/schools.module';
import { MembershipsModule } from './memberships/memberships.module';
import { GroupsModule } from './groups/groups.module';
import { TasksModule } from './tasks/tasks.module';
import { MessagesModule } from './messages/messages.module';
import { RealtimeModule } from './realtime/realtime.module';
import { UploadModule } from './upload/upload.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    MailModule,
    AuthModule,
    BootstrapModule,
    UsersModule,
    SchoolsModule,
    MembershipsModule,
    GroupsModule,
    TasksModule,
    MessagesModule,
    RealtimeModule,
    UploadModule,
  ],
})
export class AppModule {}
