import { afterEach, describe, expect, it } from 'vitest';
import type { GameInfo, RoomInfo } from '@ludo/engine';
import { type Client, autoplay, connect, emitAck, guest, once, startServer, type TestServer } from './helpers.js';

let srv: TestServer | undefined;
const sockets: Client[] = [];
afterEach(async () => {
  for (const s of sockets.splice(0)) s.close();
  await srv?.close();
  srv = undefined;
});

async function player(url: string): Promise<{ s: Client; id: string; token: string }> {
  const a = await guest(url);
  const s = await connect(url, a.token);
  sockets.push(s);
  return { s, id: a.profile.id, token: a.token };
}

describe('quick match', () => {
  it('two humans play a full 2-player game; stakes deducted and paid', async () => {
    srv = await startServer({ botFillSeconds: 60 });
    const a = await player(srv.url);
    const b = await player(srv.url);
    const status = once(a.s, 'queue:status');
    expect(await emitAck(a.s, 'queue:join', { players: 2, stake: 100 })).toEqual({ ok: true });
    expect(await status).toMatchObject({ players: 2, stake: 100, found: 1 });
    expect((await emitAck(a.s, 'queue:join', { players: 2, stake: 100 })).ok).toBe(false);
    expect((await emitAck(b.s, 'queue:join', { players: 2, stake: 123 })).ok).toBe(false);
    const startA = once(a.s, 'game:start');
    const startB = once(b.s, 'game:start');
    const profB = once(b.s, 'profile');
    expect((await emitAck(b.s, 'queue:join', { players: 2, stake: 100 })).ok).toBe(true);
    const [ga, gb] = await Promise.all([startA, startB]);
    expect((await profB).coins).toBe(900);
    expect(ga.gameId).toBe(gb.gameId);
    expect(new Set([ga.you, gb.you])).toEqual(new Set(['red', 'yellow']));
    expect(ga.seats.every((s) => !s.isBot)).toBe(true);
    expect(ga.prizes).toEqual([200, 0]);

    const overA = once(a.s, 'game:over');
    const overB = once(b.s, 'game:over');
    autoplay(a.s, ga);
    autoplay(b.s, gb);
    const [ra, rb] = await Promise.all([overA, overB]);
    expect(ra.ranking).toHaveLength(2);
    const winner = ra.ranking[0];
    expect(ra.payouts[winner]).toBe(200);
    const [pw, pl] = winner === ga.you ? [ra.profile, rb.profile] : [rb.profile, ra.profile];
    expect(pw).toMatchObject({ coins: 1100, wins: 1, games: 1, xp: 40 });
    expect(pl).toMatchObject({ coins: 900, wins: 0, games: 1, xp: 10 });
    const ledger = srv.app.db.ledger(pw.id);
    expect(ledger.map((l) => [l.amount, l.reason])).toEqual([[1000, 'signup'], [-100, 'entry'], [200, 'win']]);
    // Free again after the game.
    expect((await emitAck(a.s, 'queue:join', { players: 2, stake: 100 })).ok).toBe(true);
  });

  it('fills empty seats with bots for a lone human', async () => {
    srv = await startServer({ botFillSeconds: 0.2 });
    const a = await player(srv.url);
    const start = once(a.s, 'game:start');
    expect((await emitAck(a.s, 'queue:join', { players: 4, stake: 250 })).ok).toBe(true);
    const g = await start;
    expect(g.seats).toHaveLength(4);
    expect(g.seats.filter((s) => s.isBot)).toHaveLength(3);
    expect(g.seats.find((s) => !s.isBot)!.userId).toBe(a.id);
    expect(g.prizes).toEqual([750, 250, 0, 0]);
    const over = once(a.s, 'game:over');
    autoplay(a.s, g);
    const r = await over;
    const rank = r.ranking.indexOf(g.you);
    expect(r.profile.coins).toBe(1000 - 250 + [750, 250, 0, 0][rank]);
    expect(Object.keys(r.payouts)).toEqual([g.you]);
  });
});

