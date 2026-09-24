import { seatColors } from '@ludo/engine';
import type { Hub } from './hub.js';
import { UserError } from './errors.js';

interface Waiter { userId: string; since: number }
interface Queue { players: 2 | 4; stake: number; waiting: Waiter[] }

export class Matchmaker {
  private queues = new Map<string, Queue>();
  private ticker: NodeJS.Timeout;

  constructor(private hub: Hub) {
    this.ticker = setInterval(() => {
      try { this.tick(); } catch (e) { hub.cfg.log('queue tick error', e); }
    }, hub.cfg.queueTickMs);
    this.ticker.unref();
  }

  join(userId: string, players: unknown, stake: unknown): void {
    const hub = this.hub;
    if (players !== 2 && players !== 4) throw new UserError('Players must be 2 or 4');
    if (typeof stake !== 'number' || !hub.cfg.stakes.includes(stake)) throw new UserError('Invalid stake');
    hub.assertFree(userId);
    const u = hub.db.getUser(userId);
    if (!u || u.coins < stake) throw new UserError('Not enough coins');
    const key = `${players}:${stake}`;
    let q = this.queues.get(key);
    if (!q) this.queues.set(key, (q = { players, stake, waiting: [] }));
    q.waiting.push({ userId, since: Date.now() });
    hub.where.set(userId, { kind: 'queue', key });
    this.status(q);
    // Defer so the join ack reaches the client before game:start.
    setImmediate(() => { try { this.process(key); } catch (e) { hub.cfg.log('queue error', e); } });
  }

  leave(userId: string): void {
    const w = this.hub.where.get(userId);
    if (w?.kind !== 'queue') return;
    this.hub.where.delete(userId);
    const q = this.queues.get(w.key);
    if (!q) return;
    q.waiting = q.waiting.filter((x) => x.userId !== userId);
    if (!q.waiting.length) this.queues.delete(w.key);
    else this.status(q);
  }

  private status(q: Queue): void {
    const now = Date.now();
    for (const w of q.waiting) {
      this.hub.emitToUser(w.userId, 'queue:status', {
        players: q.players, stake: q.stake, found: q.waiting.length, elapsed: Math.floor((now - w.since) / 1000),
      });
    }
  }

  private process(key: string): void {
    const q = this.queues.get(key);
    if (!q || this.hub.closed) return;
    // Full tables of humans first.
    while (q.waiting.length >= q.players) this.launch(q, q.waiting.splice(0, q.players));
    if (q.waiting.length && Date.now() - q.waiting[0].since >= this.hub.cfg.botFillSeconds * 1000) {
      this.launch(q, q.waiting.splice(0, q.waiting.length));
    }
    if (!q.waiting.length) this.queues.delete(key);
  }

  private launch(q: Queue, group: Waiter[]): void {
    const ids = group.map((w) => w.userId);
    for (const id of ids) this.hub.where.delete(id);
    const game = this.hub.startGame({ humans: ids, colors: seatColors(q.players), stake: q.stake, shuffle: true, minHumans: 1 });
    if (!game) for (const id of ids) this.hub.emitToUser(id, 'notice', { message: 'Could not start the match' });
  }

  private tick(): void {
    for (const key of [...this.queues.keys()]) {
      this.process(key);
      const q = this.queues.get(key);
      if (q) this.status(q);
    }
  }

  close(): void {
    clearInterval(this.ticker);
  }
}
