import { describe, expect, it } from 'vitest';
import {
  distanceM,
  geolocationMessage,
  nearbyStations,
  walkMinutes,
  type StationPoint,
} from './nearby';

// Près de Châtelet - Les Halles
const ME = { lat: 48.8619, lon: 2.3468 };
const st = (id: string, lat: number, lon: number): StationPoint => ({
  id,
  name: id,
  lat,
  lon,
  lines: [],
});

describe('gares proches', () => {
  it('calcule les distances en mètres', () => {
    // 0,01° de latitude ≈ 1 112 m
    expect(distanceM(48.86, 2.35, 48.87, 2.35)).toBeCloseTo(1112, -1);
    expect(distanceM(48.86, 2.35, 48.86, 2.35)).toBe(0);
  });

  it('estime le temps de marche avec le détour des rues', () => {
    expect(walkMinutes(0)).toBe(1);
    expect(walkMinutes(500)).toBe(8); // 650 m à 83,3 m/min
    expect(walkMinutes(1500)).toBe(24);
  });

  it('garde les 5 plus proches à moins de 1,5 km, triées', () => {
    const stations = [
      st('loin', 48.9, 2.35), // ~4 km
      st('c', ME.lat + 0.008, ME.lon), // ~890 m
      st('a', ME.lat + 0.001, ME.lon), // ~110 m
      st('b', ME.lat, ME.lon + 0.006), // ~440 m
      st('d', ME.lat - 0.009, ME.lon), // ~1 000 m
      st('e', ME.lat, ME.lon - 0.015), // ~1 100 m
      st('f', ME.lat - 0.011, ME.lon), // ~1 220 m
    ];
    const r = nearbyStations(stations, ME.lat, ME.lon);
    expect(r.map((s) => s.id)).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(r[0].distanceM).toBeCloseTo(111, -1);
    expect(r[0].walkMin).toBe(2);
    expect(nearbyStations([st('loin', 48.9, 2.35)], ME.lat, ME.lon)).toEqual([]);
  });

  it('explique les erreurs de géolocalisation', () => {
    expect(geolocationMessage(1)).toContain('refusée');
    expect(geolocationMessage(3)).toContain('trop de temps');
    expect(geolocationMessage(42)).toContain('impossible');
  });
});
