import { useEffect, useState } from 'react';
import {
  BOARD_THEMES, DICE_SKINS, type BoardTheme, type DiceSkin, type OwnerUser, type ServerConfig,
} from '@ludo/engine';
import type { Ctx } from './App';
import { call } from './net';

function UserRow({ u, ctx, onChange }: { u: OwnerUser; ctx: Ctx; onChange: (u: OwnerUser) => void }) {
  const [amount, setAmount] = useState('500');
  const [name, setName] = useState(u.name);
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState<'take' | 'ban' | null>(null);
  const [busy, setBusy] = useState(false);
  const coins = async (sign: 1 | -1) => {
    if (busy) return;
    const n = Math.round(Number(amount));
    if (!Number.isFinite(n) || n <= 0) return ctx.flash('Enter a positive amount', true);
    setBusy(true);
    const r = await call<{ user: OwnerUser }>(ctx.socket, 'owner:coins', { userId: u.id, amount: sign * n });
    setBusy(false);
    setConfirm(null);
    if (r.ok) { onChange(r.user); ctx.flash(`${sign > 0 ? 'Gave' : 'Took'} ${n} coins ${sign > 0 ? 'to' : 'from'} ${u.name}`); } else ctx.flash(r.error, true);
  };
  const rename = async () => {
    const r = await call<{ user: OwnerUser }>(ctx.socket, 'owner:rename', { userId: u.id, name });
    if (r.ok) { onChange(r.user); setEditing(false); ctx.flash('Renamed'); } else ctx.flash(r.error, true);
  };
  const tester = async () => {
    const r = await call<{ user: OwnerUser }>(ctx.socket, 'owner:tester', { userId: u.id, tester: !u.tester });
    if (r.ok) { onChange(r.user); ctx.flash(r.user.tester ? `${u.name} is now a Tester (remote control on)` : `${u.name} is a normal player again`); } else ctx.flash(r.error, true);
  };
  const ban = async () => {
    setConfirm(null);
    const r = await call<{ user: OwnerUser }>(ctx.socket, 'owner:ban', { userId: u.id, banned: !u.banned });
    if (r.ok) { onChange(r.user); ctx.flash(r.user.banned ? `${u.name} banned` : `${u.name} unbanned`); } else ctx.flash(r.error, true);
  };
  return (
    <section className={`card user ${u.banned ? 'banned' : ''}`} data-testid="user-row">
      <div className="card-head">
        {editing ? (
          <span className="inline">
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={16} />
            <button className="small" onClick={() => void rename()}>Save</button>
            <button className="small ghost" onClick={() => { setEditing(false); setName(u.name); }}>Cancel</button>
          </span>
        ) : (
          <b className="user-title"><span className={`presence ${u.online ? 'on' : ''}`} />{u.name} <button className="link" onClick={() => setEditing(true)}>rename</button></b>
        )}
        <span className="muted">
          <span className="mono">{u.playerId}</span> · Lv {u.level} · {u.wins}/{u.games} wins · <span className={u.online ? 'ok' : ''}>{u.online ? 'online' : 'offline'}</span>
          {u.banned && <span className="bad"> · banned</span>}
          {u.tester && <span className="tester-tag"> · TESTER</span>}
        </span>
      </div>
      <div className="user-actions">
        <span className="coins">{u.coins.toLocaleString()} coins</span>
        {[100, 500, 1000, 5000].map((v) => (
          <button key={v} className={`chip ${amount === String(v) ? 'on' : ''}`} onClick={() => setAmount(String(v))}>{v.toLocaleString()}</button>
        ))}
        <input className="amt" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ''))} inputMode="numeric" aria-label="Amount" />
        <button className="small give" disabled={busy} onClick={() => void coins(1)}>+ Give</button>
        <button className="small ghost" disabled={busy} onClick={() => setConfirm('take')}>− Take</button>
        <button className={`small ${u.tester ? 'on-tester' : ''}`} onClick={() => void tester()} title="Only Tester accounts (your own phones) share offline games and accept remote dice">{u.tester ? 'Tester ✓' : 'Make tester'}</button>
        <button className={`small ${u.banned ? '' : 'danger'}`} onClick={() => (u.banned ? void ban() : setConfirm('ban'))}>{u.banned ? 'Unban' : 'Ban'}</button>
      </div>
      {confirm && (
        <div className="confirm">
          {confirm === 'take' ? `Take ${Number(amount || 0).toLocaleString()} coins from ${u.name}?` : `Ban ${u.name}? They are logged out and cannot play.`}
          <button className="danger" onClick={() => void (confirm === 'take' ? coins(-1) : ban())}>Yes</button>
          <button className="ghost" onClick={() => setConfirm(null)}>No</button>
        </div>
      )}
    </section>
  );
}

