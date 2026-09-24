import { randomInt } from 'node:crypto';

export interface Config {
  port: number;
  host: string;
  dataDir: string;
  /** ':memory:' for tests. */
  dbFile?: string;
  secret?: string;
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

export function loadConfig(overrides: Partial<Config> = {}): Config {
  return {
    port: num('PORT', 3000),
    host: process.env.HOST || '0.0.0.0',
    dataDir: process.env.DATA_DIR || './data',
    secret: process.env.SERVER_SECRET || undefined,
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
    rollDie: () => randomInt(1, 7),
    log: (...a) => console.log(new Date().toISOString(), ...a),
    ...overrides,
  };
}
