import { Controller, Get, Header, Param, Query } from '@nestjs/common';
import { gtfsId, optionalMode, searchQuery, tripKey } from '../common/validation.js';
import { ReferentialService } from './referential.service.js';

const CACHE_LONG = 'public, max-age=3600';
const CACHE_SHORT = 'public, max-age=15';

@Controller()
export class ReferentialController {
  constructor(private readonly service: ReferentialService) {}

  @Get('lines')
  @Header('Cache-Control', CACHE_LONG)
  lines(@Query('mode') mode?: string) {
    return this.service.lines(optionalMode(mode));
  }

  @Get('lines.geojson')
  @Header('Cache-Control', CACHE_LONG)
  @Header('Content-Type', 'application/geo+json')
  linesGeoJson(@Query('mode') mode?: string) {
    return this.service.linesGeoJson(optionalMode(mode));
  }

  @Get('lines/:id')
  @Header('Cache-Control', CACHE_LONG)
  line(@Param('id') id: string) {
    return this.service.line(gtfsId(id));
  }

  @Get('stations.geojson')
  @Header('Cache-Control', CACHE_LONG)
  @Header('Content-Type', 'application/geo+json')
  stationsGeoJson() {
    return this.service.stationsGeoJson();
  }

  @Get('stations/search')
  search(@Query('q') q?: string) {
    return this.service.search(searchQuery(q));
  }

  @Get('stations/:id')
  @Header('Cache-Control', CACHE_LONG)
  station(@Param('id') id: string) {
    return this.service.station(gtfsId(id));
  }

  @Get('stations/:id/departures')
  @Header('Cache-Control', CACHE_SHORT)
  departures(@Param('id') id: string) {
    return this.service.departures(gtfsId(id));
  }

  @Get('disruptions')
  @Header('Cache-Control', 'public, max-age=30')
  disruptions(@Query('line') line?: string) {
    return this.service.disruptions(line ? gtfsId(line) : undefined);
  }

  @Get('vehicles/:id')
  @Header('Cache-Control', 'no-store')
  vehicle(@Param('id') id: string) {
    return this.service.vehicle(tripKey(id));
  }
}
