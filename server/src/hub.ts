import { randomUUID } from 'node:crypto';
import type { Server, Socket } from 'socket.io';
import {
  type ClientToServer, type Color, type DiceOverride, type OfflineGameReport, type RecentPlayer, type ServerToClient, type SeatInfo, type GlobalTheme,
  EMOJIS, QUICK_CHAT, RuleError, levelForXp,
} from '@ludo/engine';
import type { Config } from './config.js';
import type { Db } from './db.js';
import type { Auth } from './auth.js';
import { GameSession } from './game.js';
import { Matchmaker } from './matchmaking.js';
import { Rooms } from './rooms.js';
import { makeBot } from './bots.js';
import { UserError } from './errors.js';

export type IO = Server<ClientToServer, ServerToClient, Record<string, never>, { userId: string }>;
export type Sock = Socket<ClientToServer, ServerToClient, Record<string, never>, { userId: string }>;

export type Location =
  | { kind: 'queue'; key: string }
  | { kind: 'room'; code: string }
  | { kind: 'game'; game: GameSession };

export { UserError };

export interface OfflineEntry {
  userId: string;
  report: OfflineGameReport;
  updatedAt: number;
  /** Last dice commands the owner sent for this game (for display). */
  overrides: Partial<Record<Color, DiceOverride>>;
}

type AnyAck = (res: { ok: boolean; error?: string; [k: string]: unknown }) => void;

export class Hub {
  readonly sockets = new Map<string, Set<Sock>>();
  readonly where = new Map<string, Location>();
  readonly games = new Map<string, GameSession>();
  readonly matchmaker: Matchmaker;
  readonly rooms: Rooms;
  private lastReact = new Map<string, number>();
  private lastInvite = new Map<string, number>();
  /** Offline games (vs computer / pass & play / snakes) reported by connected apps, keyed "userId|gameId". */
  readonly offline = new Map<string, OfflineEntry>();
  private joinTries = new Map<string, { n: number; since: number }>();
  private offlineAt = new Map<string, { n: number; since: number }>();
  private cleanupTimers = new Set<NodeJS.Timeout>();
  closed = false;

  constructor(readonly io: IO, readonly db: Db, readonly cfg: Config, private auth: Auth) {
    this.matchmaker = new Matchmaker(this);
    this.rooms = new Rooms(this);
    io.use((socket, next) => {
      const token = (socket.handshake.auth as Record<string, unknown> | undefined)?.token;
      const id = this.auth.verify(token);
      if (!id || !db.getUser(id)) return next(new Error('unauthorized'));
      if (db.getUser(id)!.banned) return next(new Error('banned'));
      socket.data.userId = id;
      next();
    });
    io.on('connection', (s) => this.onConnect(s as Sock));
  }

  // ---- helpers ------------------------------------------------------------

  emitToUser<E extends keyof ServerToClient>(userId: string, ev: E, ...args: Parameters<ServerToClient[E]>): void {
    if (this.closed) return;
    for (const s of this.sockets.get(userId) ?? []) (s.emit as (e: string, ...a: unknown[]) => void)(ev, ...args);
  }

  emitToRoom<E extends keyof ServerToClient>(room: string, ev: E, ...args: Parameters<ServerToClient[E]>): void {
    if (this.closed) return;
    (this.io.to(room).emit as (e: string, ...a: unknown[]) => void)(ev, ...args);
  }

  isOnline(userId: string): boolean { return (this.sockets.get(userId)?.size ?? 0) > 0; }

  sendProfile(userId: string): void {
    const u = this.db.getUser(userId);
    if (u) this.emitToUser(userId, 'profile', this.db.profile(u));
  }

  /** Throws if the user is already queued / in a room / playing. */
  assertFree(userId: string): void {
    const w = this.where.get(userId);
    if (!w) return;
    throw new UserError(w.kind === 'queue' ? 'Already searching for a match' : w.kind === 'room' ? 'Already in a room' : 'Already in a game');
  }

  publicUser(userId: string): { userId: string; name: string; avatar: number; level: number } {
    const u = this.db.getUser(userId)!;
    return { userId, name: u.name, avatar: u.avatar, level: levelForXp(u.xp) };
  }

  /** Forget that the user is in `game` (left, removed or game over). */
  releaseUser(userId: string, game: GameSession): void {
    const w = this.where.get(userId);
    if (w?.kind === 'game' && w.game === game) this.where.delete(userId);
    for (const s of this.sockets.get(userId) ?? []) s.leave(game.room);
  }

  scheduleGameCleanup(game: GameSession): void {
    const t = setTimeout(() => {
      this.cleanupTimers.delete(t);
      game.dispose();
      this.games.delete(game.id);
      this.io.in(game.room).socketsLeave(game.room);
    }, this.cfg.gameCleanupMs);
    this.cleanupTimers.add(t);
  }

