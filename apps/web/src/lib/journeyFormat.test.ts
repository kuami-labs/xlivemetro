import { describe, expect, it } from 'vitest';
import type { Journey, JourneyLeg } from './api';
import { firstRide, journeyBounds, journeySummary } from './journeyFormat';

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
  transfers,
  legs,
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
  });
});
