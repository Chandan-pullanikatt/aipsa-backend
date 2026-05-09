import {
  Controller,
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
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { EditTaskDto } from './dto/edit-task.dto';

@Controller('tasks')
@UseGuards(JwtAuthGuard)
export class TasksController {
  constructor(private tasks: TasksService) {}

  @Post()
  create(@Req() req: any, @Body() dto: CreateTaskDto) {
    return this.tasks.create(req.user.id, dto);
  }

  @Patch(':id/toggle')
  @HttpCode(HttpStatus.OK)
  toggle(@Req() req: any, @Param('id') taskId: string) {
    return this.tasks.toggle(req.user.id, taskId);
  }

  @Patch(':id')
  edit(
    @Req() req: any,
    @Param('id') taskId: string,
    @Body() dto: EditTaskDto,
  ) {
    return this.tasks.edit(req.user.id, taskId, dto);
  }

  @Delete(':id')
  remove(@Req() req: any, @Param('id') taskId: string) {
    return this.tasks.remove(req.user.id, taskId);
  }
}
