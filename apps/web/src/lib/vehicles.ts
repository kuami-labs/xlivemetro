import type { ServerMessage, Vehicle } from '@xlivemetro/proto';

/** Drapeaux d'un train dans `VehicleFrame.flags`. */
export const AT_STOP = 1;
export const THEORETICAL = 2;

/**
 * État des trains au format colonnes (typed arrays) : transférable depuis le Web Worker
 * et lisible directement par deck.gl, sans objet par train.
 */
export interface VehicleFrame {
  ids: string[];
  routeIds: string[];
  headsigns: string[];
  /** lon, lat de chaque train à `receivedAt`. */
  positions: Float32Array;
  bearings: Float32Array;
  speeds: Float32Array;
  delays: Int16Array;
  flags: Uint8Array;
  /** Horodatage (ms) de réception, base de l'interpolation. */
  receivedAt: number;
  /** Horodatage (ms) des données temps réel, 0 si aucune. */
  dataTime: number;
  /** Horloge du serveur (ms) au dernier message : l'âge des données = serverTime − dataTime. */
  serverTime: number;
  source: string;
}

/** Applique un instantané ou un delta à l'état courant (dans le Web Worker). */
export function applyMessage(
  state: Map<string, Vehicle>,
  msg: ServerMessage,
): Map<string, Vehicle> {
  switch (msg.msg.case) {
    case 'snapshot':
      state.clear();
      for (const v of msg.msg.value.vehicles) state.set(v.id, v);
      break;
    case 'delta':
      for (const v of msg.msg.value.upserts) state.set(v.id, v);
      for (const id of msg.msg.value.removed) state.delete(id);
      break;
  }
  return state;
}

export function toFrame(
  state: Map<string, Vehicle>,
  receivedAt: number,
  dataTime: number,
  source: string,
  serverTime = 0,
): VehicleFrame {
  const n = state.size;
  const f: VehicleFrame = {
    ids: new Array<string>(n),
    routeIds: new Array<string>(n),
    headsigns: new Array<string>(n),
    positions: new Float32Array(n * 2),
    bearings: new Float32Array(n),
    speeds: new Float32Array(n),
    delays: new Int16Array(n),
    flags: new Uint8Array(n),
    receivedAt,
    dataTime,
    serverTime,
    source,
  };
  let i = 0;
  for (const v of state.values()) {
    f.ids[i] = v.id;
    f.routeIds[i] = v.routeId;
    f.headsigns[i] = v.headsign;
    f.positions[i * 2] = v.lon;
    f.positions[i * 2 + 1] = v.lat;
    f.bearings[i] = v.bearing;
    f.speeds[i] = v.atStop ? 0 : v.speed;
    f.delays[i] = Math.max(-32768, Math.min(32767, v.delay));
    f.flags[i] = (v.atStop ? AT_STOP : 0) | (v.theoretical ? THEORETICAL : 0);
    i++;
  }
  return f;
}

const METERS_PER_DEGREE = 111_320;
/** Au-delà, on n'extrapole plus : le prochain message (toutes les 5 s) va arriver. */
export const MAX_EXTRAPOLATION_S = 8;

/**
 * Avance chaque train le long de son cap, à sa vitesse, depuis `receivedAt`
 * (approximation rectiligne sur quelques secondes, ADR 0013).
 */
export function interpolate(frame: VehicleFrame, now: number, out: Float32Array): Float32Array {
  const dt = Math.min(Math.max((now - frame.receivedAt) / 1000, 0), MAX_EXTRAPOLATION_S);
  const n = frame.ids.length;
  for (let i = 0; i < n; i++) {
    const lon = frame.positions[i * 2];
    const lat = frame.positions[i * 2 + 1];
    const d = frame.speeds[i] * dt;
    const b = (frame.bearings[i] * Math.PI) / 180;
    out[i * 2] = lon + (d * Math.sin(b)) / (METERS_PER_DEGREE * Math.cos((lat * Math.PI) / 180));
    out[i * 2 + 1] = lat + (d * Math.cos(b)) / METERS_PER_DEGREE;
  }
  return out;
}