export function UsersPanel(ctx: Ctx) {
  const [q, setQ] = useState('');
  const [users, setUsers] = useState<OwnerUser[] | null>(null);
  useEffect(() => {
    const t = setTimeout(() => {
      void call<{ users: OwnerUser[] }>(ctx.socket, 'owner:users', { query: q }).then((r) => setUsers(r.ok ? r.users : []));
    }, 250);
    return () => clearTimeout(t);
  }, [q, ctx.socket]);
  return (
    <div className="stack">
      <input className="search" placeholder="Search name or Player ID" value={q} onChange={(e) => setQ(e.target.value)} />
      <p className="note">Coins are free virtual coins with no money value.</p>
      {users === null ? <div className="empty">Loading…</div> : users.length === 0 ? <div className="empty">No users found.</div> : users.map((u) => (
        <UserRow key={u.id} u={u} ctx={ctx} onChange={(n) => setUsers((l) => l!.map((x) => (x.id === n.id ? n : x)))} />
      ))}
    </div>
  );
}

const BOARD_LABEL: Record<BoardTheme, string> = { classic: 'Classic', night: 'Night', wood: 'Wood', candy: 'Candy' };
const DICE_LABEL: Record<DiceSkin, string> = { white: 'White', gold: 'Gold', red: 'Red', neon: 'Neon' };

export function ThemePanel({ socket, snap, refresh, flash }: Ctx) {
  const [board, setBoard] = useState<BoardTheme | null>(null);
  const [dice, setDice] = useState<DiceSkin | null>(null);
  const [locked, setLocked] = useState(false);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (!snap || loaded) return;
    setBoard(snap.theme.board);
    setDice(snap.theme.dice);
    setLocked(snap.theme.locked);
    setLoaded(true);
  }, [snap, loaded]);
  const apply = async () => {
    const r = await call(socket, 'owner:theme', { board, dice, locked });
    if (r.ok) flash('Theme pushed to all players'); else flash(r.error, true);
    refresh();
  };
  return (
    <div className="stack">
      <section className="card">
        <h3>Board theme for everyone</h3>
        <div className="chips">
          <button className={board === null ? 'on' : ''} onClick={() => setBoard(null)}>Player's choice</button>
          {BOARD_THEMES.map((b) => <button key={b} className={board === b ? 'on' : ''} onClick={() => setBoard(b)}>{BOARD_LABEL[b]}</button>)}
        </div>
        <h3>Dice skin for everyone</h3>
        <div className="chips">
          <button className={dice === null ? 'on' : ''} onClick={() => setDice(null)}>Player's choice</button>
          {DICE_SKINS.map((d) => <button key={d} className={dice === d ? 'on' : ''} onClick={() => setDice(d)}>{DICE_LABEL[d]}</button>)}
        </div>
        <label className="check"><input type="checkbox" checked={locked} onChange={(e) => setLocked(e.target.checked)} /> Lock (players cannot change their own theme)</label>
        <button className="primary" onClick={() => void apply()}>Apply to all players</button>
      </section>
    </div>
  );
}

const list = (s: string) => s.split(/[\s,]+/).filter(Boolean).map(Number);

export function ConfigPanel({ socket, snap, flash }: Ctx) {
  const [daily, setDaily] = useState('');
  const [stakes, setStakes] = useState('');
  const [turn, setTurn] = useState('');
  const [loaded, setLoaded] = useState(false);
  const fill = (c: ServerConfig) => {
    setDaily(c.dailyRewards.join(', '));
    setStakes(c.stakes.join(', '));
    setTurn(String(c.turnSeconds));
  };
  useEffect(() => {
    if (!snap || loaded) return;
    fill(snap.config);
    setLoaded(true);
  }, [snap, loaded]);
  const save = async () => {
    const r = await call<{ config: ServerConfig }>(socket, 'owner:config', { dailyRewards: list(daily), stakes: list(stakes), turnSeconds: Number(turn) });
    if (r.ok) { fill(r.config); flash('Config saved (applies to new games and app launches)'); } else flash(r.error, true);
  };
  return (
    <div className="stack">
      <section className="card form">
        <label>Daily rewards (day 1, 2, 3 …)<input value={daily} onChange={(e) => setDaily(e.target.value)} /></label>
        <label>Online stakes (entry fees)<input value={stakes} onChange={(e) => setStakes(e.target.value)} /></label>
        <label>Turn seconds (5-120)<input value={turn} onChange={(e) => setTurn(e.target.value.replace(/[^0-9]/g, ''))} inputMode="numeric" /></label>
        <button className="primary" onClick={() => void save()}>Save config</button>
      </section>
    </div>
  );
}

export function NoticePanel({ socket, flash }: Ctx) {
  const [text, setText] = useState('');
  const send = async () => {
    const r = await call(socket, 'owner:notice', { message: text });
    if (r.ok) { flash('Notice sent to everyone online'); setText(''); } else flash(r.error, true);
  };
  return (
    <div className="stack">
      <section className="card form">
        <label>Message to every connected player<textarea value={text} maxLength={200} rows={3} onChange={(e) => setText(e.target.value)} /></label>
        <button className="primary" disabled={!text.trim()} onClick={() => void send()}>Broadcast</button>
      </section>
    </div>
  );
}
