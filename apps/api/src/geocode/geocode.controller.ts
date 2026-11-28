import { Controller, Get, Header, Query } from '@nestjs/common';
import { addressQuery } from '../common/validation.js';
import { GeocodeService } from './geocode.service.js';

@Controller()
export class GeocodeController {
  constructor(private readonly service: GeocodeService) {}

  /** Adresses d'Île-de-France : ?q=20 avenue de Ségur (F17, ADR 0020) */
  @Get('geocode')
  // Une adresse tapée n'a rien à faire dans un cache partagé
  @Header('Cache-Control', 'private, no-store')
  search(@Query('q') q?: string) {
    return this.service.search(addressQuery(q));
  }
}
