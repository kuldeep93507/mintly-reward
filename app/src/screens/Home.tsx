import { useEffect, useState } from 'react';
import { useApp } from '../state/AppContext';
import { Avatar } from '../ui/Avatar';
import { CoinPill, IconBtn } from '../ui/kit';
import { Icon } from '../ui/Icon';
import { play } from '../audio/sfx';
import { Pawn } from '../game/Pawn';
import { DiceFace } from '../game/Dice';
import { FreeCoinsModal } from './Daily';

export function dailyClaimable(p: { nextDailyAt: number | null } | null) {
  return !!p && (p.nextDailyAt === null || p.nextDailyAt <= Date.now());
}

export function Logo() {
  return (
    <div className="logo">
      <div className="logo-art">
        <span className="logo-dice"><DiceFace value={6} /></span>
        <span className="logo-pawn p1"><Pawn color="red" /></span>
        <span className="logo-pawn p2"><Pawn color="blue" /></span>
        <span className="logo-pawn p3"><Pawn color="yellow" /></span>
      </div>
      <div className="logo-text"><span className="l1">LUDO</span><span className="l2">Mintly</span></div>
    </div>
  );
}

const TILES = [
  { id: 'online', title: 'Play Online', sub: 'Win coins', cls: 'tile-online', icon: 'globe' },
  { id: 'friends', title: 'Play with Friends', sub: 'Private room', cls: 'tile-friends', icon: 'users' },
  { id: 'bots', title: 'Vs Computer', sub: 'Beat the bots', cls: 'tile-bots', icon: 'cpu' },
  { id: 'pass', title: 'Pass & Play', sub: 'One device', cls: 'tile-pass', icon: 'phone' },
] as const;

export function Home() {
  const app = useApp();
  const { profile, identity, config, status } = app;
  const [freeOpen, setFreeOpen] = useState(false);
  const claimable = dailyClaimable(profile);
  const freeEligible = !!profile && !!config && profile.coins < config.freeCoinsBelow &&
    (profile.nextFreeCoinsAt === null || profile.nextFreeCoinsAt <= Date.now());

  // Pop the daily reward once per session when it's claimable.
  const [shownDaily, setShownDaily] = useState(false);
  useEffect(() => {
    if (claimable && !shownDaily && config) { setShownDaily(true); app.setDailyOpen(true); }
  }, [claimable, shownDaily, config, app]);

  return (
    <div className="screen home">
      <div className="topbar">
        <button className="me-chip" onClick={() => { play('click'); app.go({ id: 'profile' }); }}>
          <Avatar id={identity.avatar} size={44} />
          <span className="me-text">
            <span className="me-name">{identity.name}</span>
            <span className="me-level"><Icon name="star" size={12} /> Level {profile?.level ?? 1}</span>
          </span>
        </button>
        <div className="topbar-right">
          <CoinPill amount={profile ? profile.coins : '—'} plus={freeEligible} onClick={freeEligible ? () => setFreeOpen(true) : profile ? () => app.toast('Win games and claim daily rewards to earn coins!') : undefined} />
          <IconBtn icon="gear" label="Settings" onClick={() => app.go({ id: 'settings' })} />
        </div>
      </div>

      <Logo />

      <div className="tiles">
        {TILES.map((t, k) => {
          const online = t.id === 'online' || t.id === 'friends';
          const disabled = online && status !== 'online';
          return (
            <button key={t.id} className={`tile ${t.cls} ${disabled ? 'tile-off' : ''}`} style={{ animationDelay: `${k * 70}ms` }}
              onClick={() => { play('click'); app.go({ id: t.id } as never); }} data-testid={`tile-${t.id}`}>
              <span className="tile-shine" />
              <span className="tile-icon"><Icon name={t.icon} size={34} /></span>
              <span className="tile-title">{t.title}</span>
              <span className="tile-sub">{disabled ? (status === 'connecting' ? 'Connecting…' : 'Offline') : t.sub}</span>
              <span className="tile-pawns">
                {t.id === 'online' && <><Pawn color="yellow" /><Pawn color="green" /></>}
                {t.id === 'friends' && <><Pawn color="red" /><Pawn color="blue" /></>}
                {t.id === 'bots' && <><Pawn color="green" /></>}
                {t.id === 'pass' && <><Pawn color="yellow" /><Pawn color="red" /></>}
              </span>
            </button>
          );
        })}
      </div>

      <div className="home-row">
        <button className="round-btn rb-daily" onClick={() => { play('click'); if (profile) app.setDailyOpen(true); else app.toast("Daily rewards need the game server"); }}>
          <span className="rb-icon"><Icon name="gift" size={28} /></span>
          <span className="rb-label">Daily</span>
          {claimable && <span className="dot-badge big">!</span>}
        </button>
        <button className="round-btn rb-board" onClick={() => { play('click'); app.go({ id: 'leaderboard' }); }}>
          <span className="rb-icon"><Icon name="trophy" size={28} /></span>
          <span className="rb-label">Leaders</span>
        </button>
        <button className="round-btn rb-help" onClick={() => { play('click'); app.go({ id: 'howto' }); }}>
          <span className="rb-icon"><Icon name="book" size={28} /></span>
          <span className="rb-label">How to Play</span>
        </button>
      </div>
      {status === 'offline' && <div className="home-offline"><Icon name="wifiOff" size={16} /> Offline — online modes unavailable <button onClick={() => void app.reconnect()}>Retry</button></div>}
      {freeOpen && <FreeCoinsModal onClose={() => setFreeOpen(false)} />}
    </div>
  );
}
