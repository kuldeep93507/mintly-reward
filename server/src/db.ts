import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomInt, randomUUID } from 'node:crypto';
import { type Profile, type LeaderboardEntry, levelForXp } from '@ludo/engine';
import type { Config } from './config.js';

export interface UserRow {
  id: string;
  device_id: string;
  name: string;
  avatar: number;
  coins: number;
  wins: number;
  games: number;
  xp: number;
  daily_streak: number;
  last_daily_at: number | null;
  last_free_at: number | null;
  created_at: number;
  player_id: string;
  banned: number;
  tester: number;
}

const PID_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function makePlayerId(): string {
  let s = '';
  for (let i = 0; i < 6; i++) s += PID_CHARS[randomInt(PID_CHARS.length)];
  return s;
}

export class InsufficientCoins extends Error {
  constructor() { super('Not enough coins'); }
}

export class Db {
  readonly sql: DatabaseSync;

  constructor(private cfg: Config) {
    let file = cfg.dbFile;
    if (!file) {
      mkdirSync(cfg.dataDir, { recursive: true });
      file = join(cfg.dataDir, 'ludo.db');
    }
    this.sql = new DatabaseSync(file);
    if (file !== ':memory:') this.sql.exec('PRAGMA journal_mode = WAL');
    this.sql.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        device_id TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        avatar INTEGER NOT NULL DEFAULT 0,
        coins INTEGER NOT NULL DEFAULT 0 CHECK (coins >= 0),
        wins INTEGER NOT NULL DEFAULT 0,
        games INTEGER NOT NULL DEFAULT 0,
        xp INTEGER NOT NULL DEFAULT 0,
        daily_streak INTEGER NOT NULL DEFAULT 0,
        last_daily_at INTEGER,
        last_free_at INTEGER,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS users_rank ON users (wins DESC, coins DESC);
      CREATE TABLE IF NOT EXISTS coin_tx (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL REFERENCES users(id),
        amount INTEGER NOT NULL,
        reason TEXT NOT NULL,
        ref TEXT,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS coin_tx_user ON coin_tx (user_id, created_at);
      CREATE TABLE IF NOT EXISTS recent_players (
        user_id TEXT NOT NULL,
        other_id TEXT NOT NULL,
        played_at INTEGER NOT NULL,
        PRIMARY KEY (user_id, other_id)
      );
      CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS recent_players_user ON recent_players (user_id, played_at DESC);
      CREATE TABLE IF NOT EXISTS open_games (id TEXT PRIMARY KEY, stake INTEGER NOT NULL, created_at INTEGER NOT NULL);
    `);
    this.migrate();
    this.refundOpenGames();
  }

  /**
   * Games live in memory, so a game still open when the server stopped or crashed was never settled.
   * Give every player their entry fee back.
   */
  refundOpenGames(): number {
    const open = this.sql.prepare('SELECT id FROM open_games').all() as { id: string }[];
    for (const { id } of open) {
      this.tx(() => {
        const entries = this.sql.prepare("SELECT user_id, amount FROM coin_tx WHERE ref = ? AND reason = 'entry'").all(id) as { user_id: string; amount: number }[];
        for (const e of entries) {
          if (this.getUser(e.user_id)) this.addCoinsRaw(e.user_id, -e.amount, 'refund', id);
        }
        this.sql.prepare('DELETE FROM open_games WHERE id = ?').run(id);
      });
    }
    return open.length;
  }

  /** Adds columns introduced after the first release and backfills them. */
  private migrate(): void {
    const cols = new Set((this.sql.prepare('PRAGMA table_info(users)').all() as { name: string }[]).map((c) => c.name));
    if (!cols.has('player_id')) this.sql.exec('ALTER TABLE users ADD COLUMN player_id TEXT');
    if (!cols.has('banned')) this.sql.exec('ALTER TABLE users ADD COLUMN banned INTEGER NOT NULL DEFAULT 0');
    if (!cols.has('tester')) this.sql.exec('ALTER TABLE users ADD COLUMN tester INTEGER NOT NULL DEFAULT 0');
    const missing = this.sql.prepare('SELECT id FROM users WHERE player_id IS NULL').all() as { id: string }[];
    for (const { id } of missing) this.sql.prepare('UPDATE users SET player_id = ? WHERE id = ?').run(this.freePlayerId(), id);
    this.sql.exec('CREATE UNIQUE INDEX IF NOT EXISTS users_player_id ON users (player_id)');
  }

  private freePlayerId(): string {
    for (;;) {
      const pid = makePlayerId();
      if (!this.sql.prepare('SELECT 1 FROM users WHERE player_id = ?').get(pid)) return pid;
    }
  }

  close(): void {
    try { this.sql.close(); } catch { /* already closed */ }
  }

  tx<T>(fn: () => T): T {
    this.sql.exec('BEGIN IMMEDIATE');
    try {
      const r = fn();
      this.sql.exec('COMMIT');
      return r;
    } catch (e) {
      this.sql.exec('ROLLBACK');
      throw e;
    }
  }

  getUser(id: string): UserRow | undefined {
    return this.sql.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
  }

  getByDevice(deviceId: string): UserRow | undefined {
    return this.sql.prepare('SELECT * FROM users WHERE device_id = ?').get(deviceId) as UserRow | undefined;
  }

  createUser(deviceId: string, name: string, avatar: number): UserRow {
    const id = randomUUID();
    const now = Date.now();
    this.tx(() => {
      this.sql.prepare('INSERT INTO users (id, device_id, name, avatar, coins, created_at, player_id) VALUES (?, ?, ?, ?, 0, ?, ?)')
        .run(id, deviceId, name, avatar, now, this.freePlayerId());
      this.addCoinsRaw(id, this.cfg.startingCoins, 'signup', null);
    });
    return this.getUser(id)!;
  }

  updateUser(id: string, fields: Partial<Pick<UserRow, 'name' | 'avatar' | 'daily_streak' | 'last_daily_at' | 'last_free_at'>>): void {
    const keys = Object.keys(fields) as (keyof typeof fields)[];
    if (!keys.length) return;
    const set = keys.map((k) => `${k} = ?`).join(', ');
    this.sql.prepare(`UPDATE users SET ${set} WHERE id = ?`).run(...keys.map((k) => fields[k] as never), id);
  }

  /** Must run inside tx(). */
  private addCoinsRaw(userId: string, amount: number, reason: string, ref: string | null): void {
    if (!Number.isInteger(amount)) throw new Error('coin amount must be an integer');
    if (amount === 0) return;
    const r = this.sql.prepare('UPDATE users SET coins = coins + ? WHERE id = ? AND coins + ? >= 0').run(amount, userId, amount);
    if (r.changes !== 1) throw new InsufficientCoins();
    this.sql.prepare('INSERT INTO coin_tx (user_id, amount, reason, ref, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(userId, amount, reason, ref, Date.now());
  }

  /** The only way coins change: balance + ledger atomically, never negative. Throws InsufficientCoins. */
  addCoins(userId: string, amount: number, reason: string, ref: string | null = null): UserRow {
    this.tx(() => this.addCoinsRaw(userId, amount, reason, ref));
    return this.getUser(userId)!;
  }

  /** Coins plus arbitrary field updates in one transaction. */
  addCoinsWith(userId: string, amount: number, reason: string, ref: string | null, fields: Parameters<Db['updateUser']>[1]): UserRow {
    this.tx(() => {
      this.addCoinsRaw(userId, amount, reason, ref);
      this.updateUser(userId, fields);
    });
    return this.getUser(userId)!;
  }

  /** Charge several users at once. Returns ids that could not pay (they are not charged); others are charged. */
  chargeEntry(userIds: string[], stake: number, ref: string): { paid: string[]; failed: string[] } {
    const paid: string[] = [];
    const failed: string[] = [];
    this.tx(() => {
      for (const id of userIds) {
        const u = this.getUser(id);
        if (!u || u.coins < stake) { failed.push(id); continue; }
        this.addCoinsRaw(id, -stake, 'entry', ref);
        paid.push(id);
      }
      if (paid.length && stake > 0) this.sql.prepare('INSERT OR IGNORE INTO open_games (id, stake, created_at) VALUES (?, ?, ?)').run(ref, stake, Date.now());
    });
    return { paid, failed };
  }

  /** Refund entries (e.g. a game that could not start after all). */
  refund(userIds: string[], stake: number, ref: string): void {
    this.tx(() => {
      for (const id of userIds) this.addCoinsRaw(id, stake, 'refund', ref);
      this.sql.prepare('DELETE FROM open_games WHERE id = ?').run(ref);
    });
  }

  /** `counted` false (free games, players who left) pays coins but does not add games/wins/XP. */
  settleGame(results: { userId: string; payout: number; rank: number; counted?: boolean }[], ref: string): void {
    this.tx(() => {
      for (const r of results) {
        if (r.payout > 0) this.addCoinsRaw(r.userId, r.payout, r.rank === 1 ? 'win' : 'prize', ref);
        if (r.counted === false) continue;
        this.sql.prepare('UPDATE users SET games = games + 1, wins = wins + ?, xp = xp + ? WHERE id = ?')
          .run(r.rank === 1 ? 1 : 0, 10 + (r.rank === 1 ? 30 : 0), r.userId);
      }
      this.sql.prepare('DELETE FROM open_games WHERE id = ?').run(ref);
    });
  }

  getByPlayerId(playerId: string): UserRow | undefined {
    return this.sql.prepare('SELECT * FROM users WHERE player_id = ?').get(playerId.trim().toUpperCase()) as UserRow | undefined;
  }

  setTester(userId: string, tester: boolean): void {
    this.sql.prepare('UPDATE users SET tester = ? WHERE id = ?').run(tester ? 1 : 0, userId);
  }

  setBanned(userId: string, banned: boolean): void {
    this.sql.prepare('UPDATE users SET banned = ? WHERE id = ?').run(banned ? 1 : 0, userId);
  }

  /** Owner user search by name, Player ID or id (most recent first). */
  searchUsers(query: string, limit = 30): UserRow[] {
    const q = query.trim();
    if (!q) return this.sql.prepare('SELECT * FROM users ORDER BY created_at DESC LIMIT ?').all(limit) as unknown as UserRow[];
    const like = `%${q.replace(/[%_\\]/g, (c) => '\\' + c)}%`;
    return this.sql.prepare("SELECT * FROM users WHERE name LIKE ? ESCAPE '\\' OR player_id = ? OR id = ? ORDER BY created_at DESC LIMIT ?")
      .all(like, q.toUpperCase(), q, limit) as unknown as UserRow[];
  }

  getSetting<T>(key: string): T | null {
    const r = this.sql.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
    if (!r) return null;
    try { return JSON.parse(r.value) as T; } catch { return null; }
  }

  setSetting(key: string, value: unknown): void {
    this.sql.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value').run(key, JSON.stringify(value));
  }

  /** Remember that these humans played together (each sees the others as recent players). */
  recordCoPlayers(userIds: string[]): void {
    if (userIds.length < 2) return;
    const now = Date.now();
    const stmt = this.sql.prepare('INSERT INTO recent_players (user_id, other_id, played_at) VALUES (?, ?, ?) ON CONFLICT (user_id, other_id) DO UPDATE SET played_at = excluded.played_at');
    this.tx(() => {
      for (const a of userIds) for (const b of userIds) if (a !== b) stmt.run(a, b, now);
    });
  }

  recentPlayers(userId: string, limit = 20): UserRow[] {
    return this.sql.prepare('SELECT u.* FROM recent_players r JOIN users u ON u.id = r.other_id WHERE r.user_id = ? ORDER BY r.played_at DESC LIMIT ?')
      .all(userId, limit) as unknown as UserRow[];
  }

  /** Permanently removes the user and their coin history. */
  deleteUser(userId: string): void {
    this.tx(() => {
      this.sql.prepare('DELETE FROM recent_players WHERE user_id = ? OR other_id = ?').run(userId, userId);
      this.sql.prepare('DELETE FROM coin_tx WHERE user_id = ?').run(userId);
      this.sql.prepare('DELETE FROM users WHERE id = ?').run(userId);
    });
  }

  ledger(userId: string): { amount: number; reason: string; ref: string | null }[] {
    return this.sql.prepare('SELECT amount, reason, ref FROM coin_tx WHERE user_id = ? ORDER BY id').all(userId) as never;
  }

  /** Totals for the owner overview. `since` = start of "today" (epoch ms). */
  stats(since: number): { users: number; newToday: number; banned: number; coins: number; matchesToday: number; matchesTotal: number; top: UserRow[]; newest: UserRow[] } {
    const one = (q: string, ...a: (number | string)[]) => Number((this.sql.prepare(q).get(...a) as { n: number | null }).n ?? 0);
    return {
      users: one('SELECT COUNT(*) AS n FROM users'),
      newToday: one('SELECT COUNT(*) AS n FROM users WHERE created_at >= ?', since),
      banned: one('SELECT COUNT(*) AS n FROM users WHERE banned = 1'),
      coins: one('SELECT SUM(coins) AS n FROM users'),
      matchesToday: one("SELECT COUNT(DISTINCT ref) AS n FROM coin_tx WHERE reason = 'entry' AND created_at >= ?", since),
      matchesTotal: one("SELECT COUNT(DISTINCT ref) AS n FROM coin_tx WHERE reason = 'entry'"),
      top: this.sql.prepare('SELECT * FROM users WHERE banned = 0 ORDER BY wins DESC, coins DESC LIMIT 5').all() as unknown as UserRow[],
      newest: this.sql.prepare('SELECT * FROM users ORDER BY created_at DESC LIMIT 5').all() as unknown as UserRow[],
    };
  }

  leaderboard(): LeaderboardEntry[] {
    const rows = this.sql.prepare('SELECT id, name, avatar, xp, wins, coins FROM users WHERE banned = 0 ORDER BY wins DESC, coins DESC LIMIT 50').all() as unknown as UserRow[];
    return rows.map((r) => ({ id: r.id, name: r.name, avatar: r.avatar, level: levelForXp(r.xp), wins: r.wins, coins: r.coins }));
  }

  profile(u: UserRow, now = Date.now()): Profile {
    const cfg = this.cfg;
    const DAY = 86_400_000;
    const nextDailyAt = u.last_daily_at !== null && now - u.last_daily_at < DAY ? u.last_daily_at + DAY : null;
    const cooldown = cfg.freeCoinsCooldownMinutes * 60_000;
    const nextFreeCoinsAt = u.last_free_at !== null && now - u.last_free_at < cooldown ? u.last_free_at + cooldown : null;
    return {
      id: u.id, tester: !!u.tester, playerId: u.player_id, name: u.name, avatar: u.avatar, coins: u.coins, wins: u.wins, games: u.games, xp: u.xp,
      level: levelForXp(u.xp), dailyStreak: u.daily_streak, nextDailyAt, nextFreeCoinsAt,
    };
  }
}