  /**
   * Charge entry and start a game. `humans` are in seat order unless `shuffle`.
   * Empty seats (up to `seatCount`) are filled with bots. Returns null when no one could pay.
   */
  startGame(opts: { humans: string[]; colors: Color[]; stake: number; shuffle: boolean; minHumans: number }): GameSession | null {
    const id = randomUUID();
    const { paid, failed } = this.db.chargeEntry(opts.humans, opts.stake, id);
    for (const u of failed) {
      this.where.delete(u);
      this.emitToUser(u, 'notice', { message: 'Not enough coins for the entry fee' });
    }
    if (paid.length < opts.minHumans) {
      if (paid.length) this.db.refund(paid, opts.stake, id);
      return null;
    }
    const colors = opts.colors.slice();
    let humanColors: Color[];
    if (opts.shuffle) {
      const idx = colors.map((_, i) => i);
      for (let i = idx.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [idx[i], idx[j]] = [idx[j], idx[i]];
      }
      humanColors = idx.slice(0, paid.length).map((i) => colors[i]);
    } else {
      humanColors = colors.slice(0, paid.length);
    }
    const seatByColor = new Map<Color, SeatInfo>();
    paid.forEach((u, i) => {
      seatByColor.set(humanColors[i], { ...this.publicUser(u), color: humanColors[i], isBot: false, connected: this.isOnline(u) });
    });
    const used = new Set<string>();
    const seats: SeatInfo[] = colors.map((c) => seatByColor.get(c) ?? { ...makeBot(used), color: c, isBot: true, connected: true });
    const game = new GameSession(this, id, opts.stake, seats);
    this.games.set(id, game);
    try { this.db.recordCoPlayers(paid); } catch (e) { this.cfg.log('recent players failed', e); }
    for (const u of paid) {
      this.where.set(u, { kind: 'game', game });
      for (const s of this.sockets.get(u) ?? []) s.join(game.room);
      this.sendProfile(u);
    }
    this.cfg.log('game start', id, `stake=${opts.stake}`, seats.map((s) => `${s.color}:${s.isBot ? 'bot' : s.userId.slice(0, 8)}`).join(' '));
    game.start();
    return game;
  }

  // ---- sockets ------------------------------------------------------------

  private handle(socket: Sock, ev: string, fn: (userId: string, ...args: unknown[]) => unknown): void {
    socket.on(ev as never, ((...args: unknown[]) => {
      const last = args[args.length - 1];
      const ack: AnyAck | null = typeof last === 'function' ? (last as AnyAck) : null;
      if (ack) args.pop();
      try {
        const res = fn(socket.data.userId, ...args);
        if (ack) ack({ ok: true, ...(res && typeof res === 'object' ? res : {}) });
      } catch (e) {
        const known = e instanceof UserError || e instanceof RuleError;
        if (!known) this.cfg.log('socket error', ev, socket.data.userId, e);
        if (ack) ack({ ok: false, error: known ? e.message : 'Something went wrong' });
      }
    }) as never);
  }

  private gameFor(userId: string, req: unknown): GameSession {
    const gameId = isObj(req) ? req.gameId : undefined;
    if (typeof gameId !== 'string') throw new UserError('Bad request');
    const g = this.games.get(gameId);
    const seat = g?.seatOf(userId);
    if (!g || g.over || !seat) throw new UserError('Game not found');
    // Players who left or were removed can no longer act in (or react to) the game.
    if (g.state.players.find((p) => p.color === seat.color)?.out) throw new UserError('You left this game');
    return g;
  }

