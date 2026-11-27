/** Suivi d'un trajet à bord (F15) et rappel de descente (F16) : logique pure, testée. */

export interface TripCall {
  stationId: string | null;
  station: string;
  expected: string; // ISO 8601
}

export type TripPhase =
  | { phase: 'en-route'; stopsLeft: number; minutesLeft: number; arrival: string }
  | { phase: 'prochain-arret'; minutesLeft: number; arrival: string } // rappel F16
  | { phase: 'arrive' }
  | { phase: 'sans-destination' };

/**
 * Où en est le voyageur par rapport à sa gare de descente.
 * `calls` = arrêts restants (le premier est le prochain) ; `destinationSeen` dit si la
 * destination a déjà figuré dans les arrêts restants (sinon on ne conclut pas à l'arrivée).
 */
export function tripPhase(
  calls: TripCall[],
  destinationId: string | null,
  now: number,
  destinationSeen: boolean,
): TripPhase {
  if (!destinationId) return { phase: 'sans-destination' };
  const i = calls.findIndex((c) => c.stationId === destinationId);
  if (i === -1) return destinationSeen ? { phase: 'arrive' } : { phase: 'sans-destination' };
  const arrival = calls[i].expected;
  const minutesLeft = Math.max(0, Math.round((Date.parse(arrival) - now) / 60_000));
  if (i === 0) return { phase: 'prochain-arret', minutesLeft, arrival };
  return { phase: 'en-route', stopsLeft: i + 1, minutesLeft, arrival };
}

/** Message du rappel, ou null s'il n'y a rien à signaler (une seule fois par étape). */
export function reminderText(phase: TripPhase, station: string): string | null {
  if (phase.phase === 'prochain-arret')
    return `Prochain arrêt : ${station}. Préparez-vous à descendre.`;
  if (phase.phase === 'arrive') return `Vous êtes arrivé à ${station}.`;
  return null;
}

const KEY = 'xlivemetro:trajet';

export interface SavedTrip {
  tripId: string;
  destinationId: string | null;
}

/** Trajet en cours, gardé pour l'onglet (sessionStorage) : survit à un rechargement. */
export function loadTrip(storage: Pick<Storage, 'getItem'> = sessionStorage): SavedTrip | null {
  try {
    const v = JSON.parse(storage.getItem(KEY) ?? 'null') as unknown;
    if (
      v &&
      typeof v === 'object' &&
      typeof (v as SavedTrip).tripId === 'string' &&
      ((v as SavedTrip).destinationId === null ||
        typeof (v as SavedTrip).destinationId === 'string')
    ) {
      return v as SavedTrip;
    }
  } catch {
    // contenu illisible : ignoré
  }
  return null;
}

export function saveTrip(
  trip: SavedTrip | null,
  storage: Pick<Storage, 'setItem' | 'removeItem'> = sessionStorage,
) {
  if (trip) storage.setItem(KEY, JSON.stringify(trip));
  else storage.removeItem(KEY);
}
