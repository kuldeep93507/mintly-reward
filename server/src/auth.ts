import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Config } from './config.js';

export function resolveSecret(cfg: Config): string {
  if (cfg.secret) return cfg.secret;
  if (cfg.dbFile === ':memory:') return randomBytes(32).toString('hex');
  mkdirSync(cfg.dataDir, { recursive: true });
  const file = join(cfg.dataDir, 'secret');
  if (existsSync(file)) {
    const s = readFileSync(file, 'utf8').trim();
    if (s) return s;
  }
  const s = randomBytes(32).toString('hex');
  writeFileSync(file, s, { mode: 0o600 });
  return s;
}

/** OWNER_KEY, or a generated key persisted in DATA_DIR/owner-key. `generated` means it should be logged. */
export function resolveOwnerKey(cfg: Config): { key: string; generated: boolean; file: string | null } {
  if (cfg.ownerKey) return { key: cfg.ownerKey, generated: false, file: null };
  if (cfg.dbFile === ':memory:') return { key: randomBytes(9).toString('base64url'), generated: true, file: null };
  mkdirSync(cfg.dataDir, { recursive: true });
  const file = join(cfg.dataDir, 'owner-key');
  if (existsSync(file)) {
    const s = readFileSync(file, 'utf8').trim();
    if (s) return { key: s, generated: true, file };
  }
  const s = randomBytes(9).toString('base64url');
  writeFileSync(file, s, { mode: 0o600 });
  return { key: s, generated: true, file };
}

/** Constant-time string comparison. */
export function sameKey(a: unknown, b: string): boolean {
  if (typeof a !== 'string' || a.length > 200) return false;
  const x = createHmac('sha256', 'k').update(a).digest();
  const y = createHmac('sha256', 'k').update(b).digest();
  return timingSafeEqual(x, y);
}

export class Auth {
  constructor(private secret: string) {}

  private sig(userId: string): string {
    return createHmac('sha256', this.secret).update(userId).digest('base64url');
  }

  sign(userId: string): string {
    return `${userId}.${this.sig(userId)}`;
  }

  /** Returns the user id, or null for a bad token. */
  verify(token: unknown): string | null {
    if (typeof token !== 'string' || token.length > 200) return null;
    const i = token.lastIndexOf('.');
    if (i <= 0) return null;
    const id = token.slice(0, i);
    const a = Buffer.from(token.slice(i + 1));
    const b = Buffer.from(this.sig(id));
    return a.length === b.length && timingSafeEqual(a, b) ? id : null;
  }
}
