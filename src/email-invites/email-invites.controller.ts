import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EmailInvitesService } from './email-invites.service';
import { CreateEmailInviteDto } from './dto/create-email-invite.dto';

@Controller('invites')
export class EmailInvitesController {
  constructor(private service: EmailInvitesService) {}

  /** Send a new email invite (Owner/Admin only) */
  @Post('email')
  @UseGuards(JwtAuthGuard)
  create(@Req() req: any, @Body() dto: CreateEmailInviteDto) {
    return this.service.create(req.user.id, dto);
  }

  /** List pending invites for a school (Owner/Admin only) */
  @Get('email')
  @UseGuards(JwtAuthGuard)
  list(@Req() req: any, @Query('schoolId') schoolId: string) {
    return this.service.list(req.user.id, schoolId);
  }

  /** Cancel a pending invite (Owner/Admin only) */
  @Delete('email/:id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  cancel(@Req() req: any, @Param('id') inviteId: string) {
    return this.service.cancel(req.user.id, inviteId);
  }

  /** Preview invite details by token (public — no auth required) */
  @Get('preview')
  preview(@Query('token') token: string) {
    return this.service.preview(token);
  }
}
