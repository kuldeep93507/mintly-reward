import { useState } from 'react';
import { useApp } from '../state/AppContext';
import { api } from '../net/api';
import { play } from '../audio/sfx';
import { Btn, Modal } from '../ui/kit';
import { Icon } from '../ui/Icon';

export function CoinBurst() {
  return (
    <div className="coin-burst" aria-hidden>
      {Array.from({ length: 14 }, (_, i) => (
        <span key={i} style={{ ['--a' as string]: `${(i * 360) / 14}deg`, ['--d' as string]: `${70 + (i % 3) * 30}px`, animationDelay: `${(i % 4) * 40}ms` }}>
          <Icon name="coin" size={26} />
        </span>
      ))}
    </div>
  );
}

function fmtWait(ms: number) {
  const h = Math.floor(ms / 3600000);
  const m = Math.ceil((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function DailyModal() {
  const app = useApp();
  const { profile, config } = app;
  const [busy, setBusy] = useState(false);
  const [won, setWon] = useState<number | null>(null);
  if (!profile || !config) return null;
  const rewards = config.dailyRewards;
  const claimable = profile.nextDailyAt === null || profile.nextDailyAt <= Date.now();
  // Day to claim next (0-based). After a claim the streak already includes today.
  const today = claimable ? profile.dailyStreak % rewards.length : Math.max(0, (profile.dailyStreak - 1) % rewards.length);

  const claim = async () => {
    setBusy(true);
    try {
      const r = await api.daily();
      app.setProfile(r.profile);
      setWon(r.reward);
      play('coin');
      setTimeout(() => play('coin'), 180);
    } catch (e) {
      app.toast((e as Error).message);
    }
    setBusy(false);
  };

  return (
    <Modal title="Daily Reward" onClose={() => app.setDailyOpen(false)} className="daily">
      <p className="modal-sub">Come back every day for bigger rewards!</p>
      <div className="daily-strip">
        {rewards.map((r, i) => {
          const done = claimable ? i < today : i <= today;
          const cur = i === today && (claimable || won !== null);
          return (
            <div key={i} className={`day ${done && !cur ? 'done' : ''} ${cur ? 'cur' : ''} ${i === rewards.length - 1 ? 'big' : ''}`}>
              <span className="day-n">Day {i + 1}</span>
              <Icon name="coin" size={i === rewards.length - 1 ? 34 : 24} />
              <span className="day-amt">{r}</span>
              {done && !cur && <span className="day-check"><Icon name="check" size={16} /></span>}
            </div>
          );
        })}
      </div>
      <div className="daily-cta">
        {won !== null ? (
          <div className="won"><CoinBurst /><span>+{won} coins!</span></div>
        ) : claimable ? (
          <Btn variant="green" size="lg" disabled={busy} onClick={claim}>{busy ? 'Claiming…' : `Claim ${rewards[today]}`}</Btn>
        ) : (
          <div className="wait">Next reward in {fmtWait((profile.nextDailyAt ?? 0) - Date.now())}</div>
        )}
      </div>
    </Modal>
  );
}

export function FreeCoinsModal({ onClose }: { onClose: () => void }) {
  const app = useApp();
  const [busy, setBusy] = useState(false);
  const [won, setWon] = useState<number | null>(null);
  const claim = async () => {
    setBusy(true);
    try {
      const r = await api.freeCoins();
      app.setProfile(r.profile);
      setWon(r.reward);
      play('coin');
    } catch (e) {
      app.toast((e as Error).message);
    }
    setBusy(false);
  };
  return (
    <Modal title="Free Coins" onClose={onClose} className="daily">
      <div className="free-coins-art"><Icon name="coin" size={72} /></div>
      <p className="modal-sub">Running low? Here's a top-up on the house.</p>
      <div className="daily-cta">
        {won !== null ? <div className="won"><CoinBurst /><span>+{won} coins!</span></div>
          : <Btn variant="yellow" size="lg" disabled={busy} onClick={claim}>Claim {app.config?.freeCoins ?? ''} coins</Btn>}
      </div>
    </Modal>
  );
}
