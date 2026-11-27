import { Controller, Get, Header } from '@nestjs/common';
import { ReferentialService } from '../referential/referential.service.js';

@Controller('health')
export class HealthController {
  constructor(private readonly referential: ReferentialService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  async check() {
    const deps = await this.referential.ping();
    return { status: deps.db === 'ok' ? 'ok' : 'error', ...deps };
  }
}
