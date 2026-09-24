// Owner control for the separate Ludo Admin app (Socket.IO namespace /admin).
// Every connection must present the server's OWNER_KEY. Nothing here is ever sent to
// players: dice overrides live on the server (online) or go only to the phone running
// that offline game.

import type { Namespace, Socket } from 'socket.io';
import {
  type Color, type DiceOverride, type GlobalTheme, type OwnerClientToServer, type OwnerConfigPatch, type OwnerServerToClient,
  type OwnerSnapshot, type OwnerUser,
  ALL_COLORS, BOARD_THEMES, DICE_SKINS, RuleError, levelForXp,
} from '@ludo/engine';
import type { Hub } from './hub.js';
import { isObj } from './hub.js';
import { InsufficientCoins, type UserRow } from './db.js';
import { sameKey } from './auth.js';
import { serverConfig } from './http.js';
import { sanitizeName } from './profile.js';
import { UserError } from './errors.js';

type OwnerNs = Namespace<OwnerClientToServer, OwnerServerToClient>;
type OwnerSock = Socket<OwnerClientToServer, OwnerServerToClient>;
type AnyAck = (res: { ok: boolean; error?: string; [k: string]: unknown }) => void;

/** Offline reports older than this are dropped from the owner's list. */
const OFFLINE_STALE_MS = 3 * 60_000;

function parseOverride(mode: unknown, value: unknown): DiceOverride | null {
  if (mode === null || mode === undefined) return null;
  if (mode === 'always6' || mode === 'best') return { mode };
  if (mode === 'once' && Number.isInteger(value) && (value as number) >= 1 && (value as number) <= 6) return { mode, value: value as number };
  throw new UserError('Bad dice request');
}

function intList(v: unknown, min: number, max: number, maxLen: number): number[] | null {
  if (!Array.isArray(v) || v.length === 0 || v.length > maxLen) return null;
  return v.every((n) => Number.isInteger(n) && n >= min && n <= max) ? (v as number[]) : null;
}

export interface SavedConfig { dailyRewards?: number[]; stakes?: number[]; turnSeconds?: number }

/** Applies owner config changes saved in the database over the env/default config. */
export function applySavedConfig(hub: Pick<Hub, 'cfg' | 'db'>): void {
  const saved = hub.db.getSetting<SavedConfig>('config');
  if (!saved) return;
  if (saved.dailyRewards) hub.cfg.dailyRewards = saved.dailyRewards;
  if (saved.stakes) hub.cfg.stakes = saved.stakes;
  if (saved.turnSeconds) hub.cfg.turnSeconds = saved.turnSeconds;
}

export class OwnerControl {
  readonly ns: OwnerNs;
  private failures = new Map<string, { n: number; since: number }>();

  constructor(private hub: Hub) {
    this.ns = hub.io.of('/admin') as unknown as OwnerNs;
    this.ns.use((socket, next) => {
      const ip = socket.handshake.address;
      const now = Date.now();
      const f = this.failures.get(ip);
      const tries = f && now - f.since < 60_000 ? f : { n: 0, since: now };
      if (tries.n >= 10) return next(new Error('too many attempts'));
      const key = (socket.handshake.auth as Record<string, unknown> | undefined)?.key;
      if (!hub.cfg.ownerKey || !sameKey(key, hub.cfg.ownerKey)) {
        this.failures.set(ip, { n: tries.n + 1, since: tries.since });
        return next(new Error('unauthorized'));
      }
      this.failures.delete(ip);
      next();
    });
    this.ns.on('connection', (s) => this.onConnect(s as OwnerSock));
  }

  private user(u: UserRow): OwnerUser {
    return {
      id: u.id, playerId: u.player_id, name: u.name, avatar: u.avatar, coins: u.coins, wins: u.wins, games: u.games,
      level: levelForXp(u.xp), banned: !!u.banned, online: this.hub.isOnline(u.id),
    };
  }

