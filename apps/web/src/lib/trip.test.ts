import { describe, expect, it } from 'vitest';
import { loadTrip, reminderText, saveTrip, tripPhase, type TripCall } from './trip';

const NOW = Date.parse('2026-12-01T08:00:00Z');
const calls: TripCall[] = [
  { stationId: 'A', station: 'Auber', expected: '2026-12-01T08:02:00Z' },
  { stationId: 'B', station: 'Châtelet', expected: '2026-12-01T08:04:00Z' },
  { stationId: 'C', station: 'Nation', expected: '2026-12-01T08:10:00Z' },
];

describe('tripPhase', () => {
  it('compte les arrêts et les minutes jusqu’à la descente', () => {
    expect(tripPhase(calls, 'C', NOW, true)).toEqual({
      phase: 'en-route',
      stopsLeft: 3,
      minutesLeft: 10,
      arrival: '2026-12-01T08:10:00Z',
    });
  });

  it('déclenche le rappel quand la descente est le prochain arrêt', () => {
    expect(tripPhase(calls.slice(2), 'C', NOW, true)).toMatchObject({
      phase: 'prochain-arret',
      minutesLeft: 10,
    });
  });

  it('conclut à l’arrivée seulement si la destination a été vue', () => {
    expect(tripPhase([], 'C', NOW, true)).toEqual({ phase: 'arrive' });
    expect(tripPhase(calls, 'Z', NOW, false)).toEqual({ phase: 'sans-destination' });
    expect(tripPhase(calls, null, NOW, true)).toEqual({ phase: 'sans-destination' });
  });

  it('ne donne jamais de minutes négatives', () => {
    expect(tripPhase(calls, 'A', Date.parse('2026-12-01T08:05:00Z'), true)).toMatchObject({
      minutesLeft: 0,
    });
  });
});

describe('rappels', () => {
  it('formule le rappel et l’arrivée', () => {
    expect(
      reminderText({ phase: 'prochain-arret', minutesLeft: 2, arrival: '' }, 'Nation'),
    ).toContain('Prochain arrêt : Nation');
    expect(reminderText({ phase: 'arrive' }, 'Nation')).toBe('Vous êtes arrivé à Nation.');
    expect(reminderText({ phase: 'sans-destination' }, 'Nation')).toBeNull();
  });
});

describe('trajet enregistré', () => {
  function memory() {
    const m = new Map<string, string>();
    return {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => void m.set(k, v),
      removeItem: (k: string) => void m.delete(k),
    };
  }
  it('enregistre, relit et efface', () => {
    const s = memory();
    saveTrip({ tripId: 'IDFM:T1@20261201', destinationId: 'C' }, s);
    expect(loadTrip(s)).toEqual({ tripId: 'IDFM:T1@20261201', destinationId: 'C' });
    saveTrip(null, s);
    expect(loadTrip(s)).toBeNull();
    s.setItem('xlivemetro:trajet', '{"tripId":3}');
    expect(loadTrip(s)).toBeNull();
    s.setItem('xlivemetro:trajet', 'pas du json');
    expect(loadTrip(s)).toBeNull();
  });
});
