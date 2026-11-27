import { Injectable, NotFoundException } from '@nestjs/common';
import { TtlCache } from '../common/cache.js';
import type { Mode } from '../common/validation.js';
import { RealtimeClient, type Departure, type VehicleState } from '../realtime/realtime.client.js';
import { ReferentialRepository, type Line, type Station } from './referential.repository.js';

const HOUR = 3_600_000;

export interface StationView {
  id: string;
  name: string;
  lat: number;
  lon: number;
  lines: Line[];
}

export interface DisruptionView {
  id: string;
  channel: string;
  lines: Line[];
  /** Texte brut d'IDFM : à afficher comme texte, jamais comme HTML (docs/08-SECURITE.md). */
  text: string;
  validUntil: string | null;
}

interface RealtimeJourney {
  depart: number;
  arrive: number;
  walk_start: number;
  walk_end: number;
  transfers: number;
  legs: {
    walk: boolean;
    trip_id?: string;
    route_id?: string;
    headsign?: string;
    from_stop_id: string;
    to_stop_id: string;
    dep: number;
    arr: number;
    stops?: number;
    theoretical?: boolean;
  }[];
}

interface RealtimeDisruption {
  id: string;
  channel: string;
  line_ids: string[];
  text: string;
  valid_until?: string;
}

export interface DepartureView {
  tripId: string;
  line: Line;
  headsign: string;
  /** Horaires ISO 8601 ; `delaySeconds` = estimé − théorique. */
  aimed: string;
  expected: string;
  delaySeconds: number;
  theoretical: boolean;
}

/**
 * Référentiel en mémoire (rechargé toutes les heures) et appels au service temps réel.
 * Le référentiel ne change qu'à l'import GTFS quotidien.
 */
@Injectable()
export class ReferentialService {
  private readonly ref = new TtlCache<{
    lines: Map<string, Line>;
    stations: Map<string, Station>;
    byQuay: Map<string, Station>;
  }>(HOUR, 1);
  private readonly shapes = new TtlCache<unknown>(HOUR, 4);
  private readonly departuresCache = new TtlCache<DepartureView[]>(15_000, 2000);
  private readonly disruptionsCache = new TtlCache<DisruptionView[]>(30_000, 100);

  constructor(
    private readonly repo: ReferentialRepository,
    private readonly realtime: RealtimeClient,
  ) {}

  private load() {
    return this.ref.get('ref', async () => {
      const [lines, stations] = await Promise.all([this.repo.lines(), this.repo.stations()]);
      const byQuay = new Map<string, Station>();
      for (const s of stations) for (const q of s.quayIds) byQuay.set(q, s);
      return {
        lines: new Map(lines.map((l) => [l.id, l])),
        stations: new Map(stations.map((s) => [s.id, s])),
        byQuay,
      };
    });
  }

  private view(s: Station, lines: Map<string, Line>): StationView {
    return {
      id: s.id,
      name: s.name,
      lat: s.lat,
      lon: s.lon,
      lines: s.lineIds.flatMap((id) => lines.get(id) ?? []).sort(byLine),
    };
  }

  async lines(mode?: Mode): Promise<Line[]> {
    const { lines } = await this.load();
    // Ordre naturel : métro 1, 2… 14, puis RER A…E, puis tram T1…T14
    return [...lines.values()].filter((l) => !mode || l.mode === mode).sort(byLine);
  }

  async line(id: string) {
    const { lines, stations } = await this.load();
    const line = lines.get(id);
    if (!line) throw new NotFoundException('ligne inconnue');
    const ids = await this.repo.lineStationIds(id);
    const ordered = ids.flatMap(({ id: sid }, i) =>
      ids.findIndex((x) => x.id === sid) === i && stations.has(sid)
        ? [this.view(stations.get(sid)!, lines)]
        : [],
    );
    return { ...line, stations: ordered };
  }