  private onConnect(socket: Sock): void {
    const userId = socket.data.userId;
    let set = this.sockets.get(userId);
    if (!set) this.sockets.set(userId, (set = new Set()));
    const wasOnline = set.size > 0;
    set.add(socket);

    socket.emit('theme', this.theme());

    const w = this.where.get(userId);
    if (w?.kind === 'game') {
      socket.join(w.game.room);
      const seat = w.game.seatOf(userId)!;
      socket.emit('game:start', w.game.info(seat.color));
      if (!wasOnline) w.game.setConnected(userId, true);
    } else if (w?.kind === 'room') {
      this.rooms.onReconnect(userId, socket);
    }

    this.handle(socket, 'queue:join', (u, req) => {
      if (!isObj(req)) throw new UserError('Bad request');
      this.matchmaker.join(u, req.players, req.stake);
    });
    this.handle(socket, 'queue:leave', (u) => { this.matchmaker.leave(u); });
    this.handle(socket, 'room:create', (u, req) => {
      if (!isObj(req)) throw new UserError('Bad request');
      return { room: this.rooms.create(u, req.maxPlayers, req.stake) };
    });
    this.handle(socket, 'room:join', (u, req) => {
      if (!isObj(req)) throw new UserError('Bad request');
      // Throttle joins so private room codes cannot be guessed by brute force.
      const now = Date.now();
      const j = this.joinTries.get(u);
      const tries = j && now - j.since < 10_000 ? j : { n: 0, since: now };
      if (tries.n >= 6) throw new UserError('Too many attempts, wait a few seconds');
      this.joinTries.set(u, { n: tries.n + 1, since: tries.since });
      return { room: this.rooms.join(u, req.code) };
    });
    this.handle(socket, 'room:leave', (u) => { this.rooms.leave(u); });
    this.handle(socket, 'room:start', (u) => { this.rooms.start(u); });
    this.handle(socket, 'game:roll', (u, req) => { this.gameFor(u, req).act(u, { type: 'roll' }); });
    this.handle(socket, 'game:move', (u, req) => {
      const g = this.gameFor(u, req);
      const token = (req as { token?: unknown }).token;
      if (!Number.isInteger(token) || (token as number) < 0 || (token as number) > 3) throw new UserError('Bad token');
      g.act(u, { type: 'move', token: token as number });
    });
    this.handle(socket, 'game:leave', (u, req) => { this.gameFor(u, req).leave(u); });
    this.handle(socket, 'game:sync', (u, req) => {
      const g = this.gameFor(u, req);
      socket.emit('game:start', g.info(g.seatOf(u)!.color));
    });
    this.handle(socket, 'game:react', (u, req) => {
      const g = this.gameFor(u, req);
      const text = (req as { text?: unknown }).text;
      if (typeof text !== 'string' || !((EMOJIS as readonly string[]).includes(text) || (QUICK_CHAT as readonly string[]).includes(text))) {
        throw new UserError('Bad reaction');
      }
      const now = Date.now();
      if (now - (this.lastReact.get(u) ?? 0) < 1000) return;
      this.lastReact.set(u, now);
      this.emitToRoom(g.room, 'game:react', { gameId: g.id, color: g.seatOf(u)!.color, text });
    });

    this.handle(socket, 'players:recent', (u) => {
      const players: RecentPlayer[] = this.db.recentPlayers(u).map((r) => ({
        playerId: r.player_id, name: r.name, avatar: r.avatar, level: levelForXp(r.xp), online: this.isOnline(r.id),
      }));
      return { players };
    });
    this.handle(socket, 'invite:send', (u, req) => {
      if (!isObj(req) || typeof req.toPlayerId !== 'string' || typeof req.roomCode !== 'string') throw new UserError('Bad request');
      const w = this.where.get(u);
      if (w?.kind !== 'room' || w.code !== req.roomCode) throw new UserError('You are not in that room');
      const to = this.db.getByPlayerId(req.toPlayerId);
      if (!to || to.id === u) throw new UserError('Player not found');
      if (!this.isOnline(to.id)) throw new UserError(`${to.name} is offline`);
      const now = Date.now();
      if (now - (this.lastInvite.get(u) ?? 0) < 1000) throw new UserError('Slow down');
      this.lastInvite.set(u, now);
      const me = this.db.getUser(u)!;
      this.emitToUser(to.id, 'invite:received', { fromPlayerId: me.player_id, fromName: me.name, fromAvatar: me.avatar, roomCode: w.code });
    });
    this.handle(socket, 'offline:state', (u, req) => { this.offlineReport(u, req); });
    this.handle(socket, 'offline:end', (u, req) => {
      if (isObj(req) && typeof req.id === 'string') this.offline.delete(`${u}|${req.id}`);
    });

    socket.on('disconnect', () => {
      const s = this.sockets.get(userId);
      s?.delete(socket);
      if (s && s.size > 0) return;
      this.sockets.delete(userId);
      this.lastReact.delete(userId);
      this.lastInvite.delete(userId);
      // Offline games can only be controlled while the phone is connected; it re-reports on reconnect.
      for (const [k, e] of this.offline) if (e.userId === userId) this.offline.delete(k);
      const loc = this.where.get(userId);
      if (loc?.kind === 'queue') this.matchmaker.leave(userId);
      else if (loc?.kind === 'room') this.rooms.onDisconnect(userId);
      else if (loc?.kind === 'game') loc.game.setConnected(userId, false);
    });
  }

  /** The owner-chosen theme applied to every player's app. */
  theme(): GlobalTheme {
    return this.db.getSetting<GlobalTheme>('theme') ?? { board: null, dice: null, locked: false };
  }

