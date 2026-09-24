import { io, type Socket } from 'socket.io-client';
import type { OwnerClientToServer, OwnerServerToClient } from '@ludo/engine';

export type AdminSocket = Socket<OwnerServerToClient, OwnerClientToServer>;

/** Connects to the server's owner namespace; rejects with the server's reason (e.g. "unauthorized"). */
export function connectAdmin(url: string, key: string): Promise<AdminSocket> {
  const s: AdminSocket = io(`${url.replace(/\/+$/, '')}/admin`, {
    auth: { key }, transports: ['websocket', 'polling'], reconnection: true, reconnectionDelay: 800, timeout: 8000,
  });
  return new Promise((resolve, reject) => {
    const fail = (e: Error) => { s.close(); reject(e); };
    s.once('connect', () => { s.off('connect_error', fail); resolve(s); });
    s.once('connect_error', fail);
  });
}

type Res<T> = ({ ok: true } & T) | { ok: false; error: string };

/** Emit with an ack; resolves to the ack or a timeout error. */
export function call<T = object>(s: AdminSocket, ev: keyof OwnerClientToServer, ...args: unknown[]): Promise<Res<T>> {
  return new Promise((resolve) => {
    let done = false;
    const t = setTimeout(() => { if (!done) { done = true; resolve({ ok: false, error: 'Server did not respond' }); } }, 8000);
    (s.emit as (...a: unknown[]) => void)(ev, ...args, (r: Res<T>) => { if (!done) { done = true; clearTimeout(t); resolve(r); } });
  });
}

export function defaultServerUrl(): string {
  try {
    const saved = localStorage.getItem('admin.server');
    if (saved) return saved;
  } catch { /* storage blocked */ }
  if (location.protocol.startsWith('http') && location.pathname.startsWith('/admin')) return location.origin;
  return 'http://localhost:3000';
}

export function store(key: string, value: string | null) {
  try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value); } catch { /* ignore */ }
}
export function load(key: string): string {
  try { return localStorage.getItem(key) ?? ''; } catch { return ''; }
}
