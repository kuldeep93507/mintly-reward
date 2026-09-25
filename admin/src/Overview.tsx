import type { OwnerUser } from '@ludo/engine';
import type { Ctx } from './App';

function Stat({ label, value, hint, tone }: { label: string; value: number | string; hint?: string; tone?: 'accent' | 'ok' | 'warn' | 'bad' }) {
  return (
    <div className={`stat ${tone ?? ''}`}>
      <div className="stat-value">{typeof value === 'number' ? value.toLocaleString() : value}</div>
      <div className="stat-label">{label}</div>
      {hint && <div className="stat-hint">{hint}</div>}
    </div>
  );
}

function MiniUser({ u, rank }: { u: OwnerUser; rank?: number }) {
  return (
    <div className="mini-user">
      {rank !== undefined && <span className={`mini-rank r${Math.min(rank, 4)}`}>{rank}</span>}
      <span className={`presence ${u.online ? 'on' : ''}`} />
      <span className="mini-name">{u.name}</span>
      <span className="muted mono">{u.playerId}</span>
      <span className="mini-right">
        {rank !== undefined ? <><b>{u.wins}</b> wins</> : <span className="coins">{u.coins.toLocaleString()}</span>}
      </span>
    </div>
  );
}

/** Home tab: what is happening on the server right now, at a glance. */
export function OverviewPanel({ snap, go }: Ctx & { go: (tab: 'live' | 'offline' | 'users') => void }) {
  if (!snap) return <div className="empty">Loading…</div>;
  const st = snap.stats;
  const humansPlaying = snap.games.reduce((n, g) => n + g.seats.filter((s) => !s.isBot).length, 0);
  return (
    <div className="stack">
      <div className="stats">
        <Stat label="Players online" value={snap.online} tone="ok" />
        <Stat label="Live online games" value={snap.games.length} hint={`${humansPlaying} human players`} tone="accent" />
        <Stat label="Rooms waiting" value={snap.rooms.length} />
        <Stat label="Offline games" value={snap.offline.length} hint="vs Computer / Pass & Play" />
        <Stat label="Total users" value={st.users} hint={`+${st.newToday} today`} />
        <Stat label="Matches today" value={st.matchesToday} hint={`${st.matchesTotal.toLocaleString()} all time`} tone="accent" />
        <Stat label="Coins with players" value={st.coins} hint="free virtual coins" tone="warn" />
        <Stat label="Banned" value={st.banned} tone={st.banned ? 'bad' : undefined} />
      </div>

      <div className="quick">
        <button onClick={() => go('live')}>Watch live games →</button>
        <button onClick={() => go('offline')}>Offline games →</button>
        <button onClick={() => go('users')}>Manage users →</button>
      </div>

      <div className="two-col">
        <section className="card">
          <h3>Top players</h3>
          {st.top.length === 0 ? <div className="muted">No players yet.</div> : st.top.map((u, i) => <MiniUser key={u.id} u={u} rank={i + 1} />)}
        </section>
        <section className="card">
          <h3>Newest players</h3>
          {st.newest.length === 0 ? <div className="muted">No players yet.</div> : st.newest.map((u) => <MiniUser key={u.id} u={u} />)}
        </section>
      </div>
    </div>
  );
}
