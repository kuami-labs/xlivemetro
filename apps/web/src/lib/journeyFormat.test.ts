import { describe, expect, it } from 'vitest';
import type { Journey, JourneyLeg } from './api';
import {
  extraMinutes,
  fareLabel,
  firstRide,
  journeyBounds,
  journeySummary,
  journeyTags,
} from './journeyFormat';

const leg = (
  walk: boolean,
  path: [number, number][],
  tripId: string | null = null,
): JourneyLeg => ({
  walk,
  tripId,
  line: null,
  headsign: null,
  from: { id: 'a', name: 'A' },
  to: { id: 'b', name: 'B' },
  departure: '2026-12-01T08:00:00Z',
  arrival: '2026-12-01T08:10:00Z',
  stops: 3,
  theoretical: false,
  path,
});

const j = (legs: JourneyLeg[], transfers: number): Journey => ({
  depart: '2026-12-01T08:00:00Z',
  arrive: '2026-12-01T08:27:00Z',
  durationMin: 27,
  walkStartMin: 4,
  walkEndMin: 0,
  walkMin: 4,
  fare: { amount: 2.55, currency: 'EUR', tickets: ['Métro-Train-RER'] },
  transfers,
  legs,
});

const opt = (arrive: string, transfers: number, walkMin: number, fare: number): Journey => ({
  ...j([], transfers),
  arrive,
  durationMin: Math.round((Date.parse(arrive) - Date.parse('2026-12-01T08:00:00Z')) / 60_000),
  walkMin,
  fare: { amount: fare, currency: 'EUR', tickets: [] },
});

describe('journeyFormat', () => {
  it('résume un itinéraire', () => {
    expect(journeySummary(j([], 0))).toMatch(/27 min · direct$/);
    expect(journeySummary(j([], 1))).toMatch(/1 correspondance$/);
    expect(journeySummary(j([], 2))).toMatch(/2 correspondances$/);
  });

  it('trouve le premier train et l’emprise', () => {
    const legs = [
      leg(true, [[2.3, 48.8]]),
      leg(
        false,
        [
          [2.31, 48.81],
          [2.4, 48.9],
        ],
        'T1@20261201',
      ),
    ];
    expect(firstRide(j(legs, 0))?.tripId).toBe('T1@20261201');
    expect(firstRide(j([leg(true, [])], 0))).toBeNull();
    expect(journeyBounds(j(legs, 0))).toEqual([2.3, 48.8, 2.4, 48.9]);
    expect(journeyBounds(j([], 0))).toBeNull();
    // Adresse d'arrivée hors du tracé : incluse dans le cadrage
    expect(journeyBounds(j(legs, 0), [[2.45, 48.95]])).toEqual([2.3, 48.8, 2.45, 48.95]);
  });

  it('étiquette les options entre elles', () => {
    const js = [
      opt('2026-12-01T08:20:00Z', 2, 6, 2.55),
      opt('2026-12-01T08:25:00Z', 0, 6, 2.55),
      opt('2026-12-01T08:40:00Z', 1, 2, 4.6),
    ];
    expect(journeyTags(js)).toEqual([
      ['fastest', 'cheapest'],
      ['fewestTransfers'],
      ['leastWalk', 'longest'],
    ]);
    // Égalité : le label va à la première option (ici la plus rapide, aussi sans marche)
    expect(
      journeyTags([
        opt('2026-12-01T08:15:00Z', 0, 0, 2.55),
        opt('2026-12-01T08:30:00Z', 0, 0, 2.55),
        opt('2026-12-01T08:35:00Z', 1, 9, 2.55),
      ]),
    ).toEqual([['fastest', 'fewestTransfers', 'leastWalk'], [], ['longest']]);
    // « Le moins cher » seulement si les prix diffèrent
    expect(journeyTags([opt('2026-12-01T08:20:00Z', 0, 0, 4.6), js[1]])[1]).toContain('cheapest');
    expect(journeyTags([js[0], js[1]]).flat()).not.toContain('cheapest');
    // Une seule option : seulement « le plus rapide »
    expect(journeyTags([js[0]])).toEqual([['fastest']]);
    expect(extraMinutes(js[2], js)).toBe('+20 min');
    expect(extraMinutes(js[0], js)).toBe('');
    expect(fareLabel(2.55)).toMatch(/^2,55\s€$/);
  });
});
