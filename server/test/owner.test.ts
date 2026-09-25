import { afterEach, describe, expect, it } from 'vitest';
import { io as ioc, type Socket } from 'socket.io-client';
import { newGame, type GameInfo, type GameState, type OwnerSnapshot, type OwnerUser, type RoomInfo } from '@ludo/engine';
import { type Client, api, connect, emitAck, guest, once, startServer, type TestServer } from './helpers.js';

let srv: TestServer | undefined;
const sockets: Client[] = [];
const admins: Socket[] = [];
afterEach(async () => {
  for (const s of sockets.splice(0)) s.close();
  for (const s of admins.splice(0)) s.close();
  await srv?.close();
  srv = undefined;
});

const KEY = 'test-owner-key';

async function player(url: string) {
  const a = await guest(url);
  const s = await connect(url, a.token);
  sockets.push(s);
  return { s, id: a.profile.id, playerId: a.profile.playerId };
}

/** Host (red, moves first) and guest (yellow) in a started 2-player private room. */
async function roomGame(url: string) {
  const a = await player(url);
  const b = await player(url);
  const cr = await emitAck<{ ok: boolean; room: RoomInfo }>(a.s, 'room:create', { maxPlayers: 2, stake: 0 });
  expect((await emitAck(b.s, 'room:join', { code: cr.room.code })).ok).toBe(true);
  const ga = once(a.s, 'game:start');
  const gb = once(b.s, 'game:start');
  expect((await emitAck(a.s, 'room:start')).ok).toBe(true);
  const [ia, ib] = await Promise.all([ga, gb]);
  return { a, b, ia: ia as GameInfo, ib: ib as GameInfo };
}

/** A valid token for an existing user (tokens are signed by the server). */
async function guestToken(url: string, userId: string): Promise<string> {
  return srv!.app.auth.sign(userId);
}

const lastRoll = (s: Client, color: string) =>
  once(s, 'game:state', (u) => u.state.last.type === 'roll' && u.state.last.color === color);

type AdminClient = Socket;
function admin(url: string, key: string): Promise<AdminClient> {
  const s = ioc(`${url}/admin`, { auth: { key }, transports: ['websocket'], reconnection: false, forceNew: true });
  admins.push(s);
  return new Promise((resolve, reject) => {
    s.once('connect', () => resolve(s));
    s.once('connect_error', (e) => { s.close(); reject(e); });
  });
}
const adminAck = <T = { ok: boolean; error?: string }>(s: AdminClient, ev: string, ...args: unknown[]) =>
  new Promise<T>((resolve) => s.emit(ev, ...args, resolve));

