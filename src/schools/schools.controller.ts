import {
  Controller,
  Post,
  Patch,
  Body,
  Param,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SchoolsService } from './schools.service';
import { CreateSchoolDto } from './dto/create-school.dto';
import { UpdateSchoolDto } from './dto/update-school.dto';

@Controller('schools')
@UseGuards(JwtAuthGuard)
export class SchoolsController {
  constructor(private schools: SchoolsService) {}

  @Post()
  create(@Req() req: any, @Body() dto: CreateSchoolDto) {
    return this.schools.create(req.user.id, dto);
  }

  @Patch(':id')
  update(
    @Req() req: any,
    @Param('id') schoolId: string,
    @Body() dto: UpdateSchoolDto,
  ) {
    return this.schools.update(req.user.id, schoolId, dto);
  }

  @Post(':id/invite-codes/:roleKey/regenerate')
  @HttpCode(HttpStatus.OK)
  regenerateCode(
    @Req() req: any,
    @Param('id') schoolId: string,
    @Param('roleKey') roleKey: string,
  ) {
    return this.schools.regenerateCode(req.user.id, schoolId, roleKey);
  }
}
