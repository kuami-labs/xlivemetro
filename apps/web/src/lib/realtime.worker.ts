/// <reference lib="webworker" />
// Web Worker : connexion WebSocket, décodage protobuf et mise en colonnes, hors du fil
// principal (docs/04-FRONTEND.md). Le fil principal ne fait qu'interpoler et dessiner.
import {
  ClientMessageSchema,
  ServerMessageSchema,
  SubscribeSchema,
  create,
  fromBinary,
  toBinary,
  type Vehicle,
} from '@xlivemetro/proto';
import { applyMessage, toFrame } from './vehicles';

export type WorkerIn =
  { type: 'connect'; url: string } | { type: 'subscribe'; bbox: [number, number, number, number] };

export type WorkerOut =
  { type: 'frame'; frame: ReturnType<typeof toFrame> } | { type: 'status'; connected: boolean };

const ctx = self as unknown as DedicatedWorkerGlobalScope;
const state = new Map<string, Vehicle>();
let socket: WebSocket | null = null;
let url = '';
let bbox: [number, number, number, number] | null = null;
let retry = 0;
let dataTime = 0;
let source = '';
let serverTime = 0;

function send(b: [number, number, number, number]) {
  if (socket?.readyState !== WebSocket.OPEN) return;
  const [west, south, east, north] = b;
  const msg = create(ClientMessageSchema, {
    msg: {
      case: 'subscribe',
      value: create(SubscribeSchema, { bbox: { west, south, east, north } }),
    },
  });
  socket.send(toBinary(ClientMessageSchema, msg));
}

function connect() {
  socket = new WebSocket(url);
  socket.binaryType = 'arraybuffer';
  socket.onopen = () => {
    retry = 0;
    ctx.postMessage({ type: 'status', connected: true } satisfies WorkerOut);
    if (bbox) send(bbox);
  };
  socket.onmessage = (e: MessageEvent<ArrayBuffer>) => {
    const msg = fromBinary(ServerMessageSchema, new Uint8Array(e.data));
    if (msg.msg.case === 'snapshot') source = msg.msg.value.source;
    if (msg.msg.case) {
      dataTime = Number(msg.msg.value.dataTimeMs);
      serverTime = Number(msg.msg.value.timeMs);
    }
    applyMessage(state, msg);
    const frame = toFrame(state, performance.now(), dataTime, source, serverTime);
    ctx.postMessage({ type: 'frame', frame } satisfies WorkerOut, [
      frame.positions.buffer,
      frame.bearings.buffer,
      frame.speeds.buffer,
      frame.delays.buffer,
      frame.flags.buffer,
    ]);
  };
  socket.onclose = () => {
    ctx.postMessage({ type: 'status', connected: false } satisfies WorkerOut);
    // Reconnexion avec attente croissante (1 s, 2 s, 4 s… 30 s max)
    const delay = Math.min(30_000, 1000 * 2 ** retry++);
    setTimeout(connect, delay);
  };
}

ctx.onmessage = (e: MessageEvent<WorkerIn>) => {
  if (e.data.type === 'connect' && !socket) {
    url = e.data.url;
    connect();
  } else if (e.data.type === 'subscribe') {
    bbox = e.data.bbox;
    send(bbox);
  }
};
