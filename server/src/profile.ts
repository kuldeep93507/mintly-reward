import { AVATAR_COUNT, NAME_MAX } from '@ludo/engine';
import type { Config } from './config.js';
import type { Db, UserRow } from './db.js';

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function sanitizeName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  // eslint-disable-next-line no-control-regex
  const s = raw.replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2066-\u2069\ufeff]/g, '').replace(/\s+/g, ' ').trim();
  const chars = Array.from(s).slice(0, NAME_MAX).join('').trim();
  return chars || null;
}

export function defaultName(): string {
  return `Player${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`;
}

export function validAvatar(a: unknown): a is number {
  return Number.isInteger(a) && (a as number) >= 0 && (a as number) < AVATAR_COUNT;
}

const DAY = 86_400_000;

export function claimDaily(db: Db, cfg: Config, userId: string, now = Date.now()): { user: UserRow; reward: number } {
  const u = db.getUser(userId);
  if (!u) throw new HttpError(404, 'User not found');
  if (u.last_daily_at !== null && now - u.last_daily_at < DAY) throw new HttpError(429, 'Daily reward already claimed');
  const continues = u.last_daily_at !== null && now - u.last_daily_at < 2 * DAY;
  const streak = continues ? u.daily_streak + 1 : 1;
  const reward = cfg.dailyRewards[(streak - 1) % cfg.dailyRewards.length];
  const user = db.addCoinsWith(userId, reward, 'daily', `day${streak}`, { daily_streak: streak, last_daily_at: now });
  return { user, reward };
}

export function claimFree(db: Db, cfg: Config, userId: string, now = Date.now()): { user: UserRow; reward: number } {
  const u = db.getUser(userId);
  if (!u) throw new HttpError(404, 'User not found');
  if (u.coins >= cfg.freeCoinsBelow) throw new HttpError(400, `Free coins are only available below ${cfg.freeCoinsBelow} coins`);
  if (u.last_free_at !== null && now - u.last_free_at < cfg.freeCoinsCooldownMinutes * 60_000) {
    throw new HttpError(429, 'Free coins are cooling down');
  }
  const reward = cfg.freeCoins;
  const user = db.addCoinsWith(userId, reward, 'free', null, { last_free_at: now });
  return { user, reward };
}
