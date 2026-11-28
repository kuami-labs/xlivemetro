import { Injectable, ServiceUnavailableException } from '@nestjs/common';

/** Réponse GeoJSON du service de géocodage de la Géoplateforme (IGN). */
export interface GeoFeature {
  geometry?: { type?: string; coordinates?: unknown };
  properties?: { label?: unknown; citycode?: unknown; type?: unknown };
}

/**
 * Client du géocodage de l'État : API Adresse de la Base Adresse Nationale, opérée par
 * l'IGN sur la Géoplateforme (ADR 0020). Le texte saisi est envoyé par notre serveur :
 * l'adresse IP du visiteur ne quitte pas notre infrastructure.
 */
@Injectable()
export class GeocodeClient {
  private get base(): string {
    return process.env.GEOCODER_URL ?? 'https://data.geopf.fr/geocodage';
  }

  async search(q: string): Promise<GeoFeature[]> {
    const qs = new URLSearchParams({
      q,
      index: 'address',
      limit: '10',
      // Résultats proches de Paris d'abord ; le filtrage Île-de-France se fait ensuite
      lat: '48.8566',
      lon: '2.3522',
    });
    let res: Response;
    try {
      res = await fetch(`${this.base}/search?${qs}`, { signal: AbortSignal.timeout(4000) });
    } catch {
      throw new ServiceUnavailableException('géocodage indisponible');
    }
    if (!res.ok) throw new ServiceUnavailableException('géocodage en erreur');
    const body = (await res.json()) as { features?: unknown };
    return Array.isArray(body.features) ? (body.features as GeoFeature[]) : [];
  }
}
