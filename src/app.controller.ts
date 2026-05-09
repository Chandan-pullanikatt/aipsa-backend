import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  healthCheck() {
    return { status: 'ok', message: 'AIPSA Backend is running' };
  }
}
