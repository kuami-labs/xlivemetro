import type { Mode } from '../common/validation.js';

/**
 * Prix estimé d'un itinéraire en tickets à l'unité, plein tarif (ADR 0019).
 *
 * Source : guide tarifaire d'Île-de-France Mobilités, « Tarifs applicables au
 * 1er janvier 2026 » (constaté le 2026-11-27). À mettre à jour à chaque changement de tarif.
 * - ticket Métro-Train-RER : métro, RER et train dans toute l'Île-de-France, hors aéroports ;
 * - ticket Bus-Tram : bus et tram, hors aéroports ; un second titre est nécessaire pour
 *   passer du métro/RER au tram ;
 * - ticket Paris Région <> Aéroports : Orly par le métro 14, Roissy-CDG par le RER B.
 */
export const FARES = {
  metroTrainRer: { label: 'Métro-Train-RER', amount: 2.55 },
  busTram: { label: 'Bus-Tram', amount: 2.05 },
  airport: { label: 'Paris Région <> Aéroports', amount: 14 },
} as const;

/** Gares des aéroports desservies par le métro 14 (Orly) et le RER B (Roissy-CDG). */
export const AIRPORT_STATIONS = new Set([
  'IDFM:63284', // Aéroport d'Orly (Terminaux 1-2-3), métro 14
  'IDFM:73596', // Aéroport CDG 1 (Terminal 3), RER B
  'IDFM:73699', // Aéroport CDG (Terminal 2) - TGV, RER B
]);

export interface FareLeg {
  mode: Mode;
  fromId: string | null;
  toId: string | null;
}

export interface Fare {
  amount: number;
  currency: 'EUR';
  tickets: string[];
}

export function estimateFare(legs: FareLeg[]): Fare {
  const rail = legs.filter((l) => l.mode !== 'tram');
  const airport = rail.some(
    (l) => AIRPORT_STATIONS.has(l.fromId ?? '') || AIRPORT_STATIONS.has(l.toId ?? ''),
  );
  const tickets: { label: string; amount: number }[] = [];
  if (rail.length > 0) tickets.push(airport ? FARES.airport : FARES.metroTrainRer);
  if (legs.some((l) => l.mode === 'tram')) tickets.push(FARES.busTram);
  const amount = Math.round(tickets.reduce((s, t) => s + t.amount, 0) * 100) / 100;
  return { amount, currency: 'EUR', tickets: tickets.map((t) => t.label) };
}
