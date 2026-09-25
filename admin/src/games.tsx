import { useState } from 'react';
import type { Color, DiceOverride, GameState, OwnerOfflineGame, SnakesState } from '@ludo/engine';
import type { Ctx } from './App';
import { call } from './net';
import { COLORS, LudoMini, SnakesMini } from './MiniBoard';

type Send = (color: Color, mode: DiceOverride['mode'] | null, value: number | null) => Promise<void>;

function overrideLabel(o: DiceOverride | undefined): string {
  if (!o) return 'normal dice';
  if (o.mode === 'once') return `next: ${o.value}`;
  return o.mode === 'always6' ? 'always 6' : 'auto-win (best)';
}

/** Per-seat dice controls: next value 1-6, Always 6, Best, Clear. */
function SeatDice({ color, name, sub, override, turn, send, locked }:
  { color: Color; name: string; sub: string; override: DiceOverride | undefined; turn: boolean; send: Send; locked?: boolean }) {
  return (
    <div className={`seat ${turn ? 'turn' : ''}`} data-seat={color}>
      <div className="seat-head">
        <span className="dot" style={{ background: COLORS[color] }} />
        <span className="seat-name">{name}</span>
        <span className="seat-sub">{sub}</span>
        <span className={`ovr ${override ? 'set' : ''}`}>{overrideLabel(override)}</span>
      </div>
      {!locked && <div className="dice-row">
        {[1, 2, 3, 4, 5, 6].map((v) => (
          <button key={v} className={override?.mode === 'once' && override.value === v ? 'on' : ''} onClick={() => void send(color, 'once', v)} aria-label={`Next ${v}`}>{v}</button>
        ))}
        <button className={`wide ${override?.mode === 'always6' ? 'on' : ''}`} onClick={() => void send(color, override?.mode === 'always6' ? null : 'always6', null)}>Always 6</button>
        <button className={`wide ${override?.mode === 'best' ? 'on' : ''}`} onClick={() => void send(color, override?.mode === 'best' ? null : 'best', null)} data-testid={`best-${color}`}>Auto-win</button>
        <button className="wide ghost" disabled={!override} onClick={() => void send(color, null, null)}>Clear</button>
      </div>}
    </div>
  );
}

export function GamesPanel({ socket, snap, refresh, flash }: Ctx) {
  const [confirm, setConfirm] = useState<{ gameId: string; winner: Color | null } | null>(null);
  if (!snap) return <div className="empty">Loading…</div>;
  const end = async (gameId: string, winner: Color | null) => {
    const r = await call(socket, 'owner:endGame', { gameId, winner });
    setConfirm(null);
    if (r.ok) flash(winner ? `Declared ${winner} the winner` : 'Game ended'); else flash(r.error, true);
    refresh();
  };
  return (
    <div className="stack">
      <h2>Online games <small>{snap.games.length}</small></h2>
      {!snap.onlineControl && (
        <p className="note">
          Watching only. Dice control and "declare winner" for online matches between real players are turned off
          (fair play / store policy). They can be enabled for private testing with <code>ONLINE_GAME_CONTROL=1</code> on the server.
        </p>
      )}
      {snap.games.length === 0 && <div className="empty">No online games right now.</div>}
      {snap.games.map((g) => {
        const s = g.state;
        const turn = s.players[s.turn]?.color;
        const send: Send = async (color, mode, value) => {
          const r = await call(socket, 'owner:dice', { gameId: g.gameId, color, mode, value });
          if (r.ok) flash(`${color}: ${mode ? overrideLabel(mode === 'once' ? { mode, value: value! } : { mode }) : 'normal dice'}`); else flash(r.error, true);
          refresh();
        };
        return (
          <section key={g.gameId} className="card" data-testid="game-card">
            <div className="card-head">
              <b>{g.seats.length}-player {g.stake ? `· ${g.stake} coins` : '· free'}</b>
              <span className="muted">#{g.gameId.slice(0, 6)} · move {s.seq} · {s.phase === 'move' ? `${turn} to move (${s.dice})` : `${turn} to roll`}</span>
            </div>
            <div className="game-body">
              <LudoMini state={s} />
              <div className="seats">
                {g.seats.map((seat) => {
                  const p = s.players.find((x) => x.color === seat.color)!;
                  const home = p.tokens.filter((t) => t === 56).length;
                  const sub = `${seat.isBot ? 'CPU' : seat.connected ? 'online' : 'offline'} · ${home}/4 home${p.rank ? ` · ${['', '1st 🥇', '2nd 🥈', '3rd 🥉', '4th'][p.rank]} place` : ''}${p.out ? ' · left' : ''}`;
                  return <SeatDice key={seat.color} color={seat.color} name={seat.name} sub={sub} override={g.overrides[seat.color]} turn={turn === seat.color} send={send} locked={!snap.onlineControl} />;
                })}
              </div>
            </div>
            {snap.onlineControl && <div className="card-actions">
              <span className="muted">End game:</span>
              {g.seats.filter((x) => !s.players.find((p) => p.color === x.color)?.out).map((x) => (
                <button key={x.color} className="small" onClick={() => setConfirm({ gameId: g.gameId, winner: x.color })}>
                  <span className="dot" style={{ background: COLORS[x.color] }} /> {x.name} wins
                </button>
              ))}
              <button className="small danger" onClick={() => setConfirm({ gameId: g.gameId, winner: null })}>End by progress</button>
            </div>}
            {confirm?.gameId === g.gameId && (
              <div className="confirm">
                {confirm.winner ? `Declare ${g.seats.find((x) => x.color === confirm.winner)?.name} the winner and pay out now?` : 'End now and rank by progress?'}
                <button className="danger" onClick={() => void end(confirm.gameId, confirm.winner)}>Yes</button>
                <button className="ghost" onClick={() => setConfirm(null)}>No</button>
              </div>
            )}
          </section>
        );
      })}

      <h2>Rooms <small>{snap.rooms.length}</small></h2>
      {snap.rooms.length === 0 && <div className="empty">No private rooms waiting.</div>}
      {snap.rooms.map((r) => (
        <section key={r.code} className="card row">
          <b className="code">{r.code}</b>
          <span>{r.members.length}/{r.maxPlayers} · {r.stake ? `${r.stake} coins` : 'free'}</span>
          <span className="muted">{r.members.map((m) => m.name + (m.userId === r.hostId ? ' (host)' : '')).join(', ')}</span>
        </section>
      ))}
    </div>
  );
}

