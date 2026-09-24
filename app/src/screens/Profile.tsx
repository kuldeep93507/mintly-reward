import { useState } from 'react';
import { AVATAR_COUNT, NAME_MAX, xpForLevel } from '@ludo/engine';
import { useApp } from '../state/AppContext';
import { Avatar } from '../ui/Avatar';
import { Btn, Header } from '../ui/kit';
import { Icon } from '../ui/Icon';
import { play } from '../audio/sfx';

export function ProfileScreen() {
  const app = useApp();
  const { profile, identity } = app;
  const [name, setName] = useState(identity.name);
  const [avatar, setAvatar] = useState(identity.avatar);
  const [saving, setSaving] = useState(false);
  const dirty = name.trim() !== identity.name || avatar !== identity.avatar;

  const save = async () => {
    const n = name.trim();
    if (!n) { app.toast('Name cannot be empty'); return; }
    setSaving(true);
    const err = await app.updateIdentity({ name: n, avatar });
    setSaving(false);
    app.toast(err ?? 'Profile saved');
  };

  const level = profile?.level ?? 1;
  const xp = profile?.xp ?? 0;
  const lo = xpForLevel(level);
  const hi = xpForLevel(level + 1);
  const pct = Math.min(100, Math.max(0, ((xp - lo) / (hi - lo)) * 100));
  const winPct = profile && profile.games ? Math.round((profile.wins / profile.games) * 100) : 0;

  return (
    <div className="screen">
      <Header title="Profile" />
      <div className="profile-card">
        <div className="pc-avatar"><Avatar id={avatar} size={96} /><span className="pc-level">{level}</span></div>
        <label className="name-edit">
          <Icon name="edit" size={18} />
          <input value={name} maxLength={NAME_MAX} onChange={(e) => setName(e.target.value)} aria-label="Name" />
        </label>
        <div className="xp">
          <div className="xp-top"><span>Level {level}</span><span>{xp - lo} / {hi - lo} XP</span></div>
          <div className="xp-bar"><div style={{ width: `${pct}%` }} /></div>
        </div>
      </div>
      <div className="stats">
        <div className="stat"><b>{profile?.games ?? 0}</b><span>Games</span></div>
        <div className="stat"><b>{profile?.wins ?? 0}</b><span>Wins</span></div>
        <div className="stat"><b>{winPct}%</b><span>Win rate</span></div>
        <div className="stat"><b className="coin-stat"><Icon name="coin" size={18} />{profile ? profile.coins.toLocaleString() : '—'}</b><span>Coins</span></div>
      </div>
      {!profile && <p className="fine">Offline: stats and coins appear when connected to the game server.</p>}
      <div className="field-label">Choose avatar</div>
      <div className="avatar-grid">
        {Array.from({ length: AVATAR_COUNT }, (_, i) => (
          <button key={i} className={`av-opt ${avatar === i ? 'on' : ''}`} onClick={() => { play('pop'); setAvatar(i); }} aria-label={`Avatar ${i + 1}`}>
            <Avatar id={i} size={58} />
            {avatar === i && <span className="av-check"><Icon name="check" size={14} /></span>}
          </button>
        ))}
      </div>
      <div className="sticky-cta">
        <Btn variant="green" size="lg" disabled={!dirty || saving} onClick={save}>{saving ? 'Saving…' : 'Save'}</Btn>
      </div>
    </div>
  );
}
