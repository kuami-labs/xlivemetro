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

export interface JourneyLeg {
  walk: boolean;
  tripId: string | null;
  line: Line | null;
  headsign: string | null;
  from: { id: string | null; name: string };
  to: { id: string | null; name: string };
  departure: string;
  arrival: string;
  stops: number;
  theoretical: boolean;
  path: [number, number][];
}

export interface Journey {
  depart: string;
  arrive: string;
  durationMin: number;
  walkStartMin: number;
  walkEndMin: number;
  transfers: number;
  legs: JourneyLeg[];
}

/** Une gare avec un temps de marche (secondes) : seul ce qui part au serveur (PRD). */
export interface StationWalk {
  id: string;
  walkSec: number;
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
  journeys: (from: StationWalk[], to: StationWalk[]) => {
    const enc = (ps: StationWalk[]) => ps.map((p) => `${p.id}~${Math.round(p.walkSec)}`).join(',');
    return get<Journey[]>(
      `/journeys?from=${encodeURIComponent(enc(from))}&to=${encodeURIComponent(enc(to))}`,
    );
  },
  disruptions: () => get<Disruption[]>('/disruptions'),
  vehicle: (id: string) => get<VehicleDetail>(`/vehicles/${encodeURIComponent(id)}`),
};