describe('admin (owner) control', () => {
  it('rejects a wrong owner key', async () => {
    srv = await startServer({ ownerKey: KEY });
    await expect(admin(srv.url, 'wrong')).rejects.toThrow('unauthorized');
    await expect(admin(srv.url, '')).rejects.toThrow('unauthorized');
    const ok = await admin(srv.url, KEY);
    expect(ok.connected).toBe(true);
  });

  it('refuses online match control unless ONLINE_GAME_CONTROL is on (the production default)', async () => {
    srv = await startServer({ ownerKey: KEY, onlineGameControl: false });
    const { ia } = await roomGame(srv.url);
    const adm = await admin(srv.url, KEY);
    const snap = await adminAck<{ ok: boolean; snapshot: OwnerSnapshot }>(adm, 'owner:snapshot');
    expect(snap.snapshot.onlineControl).toBe(false);
    const dice = await adminAck<{ ok: boolean; error: string }>(adm, 'owner:dice', { gameId: ia.gameId, color: 'red', value: 6, mode: 'once' });
    expect(dice).toMatchObject({ ok: false, error: expect.stringContaining('turned off') });
    expect((await adminAck(adm, 'owner:endGame', { gameId: ia.gameId, winner: 'red' })).ok).toBe(false);
  });

  it('forces dice for any seat; values are used and nothing leaks to players', async () => {
    srv = await startServer({ ownerKey: KEY, rollDie: () => 1 });
    const { a, b, ia, ib } = await roomGame(srv.url);
    expect(ia.you).toBe('red');
    const seen: string[] = [];
    a.s.onAny((ev: string) => seen.push(ev));
    b.s.onAny((ev: string) => seen.push(ev));
    const adm = await admin(srv.url, KEY);

    const snap = await adminAck<{ ok: boolean; snapshot: OwnerSnapshot }>(adm, 'owner:snapshot');
    expect(snap.snapshot.games.map((g) => g.gameId)).toEqual([ia.gameId]);
    expect((await adminAck(adm, 'owner:dice', { gameId: ia.gameId, color: 'red', value: 9, mode: 'once' })).ok).toBe(false);
    expect((await adminAck(adm, 'owner:dice', { gameId: 'nope', color: 'red', value: 5, mode: 'once' })).ok).toBe(false);

    expect((await adminAck(adm, 'owner:dice', { gameId: ia.gameId, color: 'red', value: 5, mode: 'once' })).ok).toBe(true);
    let st = lastRoll(a.s, 'red');
    expect((await emitAck(a.s, 'game:roll', { gameId: ia.gameId })).ok).toBe(true);
    expect((await st).state.last).toMatchObject({ value: 5 });

    // Opponent forced once to 3; the override is consumed.
    expect((await adminAck(adm, 'owner:dice', { gameId: ia.gameId, color: 'yellow', value: 3, mode: 'once' })).ok).toBe(true);
    st = lastRoll(b.s, 'yellow');
    expect((await emitAck(b.s, 'game:roll', { gameId: ib.gameId })).ok).toBe(true);
    expect((await st).state.last).toMatchObject({ value: 3 });

    // Always 6 persists until cleared.
    expect((await adminAck(adm, 'owner:dice', { gameId: ia.gameId, color: 'red', value: null, mode: 'always6' })).ok).toBe(true);
    st = lastRoll(a.s, 'red');
    await emitAck(a.s, 'game:roll', { gameId: ia.gameId });
    expect((await st).state.last).toMatchObject({ value: 6 });
    const snap2 = await adminAck<{ ok: boolean; snapshot: OwnerSnapshot }>(adm, 'owner:snapshot');
    expect(snap2.snapshot.games[0].overrides).toEqual({ red: { mode: 'always6' } });

    await new Promise((r) => setTimeout(r, 50));
    expect(seen.every((e) => e === 'game:state' || e === 'game:start' || e === 'profile' || e === 'theme')).toBe(true);
  });

  it("'best' mode picks a capturing roll", async () => {
    srv = await startServer({ ownerKey: KEY, rollDie: () => 1 });
    const { a, ia } = await roomGame(srv.url);
    const adm = await admin(srv.url, KEY);
    // Red token on progress 10, a yellow token 4 squares ahead (track index 14 = yellow progress 40).
    const game = srv.app.hub.games.get(ia.gameId)!;
    const base = newGame(['red', 'yellow']);
    const crafted: GameState = {
      ...base,
      players: [
        { ...base.players[0], tokens: [10, -1, -1, -1] },
        { ...base.players[1], tokens: [40, -1, -1, -1] },
      ],
    };
    game.state = crafted;
    expect((await adminAck(adm, 'owner:dice', { gameId: ia.gameId, color: 'red', value: null, mode: 'best' })).ok).toBe(true);
    const st = lastRoll(a.s, 'red');
    expect((await emitAck(a.s, 'game:roll', { gameId: ia.gameId })).ok).toBe(true);
    expect((await st).state.last).toMatchObject({ value: 4 });
    const moved = once(a.s, 'game:state', (u) => u.state.last.type === 'move');
    expect((await emitAck(a.s, 'game:move', { gameId: ia.gameId, token: 0 })).ok).toBe(true);
    const m = (await moved).state.last;
    expect(m.type === 'move' && m.captured.length).toBe(1);
  });

  it('declares a winner, grants coins, bans and pushes theme/notices', async () => {
    srv = await startServer({ ownerKey: KEY, rollDie: () => 1 });
    const { a, b, ia } = await roomGame(srv.url);
    const adm = await admin(srv.url, KEY);

    const prof = once(a.s, 'profile', (p) => p.coins === 1500);
    const g = await adminAck<{ ok: boolean; user: OwnerUser }>(adm, 'owner:coins', { userId: a.id, amount: 500 });
    expect(g.ok).toBe(true);
    expect(g.user.coins).toBe(1500);
    await prof;
    expect(srv.app.db.ledger(a.id).at(-1)).toMatchObject({ amount: 500, reason: 'owner-gift' });
    expect((await adminAck(adm, 'owner:coins', { userId: a.id, amount: -999999 })).ok).toBe(false);
    expect((await adminAck(adm, 'owner:coins', { userId: a.id, amount: 1.5 })).ok).toBe(false);

    const over = once(b.s, 'game:over');
    expect((await adminAck(adm, 'owner:endGame', { gameId: ia.gameId, winner: 'yellow' })).ok).toBe(true);
    expect((await over).ranking).toEqual(['yellow', 'red']);

    const theme = once(a.s, 'theme', (t) => t.board === 'night');
    expect((await adminAck(adm, 'owner:theme', { board: 'night', dice: 'gold', locked: true })).ok).toBe(true);
    expect(await theme).toEqual({ board: 'night', dice: 'gold', locked: true });
    expect((await api(srv.url, 'GET', '/api/config')).json.theme).toEqual({ board: 'night', dice: 'gold', locked: true });

    const note = once(b.s, 'broadcast');
    expect((await adminAck(adm, 'owner:notice', { message: 'Server restart soon' })).ok).toBe(true);
    expect(await note).toEqual({ message: 'Server restart soon' });

    const cfg = await adminAck<{ ok: boolean; config: { turnSeconds: number; stakes: number[] } }>(adm, 'owner:config', { turnSeconds: 20, stakes: [500, 50] });
    expect(cfg.config).toMatchObject({ turnSeconds: 20, stakes: [50, 500] });
    expect((await adminAck(adm, 'owner:config', { turnSeconds: 2 })).ok).toBe(false);

    const users = await adminAck<{ ok: boolean; users: OwnerUser[] }>(adm, 'owner:users', { query: b.playerId });
    expect(users.users.map((u) => u.id)).toEqual([b.id]);
    const gone = new Promise((r) => b.s.once('disconnect', r));
    expect((await adminAck<{ ok: boolean; user: OwnerUser }>(adm, 'owner:ban', { userId: b.id, banned: true })).user.banned).toBe(true);
    await gone;
    await expect(connect(srv.url, (await guestToken(srv.url, b.id)))).rejects.toThrow('banned');
  });

  it('forwards offline dice only to the phone running that game', async () => {
    srv = await startServer({ ownerKey: KEY });
    const a = await player(srv.url);
    const s0 = newGame(['red', 'yellow']);
    a.s.emit('offline:state', { id: 'g1', game: 'ludo', mode: 'bots', seats: [{ color: 'red', name: 'Me', isBot: false, isYou: true }, { color: 'yellow', name: 'CPU', isBot: true, isYou: false }], state: s0 });
    const adm = await admin(srv.url, KEY);
    let snap: OwnerSnapshot | undefined;
    for (let i = 0; i < 20 && !snap?.offline.length; i++) {
      snap = (await adminAck<{ ok: boolean; snapshot: OwnerSnapshot }>(adm, 'owner:snapshot')).snapshot;
    }
    expect(snap!.offline).toEqual([expect.objectContaining({ id: 'g1', userId: a.id, online: true })]);
    const cmd = once(a.s, 'offline:dice');
    expect((await adminAck(adm, 'owner:offlineDice', { userId: a.id, gameId: 'g1', color: 'red', value: 6, mode: 'once' })).ok).toBe(true);
    expect(await cmd).toEqual({ gameId: 'g1', color: 'red', value: 6, mode: 'once' });
    expect((await adminAck(adm, 'owner:offlineDice', { userId: a.id, gameId: 'zz', color: 'red', value: 6, mode: 'once' })).ok).toBe(false);
  });
});

