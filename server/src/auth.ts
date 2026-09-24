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
