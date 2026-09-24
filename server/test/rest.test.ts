import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { claimDaily, claimFree } from '../src/profile.js';
import { api, connect, guest, startServer, type TestServer } from './helpers.js';

let srv: TestServer;
beforeAll(async () => { srv = await startServer(); });
afterAll(async () => { await srv.close(); });

describe('auth + profile', () => {
  it('guest login is stable per device and profile can be updated', async () => {
    const a = await guest(srv.url, { name: '  Mo\u0007hit  ', avatar: 3 });
    expect(a.profile).toMatchObject({ name: 'Mohit', avatar: 3, coins: 1000, level: 1, dailyStreak: 0, nextDailyAt: null });
    const again = await api(srv.url, 'POST', '/api/auth/guest', undefined, { deviceId: `test-device-${process.pid}-1` });
    expect(again.json.profile.id).toBe(a.profile.id);

    const me = await api(srv.url, 'GET', '/api/me', a.token);
    expect(me.json.profile.id).toBe(a.profile.id);
    const upd = await api(srv.url, 'PATCH', '/api/me', a.token, { name: 'A very long name indeed yes', avatar: 11 });
    expect(upd.json.profile.name).toBe('A very long name');
    expect(upd.json.profile.avatar).toBe(11);
    expect((await api(srv.url, 'PATCH', '/api/me', a.token, { avatar: 12 })).status).toBe(400);
    expect((await api(srv.url, 'GET', '/api/me', 'nope.bad')).status).toBe(401);
    expect((await api(srv.url, 'GET', '/api/me', a.token + 'x')).status).toBe(401);

    const def = await guest(srv.url);
    expect(def.profile.name).toMatch(/^Player\d{4}$/);

    await expect(connect(srv.url, 'bad')).rejects.toThrow('unauthorized');
    const s = await connect(srv.url, a.token);
    s.close();
  });

  it('serves config, health, leaderboard and CORS preflight', async () => {
    expect((await api(srv.url, 'GET', '/health')).json).toEqual({ ok: true });
    const cfg = (await api(srv.url, 'GET', '/api/config')).json;
    expect(cfg.stakes).toEqual([100, 250, 500, 1000, 2500, 5000, 10000]);
    expect(cfg.maxMissedTurns).toBe(3);
    const lb = (await api(srv.url, 'GET', '/api/leaderboard')).json;
    expect(Array.isArray(lb.top)).toBe(true);
    const pre = await fetch(`${srv.url}/api/me`, { method: 'OPTIONS', headers: { Origin: 'https://localhost' } });
    expect(pre.status).toBe(204);
    expect(pre.headers.get('access-control-allow-origin')).toBe('*');
  });
});

describe('rewards', () => {
  it('daily reward: 24h gate, streak continues <48h, resets after, wraps after 7', async () => {
    const a = await guest(srv.url);
    const r = await api(srv.url, 'POST', '/api/daily', a.token);
    expect(r.json.reward).toBe(100);
    expect(r.json.profile.coins).toBe(1100);
    expect(r.json.profile.dailyStreak).toBe(1);
    expect(r.json.profile.nextDailyAt).toBeGreaterThan(Date.now());
    expect((await api(srv.url, 'POST', '/api/daily', a.token)).status).toBe(429);

    const { db, cfg } = srv.app;
    const id = a.profile.id;
    const H = 3_600_000;
    let t = db.getUser(id)!.last_daily_at!;
    const rewards: number[] = [];
    for (let i = 0; i < 7; i++) { t += 25 * H; rewards.push(claimDaily(db, cfg, id, t).reward); }
    expect(rewards).toEqual([150, 200, 300, 400, 500, 1000, 100]);
    expect(db.getUser(id)!.daily_streak).toBe(8);
    t += 49 * H;
    expect(claimDaily(db, cfg, id, t).reward).toBe(100);
    expect(db.getUser(id)!.daily_streak).toBe(1);
  });

  it('free coins only below 100 with 60 min cooldown', async () => {
    const a = await guest(srv.url);
    expect((await api(srv.url, 'POST', '/api/free-coins', a.token)).status).toBe(400);
    const { db, cfg } = srv.app;
    db.addCoins(a.profile.id, -950, 'test');
    const r = await api(srv.url, 'POST', '/api/free-coins', a.token);
    expect(r.json.reward).toBe(500);
    expect(r.json.profile.coins).toBe(550);
    expect(r.json.profile.nextFreeCoinsAt).toBeGreaterThan(Date.now());
    db.addCoins(a.profile.id, -500, 'test');
    expect((await api(srv.url, 'POST', '/api/free-coins', a.token)).status).toBe(429);
    const later = db.getUser(a.profile.id)!.last_free_at! + 61 * 60_000;
    expect(claimFree(db, cfg, a.profile.id, later).user.coins).toBe(550);
    expect(() => db.addCoins(a.profile.id, -10_000, 'test')).toThrow('Not enough coins');
    expect(db.getUser(a.profile.id)!.coins).toBe(550);
  });
});
