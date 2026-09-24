// Lets the game server see offline games running on this phone (vs computer, pass & play,
// snakes) while the app happens to be connected, and receive dice commands for them.
// Without a server connection offline games simply run with normal dice.

import type { Color, DiceOverride, OfflineDiceCommand, OfflineGameReport } from '@ludo/engine';
import type { GameSocket } from './socket';

let socket: GameSocket | null = null;
const reports = new Map<string, OfflineGameReport>();
const pending = new Set<string>();
let timer: ReturnType<typeof setTimeout> | null = null;
const dice = new Map<string, Map<Color, DiceOverride>>();

function flush() {
  timer = null;
  if (!socket?.connected) return;
  for (const id of pending) {
    const r = reports.get(id);
    if (r) socket.emit('offline:state', r);
  }
  pending.clear();
}

function schedule(id: string) {
  pending.add(id);
  if (!timer) timer = setTimeout(flush, 300);
}

/** Called when the app's socket changes (login, server switch, reconnect). */
export function setOfflineSocket(s: GameSocket | null) {
  socket = s;
  if (!s) return;
  const resend = () => { for (const id of reports.keys()) schedule(id); };
  s.off('connect', resend);
  s.on('connect', resend);
  resend();
}

export function reportOffline(r: OfflineGameReport) {
  reports.set(r.id, r);
  schedule(r.id);
}

export function endOffline(id: string) {
  if (!reports.delete(id)) return;
  dice.delete(id);
  pending.delete(id);
  if (socket?.connected) socket.emit('offline:end', { id });
}

export function applyOfflineDice(c: OfflineDiceCommand) {
  if (!reports.has(c.gameId)) return;
  let m = dice.get(c.gameId);
  if (!m) dice.set(c.gameId, (m = new Map()));
  if (c.mode === null) m.delete(c.color);
  else if (c.mode === 'once') { if (c.value !== null) m.set(c.color, { mode: 'once', value: c.value }); }
  else m.set(c.color, { mode: c.mode });
}

/** The pending dice override for `color` in an offline game ('once' overrides are consumed). */
export function takeOfflineDice(gameId: string, color: Color): DiceOverride | null {
  const m = dice.get(gameId);
  const o = m?.get(color) ?? null;
  if (o?.mode === 'once') m!.delete(color);
  return o;
}

export function offlineId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}
