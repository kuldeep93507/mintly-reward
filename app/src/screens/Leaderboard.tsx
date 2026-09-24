import { useEffect, useState } from 'react';
import type { LeaderboardEntry } from '@ludo/engine';
import { useApp } from '../state/AppContext';
import { api } from '../net/api';
import { Avatar } from '../ui/Avatar';
import { Header } from '../ui/kit';
import { Icon } from '../ui/Icon';
import { OfflineCard } from '../ui/Offline';

export function LeaderboardScreen() {
  const app = useApp();
  const [rows, setRows] = useState<LeaderboardEntry[] | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    if (app.status !== 'online') return;
    setErr(false);
    api.leaderboard().then((r) => setRows(r.top)).catch(() => setErr(true));
  }, [app.status]);
  const me = app.profile?.id;
  return (
    <div className="screen">
      <Header title="Leaderboard" />
      {app.status !== 'online' || err ? <OfflineCard /> : !rows ? <div className="loading"><span className="spinner" /></div> : (
        <div className="lb">
          {rows.length === 0 && <p className="fine">No players yet — be the first!</p>}
          {rows.map((r, i) => (
            <div key={r.id} className={`lb-row ${i < 3 ? 'top top' + (i + 1) : ''} ${r.id === me ? 'me' : ''}`}>
              <span className="lb-rank">{i < 3 ? <Icon name="crown" size={22} /> : i + 1}</span>
              <Avatar id={r.avatar} size={42} />
              <span className="lb-name">{r.name}<small>Lv {r.level}</small></span>
              <span className="lb-wins"><b>{r.wins}</b><small>wins</small></span>
              <span className="lb-coins"><Icon name="coin" size={16} />{r.coins.toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
