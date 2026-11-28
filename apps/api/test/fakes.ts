import type { Departure, VehicleState } from '../src/realtime/realtime.client.js';
import type { Line, LineShape, Station } from '../src/referential/referential.repository.js';

export const M1: Line = {
  id: 'IDFM:C01371',
  shortName: '1',
  longName: 'Métro 1',
  mode: 'metro',
  color: 'FFBE00',
  textColor: '000000',
};
export const RERA: Line = {
  ...M1,
  id: 'IDFM:C01742',
  shortName: 'A',
  mode: 'rer',
  color: 'FF1400',
};

export const CDG: Station = {
  id: 'IDFM:71379',
  name: 'Charles de Gaulle - Étoile',
  lat: 48.874,
  lon: 2.295,
  quayIds: ['IDFM:1', 'IDFM:2'],
  lineIds: ['IDFM:C01742', 'IDFM:C01371'],
};
export const DEFENSE: Station = {
  ...CDG,
  id: 'IDFM:71517',
  name: 'La Défense',
  lat: 48.892,
  lon: 2.238,
  quayIds: ['IDFM:3'],
};

export class FakeRepository {
  // Ordre volontairement mélangé : l'API doit trier
  lines = () => Promise.resolve([RERA, M1]);
  stations = () => Promise.resolve([CDG, DEFENSE]);
  lineShapes = (): Promise<LineShape[]> =>
    Promise.resolve([{ id: M1.id, geometry: { type: 'MultiLineString', coordinates: [] } }]);
  searchStationIds = () => Promise.resolve([{ id: CDG.id }, { id: 'IDFM:inconnue' }]);
  lineStationIds = () => Promise.resolve([{ id: DEFENSE.id }, { id: CDG.id }, { id: CDG.id }]);
  ping = () => Promise.resolve();
}

export const DEPARTURE: Departure = {
  trip_id: 'IDFM:T1@20261201',
  route_id: M1.id,
  headsign: 'Château de Vincennes',
  stop_id: 'IDFM:1',
  aimed: 1_796_626_800,
  expected: 1_796_626_890,
  theoretical: false,
};

export const VEHICLE: VehicleState = {
  id: 'IDFM:T1@20261201',
  route_id: M1.id,
  lat: 48.87,
  lon: 2.3,
  bearing: 90,
  speed: 10,
  delay: 90,
  at_stop: false,
  theoretical: false,
  next_stop_id: 'IDFM:1',
  headsign: 'Château de Vincennes',
};

export class FakeRealtime {
  paths: string[] = [];
  get<T>(path: string): Promise<T | null> {
    this.paths.push(path);
    if (path.startsWith('/departures')) return Promise.resolve([DEPARTURE] as T);
    if (path.startsWith('/vehicles/IDFM%3AT1')) return Promise.resolve(VEHICLE as T);
    if (path.startsWith('/trips/IDFM%3AT1') || path.startsWith('/trips/IDFM%3AT3'))
      return Promise.resolve([DEPARTURE] as T);
    if (path === '/health') return Promise.resolve({ status: 'ok' } as T);
    if (path.startsWith('/journeys'))
      return Promise.resolve([
        {
          depart: 1_796_626_800,
          arrive: 1_796_628_000,
          walk_start: 240,
          walk_end: 0,
          transfers: 0,
          legs: [
            {
              walk: false,
              trip_id: 'IDFM:T1@20261201',
              route_id: M1.id,
              headsign: 'La Défense',
              from_stop_id: 'IDFM:1',
              to_stop_id: 'IDFM:3',
              dep: 1_796_627_040,
              arr: 1_796_628_000,
              stops: 4,
              path: ['IDFM:1', 'IDFM:2', 'IDFM:3'],
            },
          ],
        },
      ] as T);
    if (path.startsWith('/disruptions'))
      return Promise.resolve([
        { id: 'm1', channel: 'Perturbation', line_ids: [RERA.id], text: 'Trafic <b>perturbé</b>' },
      ] as T);
    return Promise.resolve(null);
  }
}

export class FakeGeocoder {
  queries: string[] = [];
  search(q: string) {
    this.queries.push(q);
    return Promise.resolve([
      {
        geometry: { type: 'Point', coordinates: [2.3086, 48.8507] },
        properties: { label: '20 Avenue de Ségur 75007 Paris', citycode: '75107' },
      },
      {
        geometry: { type: 'Point', coordinates: [4.83, 45.76] },
        properties: { label: 'Avenue de Ségur 69000 Lyon', citycode: '69123' },
      },
    ]);
  }
}
