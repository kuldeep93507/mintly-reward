import { useCallback, useEffect, useRef, useState } from 'react';
import type { OwnerSnapshot } from '@ludo/engine';
import { type AdminSocket, call, connectAdmin, defaultServerUrl, load, store } from './net';
import { GamesPanel, OfflinePanel } from './games';
import { ConfigPanel, NoticePanel, ThemePanel, UsersPanel } from './panels';

type Tab = 'live' | 'offline' | 'users' | 'theme' | 'config' | 'notice';
const TABS: { id: Tab; label: string }[] = [
  { id: 'live', label: 'Live' },
  { id: 'offline', label: 'Offline' },
  { id: 'users', label: 'Users' },
  { id: 'theme', label: 'Theme' },
  { id: 'config', label: 'Config' },
  { id: 'notice', label: 'Notice' },
];

export interface Ctx {
  socket: AdminSocket;
  snap: OwnerSnapshot | null;
  refresh: () => void;
  flash: (msg: string, bad?: boolean) => void;
}

function Login({ onDone }: { onDone: (s: AdminSocket, url: string) => void }) {
  const [url, setUrl] = useState(defaultServerUrl);
  const [key, setKey] = useState(() => load('admin.key'));
  const [remember, setRemember] = useState(() => !!load('admin.key'));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setBusy(true);
    setErr('');
    try {
      const u = url.trim().replace(/\/+$/, '');
      const s = await connectAdmin(u, key.trim());
      store('admin.server', u);
      store('admin.key', remember ? key.trim() : null);
      onDone(s, u);
    } catch (x) {
      const m = (x as Error).message;
      setErr(m === 'unauthorized' ? 'Wrong owner key' : m === 'too many attempts' ? 'Too many attempts, wait a minute' : `Cannot reach server (${m})`);
    } finally {
      setBusy(false);
    }
  };
  // Auto-login with a remembered key.
  const tried = useRef(false);
  useEffect(() => { if (!tried.current && key) { tried.current = true; void submit(); } });
  return (
    <form className="login" onSubmit={submit}>
      <div className="brand"><span className="brand-dot" /> Ludo Admin</div>
      <p className="muted">Owner control panel. Log in with the server's <code>OWNER_KEY</code>.</p>
      <label>Server URL<input value={url} onChange={(e) => setUrl(e.target.value)} inputMode="url" autoCapitalize="off" spellCheck={false} /></label>
      <label>Owner key<input value={key} onChange={(e) => setKey(e.target.value)} type="password" autoComplete="current-password" data-testid="key" /></label>
      <label className="check"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Remember on this device</label>
      {err && <div className="error">{err}</div>}
      <button className="primary" disabled={busy || !key.trim()} data-testid="login">{busy ? 'Connecting…' : 'Log in'}</button>
    </form>
  );
}

function Dashboard({ socket, url, onLogout }: { socket: AdminSocket; url: string; onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>('live');
  const [snap, setSnap] = useState<OwnerSnapshot | null>(null);
  const [connected, setConnected] = useState(true);
  const [msg, setMsg] = useState<{ text: string; bad: boolean; id: number } | null>(null);
  const flash = useCallback((text: string, bad = false) => {
    const id = Math.random();
    setMsg({ text, bad, id });
    setTimeout(() => setMsg((m) => (m?.id === id ? null : m)), 2400);
  }, []);
  const refresh = useCallback(() => {
    void call<{ snapshot: OwnerSnapshot }>(socket, 'owner:snapshot').then((r) => { if (r.ok) setSnap(r.snapshot); });
  }, [socket]);

  useEffect(() => {
    const on = () => { setConnected(true); refresh(); };
    const off = () => setConnected(false);
    socket.on('connect', on);
    socket.on('disconnect', off);
    return () => { socket.off('connect', on); socket.off('disconnect', off); };
  }, [socket, refresh]);

  // Live data: poll once a second (cheap; one owner).
  useEffect(() => {
    refresh();
    const t = setInterval(() => { if (document.visibilityState === 'visible') refresh(); }, 1000);
    return () => clearInterval(t);
  }, [refresh]);

  const ctx: Ctx = { socket, snap, refresh, flash };
  const counts: Partial<Record<Tab, number>> = { live: (snap?.games.length ?? 0) + (snap?.rooms.length ?? 0), offline: snap?.offline.length ?? 0 };
  return (
    <div className="dash">
      <header className="top">
        <div className="brand"><span className={`brand-dot ${connected ? '' : 'off'}`} /> Ludo Admin</div>
        <div className="top-meta">
          <span title={url}>{snap ? `${snap.online} online` : '…'}</span>
          <button className="ghost" onClick={onLogout}>Log out</button>
        </div>
      </header>
      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)} data-testid={`tab-${t.id}`}>
            {t.label}{counts[t.id] ? <span className="count">{counts[t.id]}</span> : null}
          </button>
        ))}
      </nav>
      <main>
        {tab === 'live' && <GamesPanel {...ctx} />}
        {tab === 'offline' && <OfflinePanel {...ctx} />}
        {tab === 'users' && <UsersPanel {...ctx} />}
        {tab === 'theme' && <ThemePanel {...ctx} />}
        {tab === 'config' && <ConfigPanel {...ctx} />}
        {tab === 'notice' && <NoticePanel {...ctx} />}
      </main>
      {msg && <div className={`flash ${msg.bad ? 'bad' : ''}`}>{msg.text}</div>}
    </div>
  );
}

export function App() {
  const [session, setSession] = useState<{ socket: AdminSocket; url: string } | null>(null);
  if (!session) return <Login onDone={(socket, url) => setSession({ socket, url })} />;
  return (
    <Dashboard socket={session.socket} url={session.url}
      onLogout={() => { session.socket.close(); store('admin.key', null); setSession(null); }} />
  );
}
