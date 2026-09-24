import { createApp } from './app.js';

const app = createApp();
const port = await app.listen();
app.cfg.log(`Ludo Mintly server listening on http://${app.cfg.host}:${port} (data: ${app.cfg.dataDir})`);

let stopping = false;
async function shutdown(signal: string): Promise<void> {
  if (stopping) return;
  stopping = true;
  app.cfg.log(`${signal} received, shutting down`);
  const force = setTimeout(() => process.exit(1), 10_000);
  force.unref();
  try {
    await app.close();
  } finally {
    process.exit(0);
  }
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('unhandledRejection', (e) => app.cfg.log('unhandledRejection', e));
process.on('uncaughtException', (e) => app.cfg.log('uncaughtException', e));
