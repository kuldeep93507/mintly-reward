import { createServer, type Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Server } from 'socket.io';
import { type Config, loadConfig } from './config.js';
import { Db } from './db.js';
import { Auth, resolveOwnerKey, resolveSecret } from './auth.js';
import { createHandler } from './http.js';
import { Hub, type IO } from './hub.js';
import { OwnerControl, applySavedConfig } from './owner.js';

export interface App {
  cfg: Config;
  db: Db;
  owner: OwnerControl;
  hub: Hub;
  http: HttpServer;
  io: IO;
  auth: Auth;
  /** Resolves with the bound port. */
  listen(port?: number, host?: string): Promise<number>;
  close(): Promise<void>;
}

export function createApp(overrides: Partial<Config> = {}): App {
  const cfg = loadConfig(overrides);
  const db = new Db(cfg);
  applySavedConfig({ cfg, db });
  const auth = new Auth(resolveSecret(cfg));
  const ownerKey = resolveOwnerKey(cfg);
  cfg.ownerKey = ownerKey.key;
  if (ownerKey.generated && ownerKey.file) cfg.log(`OWNER_KEY not set; owner key is ${ownerKey.key} (saved in ${ownerKey.file}). Open /admin/ to use it.`);
  let hub: Hub | undefined;
  const http = createServer(createHandler({ cfg, db, auth, onProfile: (id) => hub?.sendProfile(id), onDelete: (id) => hub!.deleteUser(id) }));
  const io: IO = new Server(http, {
    cors: { origin: true, credentials: false },
    pingInterval: 20_000,
    pingTimeout: 20_000,
    maxHttpBufferSize: 16 * 1024,
  });
  hub = new Hub(io, db, cfg, auth);
  const owner = new OwnerControl(hub);

  return {
    cfg, db, hub, http, io, auth, owner,
    listen(port = cfg.port, host = cfg.host) {
      return new Promise((resolve, reject) => {
        http.once('error', reject);
        http.listen(port, host, () => resolve((http.address() as AddressInfo).port));
      });
    },
    async close() {
      hub!.close();
      await new Promise<void>((r) => io.close(() => r()));
      db.close();
    },
  };
}
