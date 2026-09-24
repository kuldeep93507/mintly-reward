import { io as ioc, type Socket } from 'socket.io-client';
import { type AuthResponse, type ClientToServer, type GameInfo, type GameUpdate, type ServerToClient, legalTokens } from '@ludo/engine';
import { type App, createApp } from '../src/app.js';
import type { Config } from '../src/config.js';

export type Client = Socket<ServerToClient, ClientToServer>;

export interface TestServer { app: App; url: string; close(): Promise<void> }

const quiet = () => {};

export async function startServer(o: Partial<Config> = {}): Promise<TestServer> {
  const app = createApp({ dbFile: ':memory:', animGraceMs: 0, botDelayMs: 5, turnSeconds: 10, gameCleanupMs: 50, queueTickMs: 50, log: quiet, ...o });
  const port = await app.listen(0, '127.0.0.1');
  const url = `http://127.0.0.1:${port}`;
  const clients: Client[] = [];
  (app as unknown as { clients: Client[] }).clients = clients;
  return { app, url, close: async () => { await app.close(); } };
}

let dev = 0;
export async function guest(url: string, extra: Record<string, unknown> = {}): Promise<AuthResponse> {
  const res = await fetch(`${url}/api/auth/guest`, { method: 'POST', body: JSON.stringify({ deviceId: `test-device-${process.pid}-${++dev}`, ...extra }) });
  if (res.status !== 200) throw new Error(`guest failed ${res.status}`);
  return (await res.json()) as AuthResponse;
}

export async function api(url: string, method: string, path: string, token?: string, body?: unknown): Promise<{ status: number; json: any }> {
  const res = await fetch(`${url}${path}`, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, json: await res.json() };
}

export function connect(url: string, token: string, setup?: (s: Client) => void): Promise<Client> {
  const s: Client = ioc(url, { auth: { token }, transports: ['websocket'], reconnection: false, forceNew: true });
  setup?.(s);
  return new Promise((resolve, reject) => {
    s.once('connect', () => resolve(s));
    s.once('connect_error', (e) => { s.close(); reject(e); });
  });
}

export function once<E extends keyof ServerToClient>(s: Client, ev: E, pred: (...a: Parameters<ServerToClient[E]>) => boolean = () => true, ms = 20_000): Promise<Parameters<ServerToClient[E]>[0]> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => { s.off(ev, h as never); reject(new Error(`timeout waiting for ${ev}`)); }, ms);
    const h = (...a: Parameters<ServerToClient[E]>) => {
      if (!pred(...a)) return;
      clearTimeout(t);
      s.off(ev, h as never);
      resolve(a[0]);
    };
    s.on(ev, h as never);
  });
}

export function emitAck<T = { ok: boolean; error?: string }>(s: Client, ev: string, ...args: unknown[]): Promise<T> {
  return new Promise((resolve) => (s.emit as (...a: unknown[]) => void)(ev, ...args, resolve));
}

/** Makes a client play its own turns instantly (first legal token). */
export function autoplay(s: Client, info: GameInfo): void {
  let acted = -1;
  const onUpdate = (u: GameUpdate) => {
    if (u.gameId !== info.gameId) return;
    const st = u.state;
    if (st.phase === 'over' || st.players[st.turn].color !== info.you || st.seq === acted) return;
    acted = st.seq;
    if (st.phase === 'roll') s.emit('game:roll', { gameId: info.gameId }, () => {});
    else s.emit('game:move', { gameId: info.gameId, token: legalTokens(st)[0] }, () => {});
  };
  s.on('game:state', onUpdate);
  onUpdate(info.update);
}
