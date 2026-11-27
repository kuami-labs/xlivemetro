import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { createPrismaClient, type PrismaClient } from '@xlivemetro/db';

/** Accès à PostgreSQL. Le client est créé à la première utilisation (DATABASE_URL requis). */
@Injectable()
export class PrismaService implements OnModuleDestroy {
  private instance?: PrismaClient;

  get client(): PrismaClient {
    this.instance ??= createPrismaClient();
    return this.instance;
  }

  async onModuleDestroy(): Promise<void> {
    await this.instance?.$disconnect();
  }
}
