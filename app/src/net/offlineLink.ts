// Owner test accounts only: lets the game server see offline games running on this phone
// (vs computer, pass & play, snakes) while connected, and receive dice commands for them.
// For every other player nothing is sent and offline games always use normal random dice.

import type { Color, DiceOverride, OfflineDiceCommand, OfflineGameReport } from '@ludo/engine';
import type { GameSocket } from './socket';

let socket: GameSocket | null = null;
const reports = new Map<string, OfflineGameReport>();
const pending = new Set<string>();
let timer: ReturnType<typeof setTimeout> | null = null;
/** True only for accounts the owner marked as Tester (profile.tester). */
let sharing = false;
const dice = new Map<string, Map<Color, DiceOverride>>();

function flush() {
  timer = null;
  if (!socket?.connected || !sharing) { pending.clear(); return; }
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

const resend = () => { for (const id of reports.keys()) schedule(id); };

/** Called when the app's socket changes (login, server switch, reconnect). */
export function setOfflineSocket(s: GameSocket | null) {
  socket = s;
  if (!s) return;
  s.off('connect', resend);
  s.on('connect', resend);
  resend();
}

/** Called with the profile's tester flag; turning it on shares the games already running. */
export function setOfflineSharing(on: boolean) {
  if (on === sharing) return;
  sharing = on;
  if (on) resend();
  else dice.clear();
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
  if (!sharing || !reports.has(c.gameId)) return;
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
