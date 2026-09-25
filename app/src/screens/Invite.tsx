import { useEffect, useState } from 'react';
import type { RecentPlayer, RoomInfo } from '@ludo/engine';
import { useApp } from '../state/AppContext';
import { emitAck } from '../net/socket';
import { Avatar } from '../ui/Avatar';
import { Btn, Modal } from '../ui/kit';
import { Icon } from '../ui/Icon';
import { play } from '../audio/sfx';

type Ack = { ok: boolean; error?: string };

/** Lobby: invite recent co-players or anyone by Player ID. */
export function InviteModal({ roomCode, onClose }: { roomCode: string; onClose: () => void }) {
  const app = useApp();
  const [players, setPlayers] = useState<RecentPlayer[] | null>(null);
  const [pid, setPid] = useState('');
  const [sent, setSent] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const s = app.socket();
    if (!s) return;
    void emitAck<{ ok: true; players: RecentPlayer[] } | { ok: false; error: string }>((cb) => s.emit('players:recent', cb))
      .then((r) => setPlayers(r.ok ? r.players : []));
  }, [app]);

  const send = async (toPlayerId: string) => {
    const s = app.socket();
    if (!s || !toPlayerId) return;
    const r = await emitAck<Ack>((cb) => s.emit('invite:send', { toPlayerId, roomCode }, cb));
    if (r.ok) { play('pop'); setSent((x) => ({ ...x, [toPlayerId.toUpperCase()]: true })); app.toast('Invite sent'); } else app.toast(r.error ?? 'Could not invite');
  };

  return (
    <Modal title="Invite Friends" onClose={onClose} className="invite-modal">
      <div className="field-label">Player ID</div>
      <div className="pid-row">
        <input className="text-input" value={pid} maxLength={6} placeholder="e.g. K7QX2M" autoCapitalize="characters" autoCorrect="off" spellCheck={false}
          onChange={(e) => setPid(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} data-testid="pid-input" />
        <Btn variant="green" size="sm" disabled={pid.length !== 6} onClick={() => void send(pid)}>Send</Btn>
      </div>
      <div className="field-label">Recently played</div>
      <div className="recent-list">
        {players === null && <div className="loading"><span className="spinner" /></div>}
        {players?.length === 0 && <p className="fine">Play an online game and your opponents show up here.</p>}
        {players?.map((p) => (
          <div key={p.playerId} className="recent-row">
            <Avatar id={p.avatar} size={40} />
            <span className="rr-name">{p.name}<small>{p.playerId} · Lv {p.level}</small></span>
            <span className={`rr-dot ${p.online ? 'on' : ''}`}>{p.online ? 'Online' : 'Offline'}</span>
            <Btn variant={sent[p.playerId] ? 'white' : 'blue'} size="sm" disabled={!p.online} onClick={() => void send(p.playerId)}>
              {sent[p.playerId] ? <Icon name="check" size={16} /> : 'Invite'}
            </Btn>
          </div>
        ))}
      </div>
    </Modal>
  );
}

/** Incoming invite (any screen). */
export function InvitePopup() {
  const app = useApp();
  const inv = app.invite!;
  const [busy, setBusy] = useState(false);
  useEffect(() => { play('turn'); }, [inv]);
  const join = async () => {
    const s = app.socket();
    if (!s) return;
    setBusy(true);
    const r = await emitAck<{ ok: true; room: RoomInfo } | { ok: false; error: string }>((cb) => s.emit('room:join', { code: inv.roomCode }, cb));
    setBusy(false);
    app.setInvite(null);
    if (r.ok) {
      app.setPendingOnline({ kind: 'room' });
      // Leave whatever was open (a local game can't be resumed once its screen closes).
      app.home();
      app.go({ id: 'lobby', room: r.room });
    } else app.toast(r.error);
  };
  return (
    <Modal title="Game Invite" onClose={() => app.setInvite(null)} className="invite-pop">
      <div className="invite-from">
        <Avatar id={inv.fromAvatar} size={72} />
        <p><b>{inv.fromName}</b> invited you to play Ludo!</p>
        <div className="rc-code small">{inv.roomCode.split('').map((d, i) => <span key={i}>{d}</span>)}</div>
      </div>
      <div className="row-2">
        <Btn variant="white" onClick={() => app.setInvite(null)}>Decline</Btn>
        <Btn variant="green" disabled={busy} onClick={join} data-testid="invite-join">{busy ? 'Joining…' : 'Join'}</Btn>
      </div>
    </Modal>
  );
}
