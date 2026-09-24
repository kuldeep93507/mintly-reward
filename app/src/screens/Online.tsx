import { useEffect, useState } from 'react';
import { prizeTable } from '@ludo/engine';
import { useApp } from '../state/AppContext';
import { setBackOverride } from '../state/back';
import { emitAck } from '../net/socket';
import { Avatar } from '../ui/Avatar';
import { Btn, CoinPill, Header, Segmented } from '../ui/kit';
import { Icon } from '../ui/Icon';
import { OfflineCard } from '../ui/Offline';
import { play } from '../audio/sfx';

const TIER_NAMES = ['Rookie', 'Classic', 'Pro', 'Master', 'Legend', 'Royal', 'Mega', 'Ultra'];

export function OnlineScreen() {
  const app = useApp();
  const [players, setPlayers] = useState<2 | 4>(2);
  const coins = app.profile?.coins ?? 0;
  return (
    <div className="screen">
      <Header title="Play Online" right={app.profile && <CoinPill amount={coins} />} />
      {app.status !== 'online' || !app.config ? <OfflineCard /> : (
        <>
          <Segmented options={[{ value: 2, label: '2 Players' }, { value: 4, label: '4 Players' }]} value={players} onChange={setPlayers} />
          <div className="stakes">
            {app.config.stakes.map((stake, i) => {
              const prize = prizeTable(players, stake)[0];
              const locked = coins < stake;
              return (
                <div key={stake} className={`stake ${locked ? 'locked' : ''}`} style={{ animationDelay: `${i * 60}ms` }}>
                  <div className={`stake-badge tier${i % 6}`}><Icon name="trophy" size={26} /></div>
                  <div className="stake-info">
                    <div className="stake-name">{TIER_NAMES[i] ?? `Tier ${i + 1}`}</div>
                    <div className="stake-line">Entry <Icon name="coin" size={16} /> <b>{stake.toLocaleString()}</b></div>
                  </div>
                  <div className="stake-prize">
                    <span className="win">WIN</span>
                    <span className="amt"><Icon name="coin" size={20} />{prize.toLocaleString()}</span>
                  </div>
                  <Btn variant={locked ? 'white' : 'green'} size="sm" disabled={locked}
                    onClick={() => app.go({ id: 'matchmaking', players, stake })}>
                    {locked ? <Icon name="lock" size={18} /> : 'Play'}
                  </Btn>
                </div>
              );
            })}
          </div>
          {players === 4 && <p className="fine">4-player prizes: 1st {prizeTable(4, 1)[0]}× entry, 2nd gets the entry back.</p>}
        </>
      )}
    </div>
  );
}

export function Matchmaking({ players, stake }: { players: 2 | 4; stake: number }) {
  const app = useApp();
  const [found, setFound] = useState(1);
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const s = app.socket();
    if (!s) { app.back(); return; }
    app.setPendingOnline({ kind: 'online', players, stake });
    const start = Date.now();
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 250);
    const onStatus = (st: { players: 2 | 4; stake: number; found: number; elapsed: number }) => {
      if (st.players === players && st.stake === stake) setFound((f) => { if (st.found > f) play('pop'); return st.found; });
    };
    s.on('queue:status', onStatus);
    void emitAck<{ ok: boolean; error?: string }>((cb) => s.emit('queue:join', { players, stake }, cb)).then((r) => {
      if (!r.ok) { app.toast(r.error ?? 'Could not join the queue'); app.back(); }
    });
    const cancel = () => { s.emit('queue:leave'); app.back(); };
    setBackOverride(cancel);
    return () => { clearInterval(t); s.off('queue:status', onStatus); setBackOverride(null); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cancel = () => { app.socket()?.emit('queue:leave'); app.back(); };
  const mm = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`;
  return (
    <div className="screen matchmaking">
      <div className="mm-title">Finding players…</div>
      <div className="mm-sub">Entry <Icon name="coin" size={18} /> {stake.toLocaleString()} · Win <Icon name="coin" size={18} /> {prizeTable(players, stake)[0].toLocaleString()}</div>
      <div className={`mm-seats n${players}`}>
        {Array.from({ length: players }, (_, i) => (
          <div key={i} className={`mm-seat ${i < found ? 'filled' : 'searching'}`}>
            {i === 0 ? <Avatar id={app.identity.avatar} size={78} />
              : i < found ? <Avatar id={(app.identity.avatar + i * 5) % 12} size={78} />
                : <div className="mm-spin"><Icon name="users" size={34} /></div>}
            <div className="mm-name">{i === 0 ? 'You' : i < found ? 'Player found' : 'Searching'}</div>
          </div>
        ))}
      </div>
      <div className="mm-found">Found {found}/{players}</div>
      <div className="mm-timer">{mm}</div>
      <Btn variant="red" onClick={cancel}>Cancel</Btn>
    </div>
  );
}