  private mustUser(id: unknown): UserRow {
    const u = typeof id === 'string' ? this.hub.db.getUser(id) : undefined;
    if (!u) throw new UserError('User not found');
    return u;
  }

  snapshot(): OwnerSnapshot {
    const hub = this.hub;
    const now = Date.now();
    for (const [k, e] of hub.offline) if (now - e.updatedAt > OFFLINE_STALE_MS) hub.offline.delete(k);
    return {
      now,
      online: hub.sockets.size,
      games: [...hub.games.values()].filter((g) => !g.over).map((g) => ({
        gameId: g.id, stake: g.stake, prizes: g.prizes, seats: g.seats, state: g.state, deadline: g.deadline, overrides: g.overridesView(),
      })),
      rooms: hub.rooms.list(),
      offline: [...hub.offline.values()].map((e) => {
        const u = hub.db.getUser(e.userId);
        return {
          ...e.report, userId: e.userId, userName: u?.name ?? '?', playerId: u?.player_id ?? '', online: hub.isOnline(e.userId),
          updatedAt: e.updatedAt, overrides: e.overrides,
        };
      }),
      theme: hub.theme(),
      config: serverConfig(hub.cfg, hub.db),
    };
  }

  private handle(socket: OwnerSock, ev: string, fn: (...args: unknown[]) => unknown): void {
    socket.on(ev as never, ((...args: unknown[]) => {
      const last = args[args.length - 1];
      const ack: AnyAck | null = typeof last === 'function' ? (last as AnyAck) : null;
      if (ack) args.pop();
      try {
        const res = fn(...args);
        if (ack) ack({ ok: true, ...(res && typeof res === 'object' ? res : {}) });
      } catch (e) {
        const known = e instanceof UserError || e instanceof RuleError || e instanceof InsufficientCoins;
        if (!known) this.hub.cfg.log('owner error', ev, e);
        if (ack) ack({ ok: false, error: known ? (e as Error).message : 'Something went wrong' });
      }
    }) as never);
  }

