import { randomInt } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export interface Config {
  port: number;
  host: string;
  dataDir: string;
  /** ':memory:' for tests. */
  dbFile?: string;
  secret?: string;
  /** Built Ludo Admin app served at /admin/ (ADMIN_DIR, default ../admin/dist next to the server package). */
  adminDir: string;
  /** Owner key for dice control (OWNER_KEY). Generated and saved in DATA_DIR/owner-key when unset. */
  ownerKey?: string;
  turnSeconds: number;
  /** Extra time added to each turn deadline for client animations. */
  animGraceMs: number;
  botFillSeconds: number;
  botDelayMs: number;
  startingCoins: number;
  stakes: number[];
  dailyRewards: number[];
  freeCoins: number;
  freeCoinsBelow: number;
  freeCoinsCooldownMinutes: number;
  maxMissedTurns: number;
  /** Seconds a disconnected room host has to come back before the room closes. */
  hostGraceSeconds: number;
  /** Delay before a finished game is dropped from memory. */
  gameCleanupMs: number;
  queueTickMs: number;
  /** Behind a reverse proxy (Render, Caddy): take the client IP from X-Forwarded-For (TRUST_PROXY=1). */
  trustProxy: boolean;
  /**
   * Owner dice control and "declare winner" for ONLINE matches between real players
   * (ONLINE_GAME_CONTROL=1). Off by default: secretly changing the outcome of other people's
   * matches misleads them and breaks store policies. Offline games and testing are unaffected.
   */
  onlineGameControl: boolean;
  /** New guest accounts allowed per IP per hour (SIGNUPS_PER_HOUR, 0 = unlimited). */
  signupsPerHour: number;
  /** Authoritative dice; injectable for tests. */
  rollDie: () => number;
  log: (...args: unknown[]) => void;
}

function num(name: string, def: number): number {
  const v = process.env[name];
  if (v === undefined || v === '') return def;
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

function list(name: string, def: number[]): number[] {
  const v = process.env[name];
  if (!v) return def;
  const arr = v.split(',').map((s) => Number(s.trim())).filter((n) => Number.isInteger(n) && n > 0);
  return arr.length ? arr : def;
}

/** Client IP of a request/handshake, honouring X-Forwarded-For only when TRUST_PROXY is on. */
export function clientIp(cfg: Pick<Config, 'trustProxy'>, headers: Record<string, string | string[] | undefined>, direct: string | undefined): string {
  if (cfg.trustProxy) {
    const xff = headers['x-forwarded-for'];
    const first = String(Array.isArray(xff) ? xff[0] : xff ?? '').split(',')[0].trim();
    if (first) return first;
  }
  return direct ?? 'unknown';
}

export function loadConfig(overrides: Partial<Config> = {}): Config {
  return {
    port: num('PORT', 3000),
    host: process.env.HOST || '0.0.0.0',
    dataDir: process.env.DATA_DIR || './data',
    secret: process.env.SERVER_SECRET || undefined,
    ownerKey: process.env.OWNER_KEY || undefined,
    adminDir: process.env.ADMIN_DIR || fileURLToPath(new URL('../../admin/dist', import.meta.url)),
    turnSeconds: num('TURN_SECONDS', 15),
    animGraceMs: num('ANIM_GRACE_MS', 1500),
    botFillSeconds: num('BOT_FILL_SECONDS', 12),
    botDelayMs: num('BOT_DELAY_MS', 900),
    startingCoins: num('STARTING_COINS', 1000),
    stakes: list('STAKES', [100, 250, 500, 1000, 2500, 5000, 10000]),
    dailyRewards: list('DAILY_REWARDS', [100, 150, 200, 300, 400, 500, 1000]),
    freeCoins: num('FREE_COINS', 500),
    freeCoinsBelow: num('FREE_COINS_BELOW', 100),
    freeCoinsCooldownMinutes: num('FREE_COINS_COOLDOWN_MINUTES', 60),
    maxMissedTurns: num('MAX_MISSED_TURNS', 3),
    hostGraceSeconds: num('HOST_GRACE_SECONDS', 30),
    gameCleanupMs: 30_000,
    queueTickMs: 1000,
    trustProxy: /^(1|true|yes)$/i.test(process.env.TRUST_PROXY ?? ''),
    signupsPerHour: num('SIGNUPS_PER_HOUR', 20),
    onlineGameControl: /^(1|true|yes)$/i.test(process.env.ONLINE_GAME_CONTROL ?? ''),
    rollDie: () => randomInt(1, 7),
    log: (...a) => console.log(new Date().toISOString(), ...a),
    ...overrides,
  };
}
