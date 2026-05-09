import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MessagesService } from './messages.service';
import { SendMessageDto } from './dto/send-message.dto';
import { VotePollDto } from './dto/vote-poll.dto';
import { ToggleTodoDto } from './dto/toggle-todo.dto';

@Controller('messages')
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(private messages: MessagesService) {}

  @Get()
  getMessages(
    @Req() req: any,
    @Query('groupId') groupId: string,
    @Query('limit') limit?: string,
    @Query('before') before?: string,
  ) {
    return this.messages.getMessages(
      req.user.id,
      groupId,
      limit ? parseInt(limit, 10) : 50,
      before || undefined,
    );
  }

  @Post()
  send(@Req() req: any, @Body() dto: SendMessageDto) {
    return this.messages.send(req.user.id, dto);
  }

  @Patch(':id/vote')
  @HttpCode(HttpStatus.OK)
  vote(
    @Req() req: any,
    @Param('id') messageId: string,
    @Body() dto: VotePollDto,
  ) {
    return this.messages.votePoll(req.user.id, messageId, dto);
  }

  @Patch(':id/toggle-todo')
  @HttpCode(HttpStatus.OK)
  toggleTodo(
    @Req() req: any,
    @Param('id') messageId: string,
    @Body() dto: ToggleTodoDto,
  ) {
    return this.messages.toggleTodo(req.user.id, messageId, dto);
  }
}
