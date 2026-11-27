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
    return [...lines.values()].filter((l) => !mode || l.mode === mode);
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
