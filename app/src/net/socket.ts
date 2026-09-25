import { io, type Socket } from 'socket.io-client';
import type { ClientToServer, ServerToClient } from '@ludo/engine';

export type GameSocket = Socket<ServerToClient, ClientToServer>;

let socket: GameSocket | null = null;
let key = '';

/** One shared socket per (server, token). Reconnects automatically. */
export function getSocket(url: string, token: string): GameSocket {
  const k = url + '|' + token;
  if (socket && key === k) {
    if (socket.disconnected) socket.connect();
    return socket;
  }
  socket?.disconnect();
  key = k;
  socket = io(url, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 800,
    reconnectionDelayMax: 4000,
    timeout: 8000,
  });
  return socket;
}

export function currentSocket(): GameSocket | null { return socket; }

export function closeSocket() {
  socket?.disconnect();
  socket = null;
  key = '';
}

/** emit with ack + timeout, resolving to the ack payload or an error result. */
export function emitAck<T>(fn: (cb: (res: T) => void) => void, timeoutMs = 8000): Promise<T | { ok: false; error: string }> {
  // socket.io buffers emits while disconnected and sends them after reconnecting, long after the
  // screen gave up waiting (e.g. a queue join that later charges an entry fee). Refuse instead.
  if (!socket?.connected) return Promise.resolve({ ok: false, error: 'Not connected to the game server' });
  return new Promise((resolve) => {
    let done = false;
    const t = setTimeout(() => { if (!done) { done = true; resolve({ ok: false, error: 'Server did not respond' }); } }, timeoutMs);
    fn((res) => { if (!done) { done = true; clearTimeout(t); resolve(res); } });
  });
}