  /** GeoJSON des tracés, pour la carte. */
  linesGeoJson(mode?: Mode) {
    return this.shapes.get(mode ?? 'all', async () => {
      const [{ lines }, shapes] = await Promise.all([this.load(), this.repo.lineShapes()]);
      return {
        type: 'FeatureCollection',
        features: shapes.flatMap((s) => {
          const l = lines.get(s.id);
          if (!l || (mode && l.mode !== mode)) return [];
          return [
            {
              type: 'Feature',
              id: l.id,
              geometry: s.geometry,
              properties: { id: l.id, shortName: l.shortName, mode: l.mode, color: `#${l.color}` },
            },
          ];
        }),
      };
    });
  }

  async stationsGeoJson() {
    const { stations, lines } = await this.load();
    return {
      type: 'FeatureCollection',
      features: [...stations.values()].map((s) => ({
        type: 'Feature',
        id: s.id,
        geometry: { type: 'Point', coordinates: [s.lon, s.lat] },
        properties: {
          id: s.id,
          name: s.name,
          lines: s.lineIds.flatMap((id) => lines.get(id)?.shortName ?? []),
        },
      })),
    };
  }

  async search(q: string): Promise<StationView[]> {
    const { stations, lines } = await this.load();
    const ids = await this.repo.searchStationIds(q, 20);
    return ids
      .flatMap(({ id }) => stations.get(id) ?? [])
      .slice(0, 10)
      .map((s) => this.view(s, lines));
  }

  async station(id: string): Promise<StationView> {
    const { stations, lines } = await this.load();
    const s = stations.get(id);
    if (!s) throw new NotFoundException('gare inconnue');
    return this.view(s, lines);
  }

  async departures(id: string, limit = 12): Promise<DepartureView[]> {
    const { stations, lines } = await this.load();
    const s = stations.get(id);
    if (!s) throw new NotFoundException('gare inconnue');
    return this.departuresCache.get(`${id}|${limit}`, async () => {
      const qs = new URLSearchParams({ stops: s.quayIds.join(','), limit: String(limit) });
      const ds = (await this.realtime.get<Departure[]>(`/departures?${qs}`)) ?? [];
      return ds.flatMap((d) => {
        const line = lines.get(d.route_id);
        return line ? [departureView(d, line)] : [];
      });
    });
  }

  async vehicle(key: string) {
    const enc = encodeURIComponent(key);
    const [v, calls] = await Promise.all([
      this.realtime.get<VehicleState>(`/vehicles/${enc}`),
      this.realtime.get<Departure[]>(`/trips/${enc}/calls`),
    ]);
    if (!v) throw new NotFoundException('train inconnu ou arrivé');
    const { lines, byQuay } = await this.load();
    return {
      id: v.id,
      line: lines.get(v.route_id) ?? null,
      headsign: v.headsign,
      position: { lat: v.lat, lon: v.lon, bearing: v.bearing, speed: v.speed },
      delaySeconds: v.delay,
      atStop: v.at_stop,
      theoretical: v.theoretical,
      nextStops: (calls ?? []).map((c) => ({
        station: byQuay.get(c.stop_id)?.name ?? c.stop_id,
        stationId: byQuay.get(c.stop_id)?.id ?? null,
        aimed: iso(c.aimed),
        expected: iso(c.expected),
      })),
    };
  }

  /**
   * Course suivie par un voyageur (F15) : arrêts restants, même avant le départ, et
   * position du train s'il roule. 404 si la course est inconnue ou terminée.
   */
  async trip(key: string) {
    const enc = encodeURIComponent(key);
    const [calls, v] = await Promise.all([
      this.realtime.get<Departure[]>(`/trips/${enc}/calls`),
      this.realtime.get<VehicleState>(`/vehicles/${enc}`),
    ]);
    if (!calls || calls.length === 0) throw new NotFoundException('course inconnue ou terminée');
    const { lines, byQuay } = await this.load();
    const first = calls[0];
    return {
      id: key,
      line: lines.get(first.route_id) ?? null,
      headsign: first.headsign,
      theoretical: first.theoretical,
      vehicle: v
        ? {
            position: { lat: v.lat, lon: v.lon, bearing: v.bearing, speed: v.speed },
            delaySeconds: v.delay,
            atStop: v.at_stop,
            nextStationId: byQuay.get(v.next_stop_id)?.id ?? null,
          }
        : null,
      calls: calls.map((c) => ({
        station: byQuay.get(c.stop_id)?.name ?? c.stop_id,
        stationId: byQuay.get(c.stop_id)?.id ?? null,
        aimed: iso(c.aimed),
        expected: iso(c.expected),
        delaySeconds: c.expected - c.aimed,
      })),
    };
  }

