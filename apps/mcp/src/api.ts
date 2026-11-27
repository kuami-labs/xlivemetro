/** Client de l'API publique de XLiveMetro (seule source du MCP, ADR 0006). */

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

export interface LineDetail extends Line {
  stations: Station[];
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

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export type Fetch = typeof fetch;

export class XLiveMetroApi {
  constructor(
    private readonly baseUrl: string,
    private readonly fetchFn: Fetch = fetch,
  ) {}

  private async get<T>(path: string): Promise<T> {
    let res: Response;
    try {
      res = await this.fetchFn(this.baseUrl.replace(/\/$/, '') + path, {
        signal: AbortSignal.timeout(10_000),
        headers: { accept: 'application/json' },
      });
    } catch {
      throw new ApiError(0, `API XLiveMetro injoignable (${this.baseUrl})`);
    }
    if (!res.ok) throw new ApiError(res.status, `API XLiveMetro : statut ${res.status}`);
    return (await res.json()) as T;
  }

  lines() {
    return this.get<Line[]>('/lines');
  }
  line(id: string) {
    return this.get<LineDetail>(`/lines/${encodeURIComponent(id)}`);
  }
  search(q: string) {
    return this.get<Station[]>(`/stations/search?q=${encodeURIComponent(q)}`);
  }
  station(id: string) {
    return this.get<Station>(`/stations/${encodeURIComponent(id)}`);
  }
  departures(id: string) {
    return this.get<Departure[]>(`/stations/${encodeURIComponent(id)}/departures`);
  }
  disruptions() {
    return this.get<Disruption[]>('/disruptions');
  }
}