describe('private rooms', () => {
  it('create, join, start seats in join order', async () => {
    srv = await startServer();
    const h = await player(srv.url);
    const g = await player(srv.url);
    const c = await emitAck<{ ok: boolean; room: RoomInfo }>(h.s, 'room:create', { maxPlayers: 2, stake: 0 });
    expect(c.ok).toBe(true);
    expect(c.room.code).toMatch(/^\d{6}$/);
    expect((await emitAck(g.s, 'room:join', { code: '000000' })).ok).toBe(false);
    expect((await emitAck(h.s, 'room:start')).ok).toBe(false); // only 1 member
    const upd = once(h.s, 'room:update', (r) => r.members.length === 2);
    const j = await emitAck<{ ok: boolean; room: RoomInfo }>(g.s, 'room:join', { code: c.room.code });
    expect(j.ok).toBe(true);
    await upd;
    const third = await player(srv.url);
    expect(await emitAck(third.s, 'room:join', { code: c.room.code })).toEqual({ ok: false, error: 'Room is full' });
    expect((await emitAck(g.s, 'room:start')).ok).toBe(false); // not host
    const sh = once(h.s, 'game:start');
    const sg = once(g.s, 'game:start');
    expect((await emitAck(h.s, 'room:start')).ok).toBe(true);
    expect((await sh).you).toBe('red');
    expect((await sg).you).toBe('yellow');
  });

  it('host leaving closes the room', async () => {
    srv = await startServer();
    const h = await player(srv.url);
    const g = await player(srv.url);
    const c = await emitAck<{ ok: boolean; room: RoomInfo }>(h.s, 'room:create', { maxPlayers: 4, stake: 100 });
    await emitAck(g.s, 'room:join', { code: c.room.code });
    const closed = once(g.s, 'room:closed');
    h.s.emit('room:leave');
    expect((await closed).reason).toMatch(/host/i);
    expect((await emitAck(g.s, 'queue:join', { players: 2, stake: 100 })).ok).toBe(true);
  });
});

async function roomGame(): Promise<{ h: Awaited<ReturnType<typeof player>>; g: Awaited<ReturnType<typeof player>>; gh: GameInfo; gg: GameInfo }> {
  const h = await player(srv!.url);
  const g = await player(srv!.url);
  const c = await emitAck<{ ok: boolean; room: RoomInfo }>(h.s, 'room:create', { maxPlayers: 2, stake: 100 });
  await emitAck(g.s, 'room:join', { code: c.room.code });
  const sh = once(h.s, 'game:start');
  const sg = once(g.s, 'game:start');
  await emitAck(h.s, 'room:start');
  return { h, g, gh: await sh, gg: await sg };
}

