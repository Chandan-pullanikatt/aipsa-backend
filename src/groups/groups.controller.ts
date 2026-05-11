import {
  Controller,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GroupsService } from './groups.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';

@Controller('groups')
@UseGuards(JwtAuthGuard)
export class GroupsController {
  constructor(private groups: GroupsService) {}

  @Post()
  create(@Req() req: any, @Body() dto: CreateGroupDto) {
    return this.groups.create(req.user.id, dto);
  }

  @Patch(':id')
  rename(
    @Req() req: any,
    @Param('id') groupId: string,
    @Body() dto: UpdateGroupDto,
  ) {
    return this.groups.rename(req.user.id, groupId, dto);
  }

  @Delete(':id')
  delete(@Req() req: any, @Param('id') groupId: string) {
    return this.groups.delete(req.user.id, groupId);
  }
}
