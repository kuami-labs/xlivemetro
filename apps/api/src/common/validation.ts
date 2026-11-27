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

export const MODES = ['metro', 'rer', 'tram'] as const;
export type Mode = (typeof MODES)[number];

export function optionalMode(value: unknown): Mode | undefined {
  if (value === undefined || value === '') return undefined;
  if (typeof value === 'string' && (MODES as readonly string[]).includes(value)) {
    return value as Mode;
  }
  throw new BadRequestException('mode invalide');
}