describe('game rules enforcement', () => {
  it('rejects illegal and out-of-turn actions', async () => {
    srv = await startServer({ rollDie: () => 3 });
    const { h, g, gh } = await roomGame();
    const id = gh.gameId;
    expect(await emitAck(h.s, 'game:move', { gameId: id, token: 0 })).toEqual({ ok: false, error: 'Not time to move' });
    expect(await emitAck(g.s, 'game:roll', { gameId: id })).toEqual({ ok: false, error: 'Not your turn' });
    expect((await emitAck(h.s, 'game:roll', { gameId: 'stale' })).ok).toBe(false);
    expect((await emitAck(h.s, 'game:move', { gameId: id, token: 'x' })).ok).toBe(false);
    expect((await emitAck(h.s, 'game:roll', null)).ok).toBe(false);
    const st = once(g.s, 'game:state');
    expect(await emitAck(h.s, 'game:roll', { gameId: id })).toEqual({ ok: true });
    const u = await st;
    // A 3 with every token in the yard: no moves, turn passes to yellow.
    expect(u.state.last).toMatchObject({ type: 'roll', value: 3, skipped: true });
    expect(u.state.players[u.state.turn].color).toBe('yellow');
    expect(u.deadline).toBeGreaterThan(u.serverNow);
    const react = once(h.s, 'game:react');
    g.s.emit('game:react', { gameId: id, text: '👍' });
    expect(await react).toEqual({ gameId: id, color: 'yellow', text: '👍' });
  });

  it('auto-plays timed-out turns and removes a player after 3 misses', async () => {
    srv = await startServer({ turnSeconds: 0.1, rollDie: () => 2 });
    const { h, g, gh } = await roomGame();
    const notice = once(g.s, 'notice');
    const overG = once(g.s, 'game:over');
    const missed = once(g.s, 'game:state', (u) => u.missed.red === 1);
    await missed;
    expect((await notice).message).toMatch(/removed/);
    const r = await overG;
    // Red (host) moves first, so reaches 3 misses first.
    expect(r.ranking).toEqual(['yellow', 'red']);
    expect(r.payouts).toEqual({ yellow: 200, red: 0 });
    expect(r.profile.coins).toBe(1100);
    expect(srv.app.db.getUser(h.id)!.coins).toBe(900);
    expect(gh.you).toBe('red');
  });

  it('resends game:start on reconnect and tracks connection', async () => {
    srv = await startServer();
    const { h, g, gh } = await roomGame();
    const seen = once(g.s, 'game:state', (u) => u.seats.some((s) => s.userId === h.id && !s.connected));
    h.s.close();
    await seen;
    let againP!: Promise<GameInfo>;
    const s2 = await connect(srv.url, h.token, (s) => { againP = once(s, 'game:start'); });
    sockets.push(s2);
    const again = await againP;
    expect(again.gameId).toBe(gh.gameId);
    expect(again.you).toBe('red');
    const back = await once(g.s, 'game:state', (u) => u.seats.every((s) => s.connected));
    expect(back.gameId).toBe(gh.gameId);
    // Sync request also works.
    const sync = once(s2, 'game:start');
    s2.emit('game:sync', { gameId: gh.gameId });
    expect((await sync).gameId).toBe(gh.gameId);
    // Leaving forfeits.
    const over = once(g.s, 'game:over');
    s2.emit('game:leave', { gameId: gh.gameId });
    expect((await over).ranking).toEqual(['yellow', 'red']);
  });
});

describe('account deletion', () => {
  it('DELETE /api/me forfeits the game, disconnects and wipes the account', async () => {
    srv = await startServer();
    const { h, g, gh } = await roomGame();
    const over = once(g.s, 'game:over');
    const gone = new Promise<void>((r) => h.s.once('disconnect', () => r()));
    const res = await fetch(`${srv.url}/api/me`, { method: 'DELETE', headers: { Authorization: `Bearer ${h.token}` } });
    expect(await res.json()).toEqual({ ok: true });
    await gone;
    const r = await over;
    expect(r.gameId).toBe(gh.gameId);
    expect(r.ranking).toEqual(['yellow', 'red']);
    expect(r.profile.coins).toBe(1100);
    expect(srv.app.db.getUser(h.id)).toBeUndefined();
    expect(srv.app.db.ledger(h.id)).toEqual([]);
    expect((await fetch(`${srv.url}/api/me`, { headers: { Authorization: `Bearer ${h.token}` } })).status).toBe(401);
  });

  it('same deviceId gets a brand-new account after deletion', async () => {
    srv = await startServer();
    const deviceId = 'delete-me-device-1';
    const a = await guest(srv.url, { deviceId });
    await fetch(`${srv.url}/api/me`, { method: 'DELETE', headers: { Authorization: `Bearer ${a.token}` } });
    const b = await guest(srv.url, { deviceId });
    expect(b.profile.id).not.toBe(a.profile.id);
    expect(b.profile.coins).toBe(1000);
  });
});
