import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'stdout', level: 'info' },
        { emit: 'stdout', level: 'warn' },
        { emit: 'stdout', level: 'error' },
      ],
    });
  }

  async onModuleInit() {
    await this.$connect();
    // @ts-ignore
    this.$on('query', (e: any) => {
      this.logger.log(`Prisma Query: ${e.query} - Params: ${e.params} - Duration: ${e.duration}ms`);
    });
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
