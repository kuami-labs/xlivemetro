import { API_URL } from './config';

export type Mode = 'metro' | 'rer' | 'tram';

export interface Line {
  id: string;
  shortName: string;
  longName: string;
  mode: Mode;
  color: string;
  textColor: string;
}

export interface Station {
  id: string;
  name: string;
  lat: number;
  lon: number;
  lines: Line[];
}

export interface Departure {
  tripId: string;
  line: Line;
  headsign: string;
  aimed: string;
  expected: string;
  delaySeconds: number;
  theoretical: boolean;
}

export interface Disruption {
  id: string;
  channel: string;
  lines: Line[];
  text: string;
  validUntil: string | null;
}

export interface VehicleDetail {
  id: string;
  line: Line | null;
  headsign: string;
  position: { lat: number; lon: number; bearing: number; speed: number };
  delaySeconds: number;
  atStop: boolean;
  theoretical: boolean;
  nextStops: { station: string; stationId: string | null; aimed: string; expected: string }[];
}

export interface TripDetail {
  id: string;
  line: Line | null;
  headsign: string;
  theoretical: boolean;
  vehicle: {
    position: { lat: number; lon: number; bearing: number; speed: number };
    delaySeconds: number;
    atStop: boolean;
    nextStationId: string | null;
  } | null;
  calls: {
    station: string;
    stationId: string | null;
    aimed: string;
    expected: string;
    delaySeconds: number;
  }[];
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(API_URL + path);
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  return (await res.json()) as T;
}

export const api = {
  lines: () => get<Line[]>('/lines'),
  station: (id: string) => get<Station>(`/stations/${encodeURIComponent(id)}`),
  departures: (id: string) => get<Departure[]>(`/stations/${encodeURIComponent(id)}/departures`),
  search: (q: string) => get<Station[]>(`/stations/search?q=${encodeURIComponent(q)}`),
  trip: (id: string) => get<TripDetail>(`/trips/${encodeURIComponent(id)}`),
  disruptions: () => get<Disruption[]>('/disruptions'),
  vehicle: (id: string) => get<VehicleDetail>(`/vehicles/${encodeURIComponent(id)}`),
};
