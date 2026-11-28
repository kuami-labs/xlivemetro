import { Injectable } from '@nestjs/common';
import { TtlCache } from '../common/cache.js';
import { GeocodeClient, type GeoFeature } from './geocode.client.js';

/** Départements d'Île-de-France (deux premiers chiffres du code INSEE de la commune). */
const IDF = new Set(['75', '77', '78', '91', '92', '93', '94', '95']);
const MAX_RESULTS = 5;

export interface Place {
  label: string;
  lat: number;
  lon: number;
}

/** Adresses d'Île-de-France correspondant à un texte (F17). Rien n'est journalisé. */
@Injectable()
export class GeocodeService {
  // Mêmes adresses tapées par plusieurs visiteurs : on ménage le service de l'État
  private readonly cache = new TtlCache<Place[]>(24 * 3_600_000, 2000);

  constructor(private readonly client: GeocodeClient) {}

  search(q: string): Promise<Place[]> {
    const key = q.toLocaleLowerCase('fr-FR').replace(/\s+/g, ' ');
    return this.cache.get(key, async () => toPlaces(await this.client.search(q)));
  }
}

export function toPlaces(features: GeoFeature[]): Place[] {
  const out: Place[] = [];
  for (const f of features) {
    const c = f.geometry?.coordinates;
    const label = f.properties?.label;
    const city = f.properties?.citycode;
    if (!Array.isArray(c) || typeof c[0] !== 'number' || typeof c[1] !== 'number') continue;
    if (typeof label !== 'string' || typeof city !== 'string') continue;
    if (!IDF.has(city.slice(0, 2))) continue;
    out.push({ label: label.slice(0, 200), lon: c[0], lat: c[1] });
    if (out.length === MAX_RESULTS) break;
  }
  return out;
}