  /**
   * Itinéraires métro/RER/tram (F12, F13) entre des gares, chacune avec un temps de marche.
   * Seuls des identifiants de gares et des durées sont transmis (PRD, confidentialité).
   */
  async journeys(
    from: { id: string; walkSec: number }[],
    to: { id: string; walkSec: number }[],
    at?: number,
  ) {
    const { stations, lines, byQuay } = await this.load();
    const quays = (points: { id: string; walkSec: number }[]) =>
      points.flatMap((p) => {
        const s = stations.get(p.id);
        if (!s) throw new NotFoundException(`gare inconnue : ${p.id}`);
        return s.quayIds.map((q) => `${q}~${p.walkSec}`);
      });
    const qs = new URLSearchParams({ from: quays(from).join(','), to: quays(to).join(',') });
    if (at !== undefined) qs.set('at', String(at));
    const js = (await this.realtime.get<RealtimeJourney[]>(`/journeys?${qs}`)) ?? [];
    const station = (quay: string) => {
      const s = byQuay.get(quay);
      return { id: s?.id ?? null, name: s?.name ?? quay };
    };
    return js.map((j) => ({
      depart: iso(j.depart),
      arrive: iso(j.arrive),
      durationMin: Math.round((j.arrive - j.depart) / 60),
      walkStartMin: Math.round(j.walk_start / 60),
      walkEndMin: Math.round(j.walk_end / 60),
      transfers: j.transfers,
      legs: j.legs.map((l) => ({
        walk: l.walk,
        tripId: l.trip_id ?? null,
        line: l.route_id ? (lines.get(l.route_id) ?? null) : null,
        headsign: l.headsign ?? null,
        from: station(l.from_stop_id),
        to: station(l.to_stop_id),
        departure: iso(l.dep),
        arrival: iso(l.arr),
        stops: l.stops ?? 0,
        theoretical: l.theoretical ?? false,
      })),
    }));
  }

  /** Perturbations en cours (toutes, ou d'une ligne). */
  async disruptions(lineId?: string): Promise<DisruptionView[]> {
    const { lines } = await this.load();
    if (lineId && !lines.has(lineId)) throw new NotFoundException('ligne inconnue');
    return this.disruptionsCache.get(lineId ?? 'all', async () => {
      const qs = lineId ? `?${new URLSearchParams({ line: lineId })}` : '';
      const ds = (await this.realtime.get<RealtimeDisruption[]>(`/disruptions${qs}`)) ?? [];
      return ds.map((d) => ({
        id: d.id,
        channel: d.channel,
        lines: d.line_ids.flatMap((id) => lines.get(id) ?? []).sort(byLine),
        text: d.text,
        validUntil: d.valid_until ?? null,
      }));
    });
  }

  async ping(): Promise<{ db: 'ok' | 'error'; realtime: 'ok' | 'degraded' | 'error' }> {
    const db = await this.repo.ping().then(
      () => 'ok' as const,
      () => 'error' as const,
    );
    const rt = await this.realtime.get<{ status: string }>('/health').then(
      (h) => (h?.status === 'ok' ? ('ok' as const) : ('degraded' as const)),
      () => 'error' as const,
    );
    return { db, realtime: rt };
  }
}

function iso(unix: number): string {
  return new Date(unix * 1000).toISOString();
}

export function departureView(d: Departure, line: Line): DepartureView {
  return {
    tripId: d.trip_id,
    line,
    headsign: d.headsign,
    aimed: iso(d.aimed),
    expected: iso(d.expected),
    delaySeconds: d.expected - d.aimed,
    theoretical: d.theoretical,
  };
}

const MODE_ORDER: Record<Mode, number> = { metro: 0, rer: 1, tram: 2 };

function byLine(a: Line, b: Line): number {
  return (
    MODE_ORDER[a.mode] - MODE_ORDER[b.mode] ||
    a.shortName.localeCompare(b.shortName, 'fr', { numeric: true })
  );
}
