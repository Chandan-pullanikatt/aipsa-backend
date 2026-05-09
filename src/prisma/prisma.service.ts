import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const connectionString = process.env.DATABASE_URL;
    const pool = new Pool({ 
      connectionString,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,       // Keep connections warm for 30s
      max: 5,                          // Limit max connections (Neon free tier)
      min: 1,                          // Keep at least 1 connection warm
      keepAlive: true,                 // Prevent Neon from closing idle connections
      keepAliveInitialDelayMillis: 10000,
    });
    const adapter = new PrismaPg(pool);
    super({ adapter } as any);
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
