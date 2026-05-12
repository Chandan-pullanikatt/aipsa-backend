import { Module } from '@nestjs/common';
import { EmailInvitesService } from './email-invites.service';
import { EmailInvitesController } from './email-invites.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [PrismaModule, MailModule],
  controllers: [EmailInvitesController],
  providers: [EmailInvitesService],
  exports: [EmailInvitesService],
})
export class EmailInvitesModule {}
