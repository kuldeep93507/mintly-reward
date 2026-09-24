import { useEffect, useState } from 'react';
import type { RoomInfo } from '@ludo/engine';
import { useApp } from '../state/AppContext';
import { setBackOverride } from '../state/back';
import { emitAck } from '../net/socket';
import { shareText } from '../native/share';
import { Avatar } from '../ui/Avatar';
import { Btn, Header, Modal, Segmented } from '../ui/kit';
import { Icon } from '../ui/Icon';
import { OfflineCard } from '../ui/Offline';
import { play } from '../audio/sfx';
import { InviteModal } from './Invite';

type RoomAck = { ok: true; room: RoomInfo } | { ok: false; error: string };

export function FriendsScreen() {
  const app = useApp();
  const [mode, setMode] = useState<'none' | 'create' | 'join'>('none');
  const [players, setPlayers] = useState<2 | 3 | 4>(4);
  const [stake, setStake] = useState(0);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const coins = app.profile?.coins ?? 0;

  const create = async () => {
    const s = app.socket();
    if (!s) return;
    setBusy(true);
    const r = await emitAck<RoomAck>((cb) => s.emit('room:create', { maxPlayers: players, stake }, cb));
    setBusy(false);
    if (r.ok) { app.setPendingOnline({ kind: 'room' }); app.go({ id: 'lobby', room: r.room }); } else app.toast(r.error);
  };
  const join = async () => {
    const s = app.socket();
    if (!s || code.length !== 6) return;
    setBusy(true);
    const r = await emitAck<RoomAck>((cb) => s.emit('room:join', { code }, cb));
    setBusy(false);
    if (r.ok) { app.setPendingOnline({ kind: 'room' }); app.go({ id: 'lobby', room: r.room }); } else app.toast(r.error);
  };
  const key = (k: string) => {
    play('click');
    setCode((c) => (k === 'del' ? c.slice(0, -1) : c.length < 6 ? c + k : c));
  };

  return (
    <div className="screen">
      <Header title="Play with Friends" />
      {app.status !== 'online' || !app.config ? <OfflineCard /> : (
        <div className="friends">
          <button className="big-card bc-create" onClick={() => { play('click'); setMode('create'); }}>
            <span className="bc-icon"><Icon name="plus" size={36} /></span>
            <span className="bc-title">Create Room</span>
            <span className="bc-sub">Get a code and invite friends</span>
          </button>
          <button className="big-card bc-join" onClick={() => { play('click'); setMode('join'); }}>
            <span className="bc-icon"><Icon name="key" size={36} /></span>
            <span className="bc-title">Join Room</span>
            <span className="bc-sub">Enter a friend's 6-digit code</span>
          </button>
        </div>
      )}
      {mode === 'create' && app.config && (
        <Modal title="Create Room" onClose={() => setMode('none')}>
          <div className="field-label">Players</div>
          <Segmented options={[{ value: 2, label: '2' }, { value: 3, label: '3' }, { value: 4, label: '4' }]} value={players} onChange={setPlayers} />
          <div className="field-label">Entry fee</div>
          <div className="chips">
            {[0, ...app.config.stakes].map((s) => (
              <button key={s} disabled={s > coins} className={`chip ${stake === s ? 'on' : ''}`} onClick={() => { play('click'); setStake(s); }}>
                {s === 0 ? 'Free' : <><Icon name="coin" size={16} />{s.toLocaleString()}</>}
              </button>
            ))}
          </div>
          <Btn variant="green" size="lg" disabled={busy} onClick={create}>{busy ? 'Creating…' : 'Create'}</Btn>
        </Modal>
      )}
      {mode === 'join' && (
        <Modal title="Join Room" onClose={() => setMode('none')}>
          <div className="code-boxes">
            {Array.from({ length: 6 }, (_, i) => <span key={i} className={i < code.length ? 'filled' : ''}>{code[i] ?? ''}</span>)}
          </div>
          <div className="keypad">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'].map((k, i) => (
              k === '' ? <span key={i} /> :
                <button key={i} className="key" onClick={() => key(k)}>{k === 'del' ? <Icon name="backspace" /> : k}</button>
            ))}
          </div>
          <Btn variant="green" size="lg" disabled={busy || code.length !== 6} onClick={join}>{busy ? 'Joining…' : 'Join'}</Btn>
        </Modal>
      )}
    </div>
  );
}

