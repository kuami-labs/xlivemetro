import {
  create,
  DeltaSchema,
  ServerMessageSchema,
  SnapshotSchema,
  VehicleSchema,
  type Vehicle,
} from '@xlivemetro/proto';
import { describe, expect, it } from 'vitest';
import { AT_STOP, THEORETICAL, applyMessage, interpolate, toFrame } from './vehicles';

type Extra = {
  lon?: number;
  bearing?: number;
  speed?: number;
  delay?: number;
  atStop?: boolean;
  theoretical?: boolean;
};
const v = (id: string, extra: Extra = {}) =>
  create(VehicleSchema, { id, routeId: 'IDFM:C01371', lat: 48.86, lon: 2.35, ...extra });

describe('applyMessage', () => {
  it('remplace tout sur un instantané, puis applique les deltas', () => {
    const state = new Map<string, Vehicle>([['vieux', v('vieux')]]);
    applyMessage(
      state,
      create(ServerMessageSchema, {
        msg: { case: 'snapshot', value: create(SnapshotSchema, { vehicles: [v('a'), v('b')] }) },
      }),
    );
    expect([...state.keys()]).toEqual(['a', 'b']);
    applyMessage(
      state,
      create(ServerMessageSchema, {
        msg: {
          case: 'delta',
          value: create(DeltaSchema, { upserts: [v('c'), v('a', { lon: 2.4 })], removed: ['b'] }),
        },
      }),
    );
    expect([...state.keys()].sort()).toEqual(['a', 'c']);
    expect(state.get('a')?.lon).toBeCloseTo(2.4);
  });
});

describe('toFrame et interpolate', () => {
  const state = new Map([
    ['est', v('est', { bearing: 90, speed: 10, delay: 70000 })],
    ['quai', v('quai', { speed: 10, atStop: true, theoretical: true })],
  ]);
  const frame = toFrame(state, 1000, 900, 'synthetic');

  it('met les trains en colonnes', () => {
    expect(frame.ids).toEqual(['est', 'quai']);
    expect(frame.delays[0]).toBe(32767);
    expect(frame.flags[1]).toBe(AT_STOP | THEORETICAL);
    expect(frame.speeds[1]).toBe(0);
  });

  it("avance vers l'est à 10 m/s et plafonne l'extrapolation", () => {
    const out = new Float32Array(4);
    interpolate(frame, 1000 + 5000, out);
    const metersEast = (out[0] - 2.35) * 111_320 * Math.cos((48.86 * Math.PI) / 180);
    expect(metersEast).toBeCloseTo(50, 0);
    expect(out[1]).toBeCloseTo(48.86, 5);
    expect(out[2]).toBeCloseTo(2.35, 6); // à quai : immobile
    interpolate(frame, 1000 + 60_000, out);
    const capped = (out[0] - 2.35) * 111_320 * Math.cos((48.86 * Math.PI) / 180);
    expect(capped).toBeCloseTo(80, 0);
    interpolate(frame, 0, out); // horloge en arrière : pas de recul
    expect(out[0]).toBeCloseTo(2.35, 6);
  });
});