  private onConnect(socket: OwnerSock): void {
    const hub = this.hub;
    hub.cfg.log('owner connected', socket.handshake.address);

    this.handle(socket, 'owner:snapshot', () => ({ snapshot: this.snapshot() }));

    this.handle(socket, 'owner:dice', (req) => {
      if (!isObj(req) || typeof req.gameId !== 'string') throw new UserError('Bad request');
      const g = hub.games.get(req.gameId);
      if (!g || g.over) throw new UserError('Game not found');
      g.setDiceOverride(req.color as Color, parseOverride(req.mode, req.value));
    });

    this.handle(socket, 'owner:offlineDice', (req) => {
      if (!isObj(req) || typeof req.userId !== 'string' || typeof req.gameId !== 'string') throw new UserError('Bad request');
      const color = req.color as Color;
      if (!ALL_COLORS.includes(color)) throw new UserError('Bad colour');
      const o = parseOverride(req.mode, req.value);
      const entry = hub.offline.get(`${req.userId}|${req.gameId}`);
      if (!entry) throw new UserError('Offline game not found');
      if (!hub.isOnline(req.userId)) throw new UserError('That phone is not connected to the server right now');
      const overrides = { ...entry.overrides };
      if (o) overrides[color] = o; else delete overrides[color];
      entry.overrides = overrides;
      hub.emitToUser(req.userId, 'offline:dice', { gameId: req.gameId, color, value: o?.mode === 'once' ? o.value! : null, mode: o?.mode ?? null });
    });

    this.handle(socket, 'owner:endGame', (req) => {
      if (!isObj(req) || typeof req.gameId !== 'string') throw new UserError('Bad request');
      const g = hub.games.get(req.gameId);
      if (!g || g.over) throw new UserError('Game not found');
      const winner = req.winner === null || req.winner === undefined ? null : (req.winner as Color);
      if (winner !== null && !ALL_COLORS.includes(winner)) throw new UserError('Bad colour');
      g.forceEnd(winner);
    });

    this.handle(socket, 'owner:users', (req) => {
      const q = isObj(req) && typeof req.query === 'string' ? req.query.slice(0, 64) : '';
      return { users: hub.db.searchUsers(q).map((u) => this.user(u)) };
    });

    this.handle(socket, 'owner:coins', (req) => {
      if (!isObj(req)) throw new UserError('Bad request');
      const u = this.mustUser(req.userId);
      const amount = req.amount;
      if (!Number.isInteger(amount) || amount === 0 || Math.abs(amount as number) > 10_000_000) throw new UserError('Bad amount');
      const row = hub.db.addCoins(u.id, amount as number, amount as number > 0 ? 'owner-gift' : 'owner-take', null);
      hub.sendProfile(u.id);
      hub.cfg.log('owner coins', u.id, amount);
      return { user: this.user(row) };
    });

    this.handle(socket, 'owner:rename', (req) => {
      if (!isObj(req)) throw new UserError('Bad request');
      const u = this.mustUser(req.userId);
      const name = sanitizeName(req.name);
      if (!name) throw new UserError('Invalid name');
      hub.db.updateUser(u.id, { name });
      hub.sendProfile(u.id);
      return { user: this.user(hub.db.getUser(u.id)!) };
    });

    this.handle(socket, 'owner:ban', (req) => {
      if (!isObj(req) || typeof req.banned !== 'boolean') throw new UserError('Bad request');
      const u = this.mustUser(req.userId);
      hub.db.setBanned(u.id, req.banned);
      if (req.banned) hub.kick(u.id);
      hub.cfg.log('owner ban', u.id, req.banned);
      return { user: this.user(hub.db.getUser(u.id)!) };
    });

    this.handle(socket, 'owner:theme', (req) => {
      if (!isObj(req)) throw new UserError('Bad request');
      const board = req.board ?? null;
      const dice = req.dice ?? null;
      if (board !== null && !(BOARD_THEMES as readonly unknown[]).includes(board)) throw new UserError('Bad board theme');
      if (dice !== null && !(DICE_SKINS as readonly unknown[]).includes(dice)) throw new UserError('Bad dice skin');
      const theme = { board, dice, locked: !!req.locked } as GlobalTheme;
      hub.db.setSetting('theme', theme);
      hub.io.emit('theme', theme);
    });

    this.handle(socket, 'owner:config', (req) => {
      if (!isObj(req)) throw new UserError('Bad request');
      const patch = req as OwnerConfigPatch;
      const saved: SavedConfig = hub.db.getSetting<SavedConfig>('config') ?? {};
      if (patch.dailyRewards !== undefined) {
        const v = intList(patch.dailyRewards, 0, 1_000_000, 14);
        if (!v) throw new UserError('Daily rewards: 1-14 whole numbers');
        hub.cfg.dailyRewards = saved.dailyRewards = v;
      }
      if (patch.stakes !== undefined) {
        const v = intList(patch.stakes, 1, 10_000_000, 12);
        if (!v) throw new UserError('Stakes: 1-12 positive whole numbers');
        hub.cfg.stakes = saved.stakes = [...new Set(v)].sort((a, b) => a - b);
      }
      if (patch.turnSeconds !== undefined) {
        const t = patch.turnSeconds;
        if (!Number.isInteger(t) || t < 5 || t > 120) throw new UserError('Turn seconds: 5 to 120');
        hub.cfg.turnSeconds = saved.turnSeconds = t;
      }
      hub.db.setSetting('config', saved);
      hub.cfg.log('owner config', JSON.stringify(saved));
      return { config: serverConfig(hub.cfg, hub.db) };
    });

    this.handle(socket, 'owner:notice', (req) => {
      const message = isObj(req) && typeof req.message === 'string' ? req.message.trim().slice(0, 200) : '';
      if (!message) throw new UserError('Empty message');
      hub.io.emit('broadcast', { message });
    });
  }
}