  private offlineReport(userId: string, req: unknown): void {
    if (!isObj(req) || typeof req.id !== 'string' || req.id.length > 64) throw new UserError('Bad request');
    if (req.game !== 'ludo' && req.game !== 'snakes') throw new UserError('Bad request');
    if (req.mode !== 'bots' && req.mode !== 'pass') throw new UserError('Bad request');
    if (!validOfflineReport(req)) throw new UserError('Bad request');
    // Only the owner's test accounts share offline games; other players' offline games stay on their phone.
    if (!this.db.getUser(userId)?.tester) return;
    // Flood guard: phones send at most ~3 reports a second; ignore anything far beyond that.
    const now = Date.now();
    const rate = this.offlineAt.get(userId);
    const win = rate && now - rate.since < 1000 ? rate : { n: 0, since: now };
    if (win.n >= 20) return;
    this.offlineAt.set(userId, { n: win.n + 1, since: win.since });
    const key = `${userId}|${req.id}`;
    const prev = this.offline.get(key);
    if (!prev && [...this.offline.values()].filter((e) => e.userId === userId).length >= 3) {
      // Keep at most a few per user: drop the oldest.
      const oldest = [...this.offline.entries()].filter(([, e]) => e.userId === userId).sort((a, b) => a[1].updatedAt - b[1].updatedAt)[0];
      this.offline.delete(oldest[0]);
    }
    const report = req as unknown as OfflineGameReport;
    const overrides = { ...(prev?.overrides ?? {}) };
    // A 'once' command is used up by that colour's next roll on the phone.
    const last = (report.state as { last?: { type?: string; color?: Color } }).last;
    if (prev && report.state.seq !== prev.report.state.seq && last?.type === 'roll' && last.color && overrides[last.color]?.mode === 'once') delete overrides[last.color];
    this.offline.set(key, { userId, report, updatedAt: Date.now(), overrides });
  }

  /** Owner: remove a user from everything and drop their connections (ban). */
  kick(userId: string): void {
    const w = this.where.get(userId);
    if (w?.kind === 'queue') this.matchmaker.leave(userId);
    else if (w?.kind === 'room') this.rooms.leave(userId);
    else if (w?.kind === 'game') w.game.leave(userId);
    this.where.delete(userId);
    for (const s of [...(this.sockets.get(userId) ?? [])]) s.disconnect(true);
    this.sockets.delete(userId);
  }

  /** Account deletion: forfeit/leave everything, drop sockets, delete all data. */
  deleteUser(userId: string): void {
    const w = this.where.get(userId);
    if (w?.kind === 'queue') this.matchmaker.leave(userId);
    else if (w?.kind === 'room') this.rooms.leave(userId);
    else if (w?.kind === 'game') w.game.leave(userId);
    this.where.delete(userId);
    for (const s of [...(this.sockets.get(userId) ?? [])]) s.disconnect(true);
    this.sockets.delete(userId);
    this.db.deleteUser(userId);
    this.cfg.log('user deleted', userId);
  }

  close(): void {
    this.closed = true;
    this.matchmaker.close();
    this.rooms.close();
    for (const t of this.cleanupTimers) clearTimeout(t);
    for (const g of this.games.values()) g.dispose();
    // Games live in memory: give back the entry fees of every game that did not finish.
    try {
      const n = this.db.refundOpenGames();
      if (n) this.cfg.log(`refunded entry fees of ${n} unfinished game(s)`);
    } catch (e) { this.cfg.log('refund on close failed', e); }
  }
}

const COLORS = new Set(['red', 'green', 'yellow', 'blue']);
const isInt = (v: unknown, lo: number, hi: number) => Number.isInteger(v) && (v as number) >= lo && (v as number) <= hi;

/** Offline reports come from any phone: check the shape the owner app renders, so a bad one cannot break it. */
function validOfflineReport(r: Record<string, unknown>): boolean {
  const seats = r.seats;
  const st = r.state;
  if (!Array.isArray(seats) || seats.length < 2 || seats.length > 4 || !isObj(st)) return false;
  if (!seats.every((x) => isObj(x) && COLORS.has(x.color as string) && typeof x.name === 'string' && x.name.length <= 40)) return false;
  const players = st.players;
  if (!Array.isArray(players) || players.length !== seats.length) return false;
  if (!isInt(st.turn, 0, players.length - 1) || !isInt(st.seq, 0, 1e9) || !Array.isArray(st.ranking)) return false;
  if (!['roll', 'move', 'over'].includes(st.phase as string)) return false;
  return players.every((p) => {
    if (!isObj(p) || !COLORS.has(p.color as string)) return false;
    if (r.game === 'snakes') return isInt(p.pos, 0, 100);
    return Array.isArray(p.tokens) && p.tokens.length === 4 && p.tokens.every((t) => isInt(t, -1, 56));
  });
}

export function isObj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}
