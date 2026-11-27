import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PrismaService } from './db/prisma.service.js';
import { HealthController } from './health/health.controller.js';
import { RealtimeClient } from './realtime/realtime.client.js';
import { ReferentialController } from './referential/referential.controller.js';
import { ReferentialRepository } from './referential/referential.repository.js';
import { ReferentialService } from './referential/referential.service.js';

@Module({
  imports: [
    // Limitation de débit par IP (docs/08-SECURITE.md) : API publique sans authentification
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
  ],
  controllers: [HealthController, ReferentialController],
  providers: [
    PrismaService,
    RealtimeClient,
    ReferentialRepository,
    ReferentialService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
