import { Injectable, ServiceUnavailableException } from '@nestjs/common';

export interface Departure {
  trip_id: string;
  route_id: string;
  headsign: string;
  stop_id: string;
  aimed: number;
  expected: number;
  theoretical: boolean;
}

export interface VehicleState {
  id: string;
  route_id: string;
  lat: number;
  lon: number;
  bearing: number;
  speed: number;
  delay: number;
  at_stop: boolean;
  theoretical: boolean;
  next_stop_id: string;
  headsign: string;
}

/** Client HTTP du service temps réel (réseau interne, ADR 0013). */
@Injectable()
export class RealtimeClient {
  private get base(): string {
    return process.env.REALTIME_URL ?? 'http://localhost:4100';
  }

  /** Renvoie null si la ressource n'existe pas (404). */
  async get<T>(path: string): Promise<T | null> {
    let res: Response;
    try {
      res = await fetch(this.base + path, { signal: AbortSignal.timeout(5000) });
    } catch {
      throw new ServiceUnavailableException('service temps réel indisponible');
    }
    if (res.status === 404) return null;
    if (!res.ok) throw new ServiceUnavailableException('service temps réel en erreur');
    return (await res.json()) as T;
  }
}
