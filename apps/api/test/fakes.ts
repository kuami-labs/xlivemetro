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
  quayIds: ['IDFM:3'],
};

export class FakeRepository {
  lines = () => Promise.resolve([M1, RERA]);
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
    if (path.startsWith('/trips/IDFM%3AT1')) return Promise.resolve([DEPARTURE] as T);
    if (path === '/health') return Promise.resolve({ status: 'ok' } as T);
    return Promise.resolve(null);
  }
}
