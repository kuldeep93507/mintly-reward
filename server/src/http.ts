import type { IncomingMessage, ServerResponse } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { PROTOCOL_VERSION, type GlobalTheme, type ServerConfig } from '@ludo/engine';
import type { Config } from './config.js';
import type { Db } from './db.js';
import type { Auth } from './auth.js';
import { HttpError, claimDaily, claimFree, defaultName, sanitizeName, validAvatar } from './profile.js';

export interface HttpDeps {
  cfg: Config;
  db: Db;
  auth: Auth;
  /** Called when a profile changed over REST so connected sockets can be told. */
  onProfile: (userId: string) => void;
  /** Account deletion (leaves queue/room/game, disconnects, deletes rows). */
  onDelete: (userId: string) => void;
}

const MAX_BODY = 16 * 1024;

function send(res: ServerResponse, status: number, body: unknown): void {
  const data = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(data), 'Cache-Control': 'no-store' });
  res.end(data);
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const c of req) {
    size += (c as Buffer).length;
    if (size > MAX_BODY) throw new HttpError(413, 'Body too large');
    chunks.push(c as Buffer);
  }
  if (!size) return {};
  let v: unknown;
  try { v = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new HttpError(400, 'Invalid JSON'); }
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new HttpError(400, 'Expected a JSON object');
  return v as Record<string, unknown>;
}

export function serverConfig(cfg: Config, db: Db): ServerConfig {
  return {
    protocol: PROTOCOL_VERSION,
    stakes: cfg.stakes,
    turnSeconds: cfg.turnSeconds,
    startingCoins: cfg.startingCoins,
    dailyRewards: cfg.dailyRewards,
    freeCoins: cfg.freeCoins,
    freeCoinsBelow: cfg.freeCoinsBelow,
    freeCoinsCooldownMinutes: cfg.freeCoinsCooldownMinutes,
    maxMissedTurns: cfg.maxMissedTurns,
    botFillSeconds: cfg.botFillSeconds,
    theme: db.getSetting<GlobalTheme>('theme') ?? { board: null, dice: null, locked: false },
  };
}

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json', '.woff2': 'font/woff2', '.woff': 'font/woff',
};

/** Static files of the Ludo Admin app (admin/dist) under /admin/. */
async function serveAdmin(cfg: Config, raw: string, res: ServerResponse): Promise<void> {
  if (raw === '/admin') {
    res.writeHead(301, { Location: '/admin/' });
    res.end();
    return;
  }
  const root = resolve(cfg.adminDir);
  let rel: string;
  try { rel = decodeURIComponent(raw.slice('/admin/'.length)) || 'index.html'; } catch { throw new HttpError(400, 'Bad path'); }
  let file = resolve(root, normalize(rel));
  if (file !== root && !file.startsWith(root + sep)) throw new HttpError(404, 'Not found');
  try {
    if (!(await stat(file)).isFile()) file = join(root, 'index.html');
  } catch {
    file = join(root, 'index.html');
  }
  let data: Buffer;
  try { data = await readFile(file); } catch { throw new HttpError(404, 'Admin app not built (run npm run build -w server)'); }
  const hashed = file.includes(`${sep}assets${sep}`);
  res.writeHead(200, {
    'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream',
    'Content-Length': data.length,
    'Cache-Control': hashed ? 'public, max-age=31536000, immutable' : 'no-cache',
  });
  res.end(data);
}

export function createHandler(d: HttpDeps) {
  const { cfg, db, auth } = d;

  function requireUser(req: IncomingMessage): string {
    const h = req.headers.authorization;
    const m = typeof h === 'string' ? /^Bearer\s+(.+)$/i.exec(h) : null;
    const id = m ? auth.verify(m[1].trim()) : null;
    if (!id || !db.getUser(id)) throw new HttpError(401, 'unauthorized');
    if (db.getUser(id)!.banned) throw new HttpError(403, 'This account is banned');
    return id;
  }

  async function route(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const raw = new URL(req.url ?? '/', 'http://x').pathname;
    if (req.method === 'GET' && (raw === '/admin' || raw.startsWith('/admin/'))) return serveAdmin(cfg, raw, res);
    const path = raw.replace(/\/+$/, '') || '/';
    const key = `${req.method} ${path}`;
    switch (key) {
      case 'GET /':
      case 'GET /health':
        return send(res, 200, { ok: true });
      case 'GET /api/config':
        return send(res, 200, serverConfig(cfg, db));
      case 'POST /api/auth/guest': {
        const body = await readJson(req);
        const deviceId = body.deviceId;
        if (typeof deviceId !== 'string' || deviceId.length < 8 || deviceId.length > 128 || !/^[\w.:-]+$/.test(deviceId)) {
          throw new HttpError(400, 'Invalid deviceId');
        }
        let u = db.getByDevice(deviceId);
        if (!u) {
          const name = sanitizeName(body.name) ?? defaultName();
          const avatar = validAvatar(body.avatar) ? body.avatar : Math.floor(Math.random() * 12);
          try {
            u = db.createUser(deviceId, name, avatar);
            cfg.log('new user', u.id, JSON.stringify(u.name));
          } catch {
            u = db.getByDevice(deviceId); // lost a race with a concurrent signup
            if (!u) throw new HttpError(500, 'Could not create user');
          }
        }
        if (u.banned) throw new HttpError(403, 'This account is banned');
        return send(res, 200, { token: auth.sign(u.id), profile: db.profile(u) });
      }
      case 'GET /api/me': {
        const id = requireUser(req);
        return send(res, 200, { profile: db.profile(db.getUser(id)!) });
      }
      case 'PATCH /api/me': {
        const id = requireUser(req);
        const body = await readJson(req);
        const fields: { name?: string; avatar?: number } = {};
        if (body.name !== undefined) {
          const n = sanitizeName(body.name);
          if (!n) throw new HttpError(400, 'Invalid name');
          fields.name = n;
        }
        if (body.avatar !== undefined) {
          if (!validAvatar(body.avatar)) throw new HttpError(400, 'Invalid avatar');
          fields.avatar = body.avatar;
        }
        db.updateUser(id, fields);
        d.onProfile(id);
        return send(res, 200, { profile: db.profile(db.getUser(id)!) });
      }
      case 'DELETE /api/me': {
        const id = requireUser(req);
        d.onDelete(id);
        return send(res, 200, { ok: true });
      }
      case 'POST /api/daily':
      case 'POST /api/free-coins': {
        const id = requireUser(req);
        const r = key === 'POST /api/daily' ? claimDaily(db, cfg, id) : claimFree(db, cfg, id);
        d.onProfile(id);
        return send(res, 200, { profile: db.profile(r.user), reward: r.reward });
      }
      case 'GET /api/leaderboard':
        return send(res, 200, { top: db.leaderboard() });
      default:
        throw new HttpError(404, 'Not found');
    }
  }

  return (req: IncomingMessage, res: ServerResponse): void => {
    // socket.io handles its own path
    if (req.url?.startsWith('/socket.io')) return;
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.setHeader('Access-Control-Max-Age', '86400');
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
    route(req, res).catch((e: unknown) => {
      if (e instanceof HttpError) return send(res, e.status, { error: e.message });
      cfg.log('http error', req.method, req.url, e);
      if (!res.headersSent) send(res, 500, { error: 'Internal error' });
    });
  };
}
