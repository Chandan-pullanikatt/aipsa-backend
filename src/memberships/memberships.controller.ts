import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MembershipsService } from './memberships.service';
import { JoinSchoolDto } from './dto/join-school.dto';

@Controller('memberships')
@UseGuards(JwtAuthGuard)
export class MembershipsController {
  constructor(private memberships: MembershipsService) {}

  @Post('join')
  @HttpCode(HttpStatus.OK)
  join(@Req() req: any, @Body() dto: JoinSchoolDto) {
    return this.memberships.joinSchool(req.user.id, dto);
  }

  @Post('accept-invite')
  @HttpCode(HttpStatus.OK)
  acceptEmailInvite(@Req() req: any, @Body('token') token: string) {
    return this.memberships.acceptEmailInvite(req.user.id, token);
  }

  @Delete(':schoolId/members/:userId')
  removeMember(
    @Req() req: any,
    @Param('schoolId') schoolId: string,
    @Param('userId') targetUserId: string,
  ) {
    return this.memberships.removeMember(req.user.id, schoolId, targetUserId);
  }

  @Get('notifications')
  getNotifications(@Req() req: any) {
    return this.memberships.getNotifications(req.user.id);
  }

  @Patch('notifications/:id/read')
  @HttpCode(HttpStatus.OK)
  markAsRead(@Req() req: any, @Param('id') id: string) {
    return this.memberships.markAsRead(req.user.id, id);
  }
}
