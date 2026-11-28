import { BadRequestException } from '@nestjs/common';

/** Identifiants GTFS d'IDFM : « IDFM:C01742 », « IDFM:463158 ». */
const GTFS_ID = /^IDFM:[A-Za-z0-9_-]{1,40}$/;
/** Course datée : « trip_id@AAAAMMJJ ». */
const TRIP_KEY = /^IDFM:[A-Za-z0-9_:.-]{1,120}@\d{8}$/;

export function gtfsId(value: string): string {
  if (!GTFS_ID.test(value)) throw new BadRequestException('identifiant invalide');
  return value;
}

export function tripKey(value: string): string {
  if (!TRIP_KEY.test(value)) throw new BadRequestException('identifiant de course invalide');
  return value;
}

export function searchQuery(value: unknown): string {
  const q = typeof value === 'string' ? value.trim() : '';
  if (q.length < 2 || q.length > 64) {
    throw new BadRequestException('la recherche doit faire entre 2 et 64 caractères');
  }
  return q;
}

/** Adresse saisie (F17) : 3 à 120 caractères, sans caractères de contrôle. */
export function addressQuery(value: unknown): string {
  const q = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  // eslint-disable-next-line no-control-regex
  if (q.length < 3 || q.length > 120 || /[\u0000-\u001f\u007f]/.test(q)) {
    throw new BadRequestException('l’adresse doit faire entre 3 et 120 caractères');
  }
  return q;
}

export const MODES = ['metro', 'rer', 'tram'] as const;
export type Mode = (typeof MODES)[number];

export function optionalMode(value: unknown): Mode | undefined {
  if (value === undefined || value === '') return undefined;
  if (typeof value === 'string' && (MODES as readonly string[]).includes(value)) {
    return value as Mode;
  }
  throw new BadRequestException('mode invalide');
}

/** Gares de départ ou d'arrivée avec un temps de marche : « IDFM:71673~240,IDFM:… » (5 au plus). */
export function stationPoints(value: unknown): { id: string; walkSec: number }[] {
  if (typeof value !== 'string' || value.length === 0 || value.length > 400) {
    throw new BadRequestException('liste de gares invalide');
  }
  const parts = value.split(',');
  if (parts.length > 5) throw new BadRequestException('5 gares au plus');
  return parts.map((p) => {
    const [id, sec = '0'] = p.split('~');
    const walkSec = Number(sec);
    if (!GTFS_ID.test(id) || !Number.isInteger(walkSec) || walkSec < 0 || walkSec > 3600) {
      throw new BadRequestException('gare ou temps de marche invalide');
    }
    return { id, walkSec };
  });
}