export function Lobby({ room: initial }: { room: RoomInfo }) {
  const app = useApp();
  const [room, setRoom] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [inviting, setInviting] = useState(false);
  const me = app.profile?.id;
  const isHost = room.hostId === me;

  useEffect(() => {
    const s = app.socket();
    if (!s) return;
    const onUpdate = (r: RoomInfo) => { if (r.code === room.code) { setRoom(r); play('pop'); } };
    const onClosed = (e: { reason: string }) => { app.toast(e.reason || 'Room closed'); app.back(); };
    s.on('room:update', onUpdate);
    s.on('room:closed', onClosed);
    setBackOverride(() => { s.emit('room:leave'); app.back(); });
    return () => { s.off('room:update', onUpdate); s.off('room:closed', onClosed); setBackOverride(null); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.code]);

  const leave = () => { app.socket()?.emit('room:leave'); app.back(); };
  const start = async () => {
    const s = app.socket();
    if (!s) return;
    setBusy(true);
    const r = await emitAck<{ ok: boolean; error?: string }>((cb) => s.emit('room:start', cb));
    setBusy(false);
    if (!r.ok) app.toast(r.error ?? 'Could not start');
  };
  const share = async () => {
    const res = await shareText('Ludo Mintly', `Join my Ludo Mintly game! Room code: ${room.code}`);
    if (res === 'copied') app.toast('Invite copied to clipboard');
  };

  return (
    <div className="screen lobby">
      <div className="header">
        <button className="icon-btn" aria-label="Leave" onClick={leave}><Icon name="back" size={22} /></button>
        <h1 className="header-title">Room</h1>
        <div className="header-right" />
      </div>
      <div className="room-code-card">
        <div className="rc-label">Room code</div>
        <div className="rc-code">{room.code.split('').map((d, i) => <span key={i}>{d}</span>)}</div>
        <div className="rc-meta">{room.maxPlayers} players · {room.stake ? <>Entry <Icon name="coin" size={16} /> {room.stake}</> : 'Free game'}</div>
        <div className="row-2">
          <Btn variant="blue" onClick={share}><Icon name="share" /> Share</Btn>
          <Btn variant="purple" onClick={() => setInviting(true)} data-testid="invite"><Icon name="users" /> Invite</Btn>
        </div>
      </div>
      <div className="members">
        {Array.from({ length: room.maxPlayers }, (_, i) => {
          const m = room.members[i];
          return (
            <div key={i} className={`member ${m ? '' : 'waiting'}`}>
              {m ? <Avatar id={m.avatar} size={56} /> : <div className="mm-spin small"><Icon name="users" size={24} /></div>}
              <div className="member-name">{m ? (m.userId === me ? 'You' : m.name) : 'Waiting…'}</div>
              {m && <div className="member-sub">{m.userId === room.hostId ? 'Host' : `Lv ${m.level}`}</div>}
            </div>
          );
        })}
      </div>
      {isHost ? (
        <Btn variant="green" size="lg" disabled={busy || room.members.length < 2} onClick={start}>
          {room.members.length < 2 ? 'Waiting for players…' : busy ? 'Starting…' : 'Start Game'}
        </Btn>
      ) : <div className="lobby-wait">Waiting for the host to start…</div>}
      <Btn variant="white" onClick={leave}>Leave room</Btn>
      {inviting && <InviteModal roomCode={room.code} onClose={() => setInviting(false)} />}
    </div>
  );
}