describe('invites and recent players', () => {
  it('sends an invite to an online player by Player ID and lists recent co-players', async () => {
    srv = await startServer();
    const { a, b } = await roomGame(srv.url);
    expect(a.playerId).toMatch(/^[A-Z2-9]{6}$/);
    const rec = await emitAck<{ ok: boolean; players: { playerId: string; online: boolean }[] }>(a.s, 'players:recent');
    expect(rec.players).toEqual([expect.objectContaining({ playerId: b.playerId, online: true })]);

    const c = await player(srv.url);
    const cr = await emitAck<{ ok: boolean; room: RoomInfo }>(c.s, 'room:create', { maxPlayers: 2, stake: 0 });
    expect((await emitAck(c.s, 'invite:send', { toPlayerId: 'ZZZZZZ', roomCode: cr.room.code })).ok).toBe(false);
    expect((await emitAck(c.s, 'invite:send', { toPlayerId: b.playerId, roomCode: '000000' })).ok).toBe(false);
    const got = once(b.s, 'invite:received');
    expect((await emitAck(c.s, 'invite:send', { toPlayerId: b.playerId.toLowerCase(), roomCode: cr.room.code })).ok).toBe(true);
    expect(await got).toMatchObject({ roomCode: cr.room.code, fromPlayerId: c.playerId });
  });
});

describe('admin web app', () => {
  it('serves the built admin app at /admin/ and blocks path traversal', async () => {
    const { mkdtempSync, writeFileSync, mkdirSync } = await import('node:fs');
    const { join } = await import('node:path');
    const { tmpdir } = await import('node:os');
    const dir = mkdtempSync(join(tmpdir(), 'admin-'));
    writeFileSync(join(dir, 'index.html'), '<title>Ludo Admin</title>');
    mkdirSync(join(dir, 'assets'));
    writeFileSync(join(dir, 'assets', 'a.js'), 'console.log(1)');
    srv = await startServer({ adminDir: dir });
    const r1 = await fetch(`${srv.url}/admin`, { redirect: 'manual' });
    expect(r1.status).toBe(301);
    const r2 = await fetch(`${srv.url}/admin/`);
    expect(r2.status).toBe(200);
    expect(await r2.text()).toContain('Ludo Admin');
    const r3 = await fetch(`${srv.url}/admin/assets/a.js`);
    expect(r3.headers.get('content-type')).toContain('javascript');
    const r4 = await fetch(`${srv.url}/admin/..%2F..%2Fpackage.json`);
    expect(await r4.text()).not.toContain('"name"');
  });
});