/** Remote control only: every game whose dice can be controlled, nothing else. */
export function RemotePanel(ctx: Ctx) {
  const { snap } = ctx;
  if (!snap) return <div className="empty">Loading…</div>;
  return (
    <div className="stack">
      <OfflinePanel {...ctx} />
      {snap.onlineControl && <GamesPanel {...ctx} />}
    </div>
  );
}

function ago(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return s < 60 ? `${s}s ago` : `${Math.round(s / 60)}m ago`;
}

export function OfflinePanel({ socket, snap, refresh, flash }: Ctx) {
  if (!snap) return <div className="empty">Loading…</div>;
  return (
    <div className="stack">
      <p className="note">
        Remote control works only on <b>Tester</b> accounts (your own phones: Users → Make tester). Their offline games
        (vs Computer, Pass &amp; Play, Snakes) show up here while the phone is connected; dice commands apply on the next
        roll of that colour. Normal players' offline games are never sent to the server.
      </p>
      {snap.offline.length === 0 && <div className="empty">No offline games reported.</div>}
      {snap.offline.map((o: OwnerOfflineGame) => {
        const ludo = o.game === 'ludo';
        const st = o.state as GameState & SnakesState;
        const turn = st.players[st.turn]?.color;
        const send: Send = async (color, mode, value) => {
          const r = await call(socket, 'owner:offlineDice', { userId: o.userId, gameId: o.id, color, mode, value });
          if (r.ok) flash(`Sent to ${o.userName}'s phone`); else flash(r.error, true);
          refresh();
        };
        return (
          <section key={o.userId + o.id} className="card" data-testid="offline-card">
            <div className="card-head">
              <b>{o.userName} <span className="muted">{o.playerId}</span></b>
              <span className="muted">
                {ludo ? 'Ludo' : 'Snakes & Ladders'} · {o.mode === 'bots' ? 'vs Computer' : 'Pass & Play'} ·{' '}
                <span className={o.online ? 'ok' : 'bad'}>{o.online ? 'connected' : 'not connected'}</span> · {ago(snap.now - o.updatedAt)}
              </span>
            </div>
            <div className="game-body">
              {ludo ? <LudoMini state={st as GameState} /> : <SnakesMini state={st as SnakesState} />}
              <div className="seats">
                {o.seats.map((seat) => {
                  const p = st.players.find((x) => x.color === seat.color);
                  const where = ludo ? `${(p as GameState['players'][number] | undefined)?.tokens.filter((t) => t === 56).length ?? 0}/4 home` : `square ${(p as SnakesState['players'][number] | undefined)?.pos ?? 0}`;
                  return (
                    <SeatDice key={seat.color} color={seat.color} name={seat.name} sub={`${seat.isBot ? 'CPU' : seat.isYou ? 'phone owner' : 'human'} · ${where}`}
                      override={o.overrides[seat.color]} turn={turn === seat.color} send={send} />
                  );
                })}
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
