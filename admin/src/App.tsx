import { Component, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { OwnerSnapshot } from '@ludo/engine';
import { type AdminSocket, call, connectAdmin, defaultServerUrl, load, store } from './net';
import { GamesPanel, OfflinePanel, RemotePanel } from './games';
import { ConfigPanel, NoticePanel, ThemePanel, UsersPanel } from './panels';
import { OverviewPanel } from './Overview';

type Tab = 'overview' | 'remote' | 'live' | 'offline' | 'users' | 'theme' | 'config' | 'notice';
const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'remote', label: 'Remote' },
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

/** One broken card (e.g. a malformed game report) must not blank the whole panel. */
class Boundary extends Component<{ children: ReactNode; resetKey: string }, { err: string | null; key: string }> {
  state = { err: null as string | null, key: this.props.resetKey };
  static getDerivedStateFromError(e: Error) { return { err: e.message || 'error' }; }
  static getDerivedStateFromProps(p: { resetKey: string }, s: { key: string }) {
    return p.resetKey !== s.key ? { err: null, key: p.resetKey } : null;
  }
  render() {
    if (this.state.err) return <div className="empty bad">This section could not be shown ({this.state.err}). It will retry on the next update.</div>;
    return this.props.children;
  }
}

function Login({ onDone, reason }: { onDone: (s: AdminSocket, url: string) => void; reason?: string }) {
  const [url, setUrl] = useState(defaultServerUrl);
  const [key, setKey] = useState(() => load('admin.key'));
  const [remember, setRemember] = useState(() => !!load('admin.key'));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(reason ?? '');
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
  useEffect(() => { if (!tried.current && key && !reason) { tried.current = true; void submit(); } });
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

function Dashboard({ socket, url, onLogout, onLost }: { socket: AdminSocket; url: string; onLogout: () => void; onLost: (reason: string) => void }) {
  // Remote-only mode: just the dice remote control, nothing else (saved on this device).
  const [remoteOnly, setRemoteOnly] = useState(() => load('admin.remoteOnly') === '1');
  const [tab, setTab] = useState<Tab>(() => (load('admin.remoteOnly') === '1' ? 'remote' : 'overview'));
  const toggleRemote = () => {
    const n = !remoteOnly;
    setRemoteOnly(n);
    store('admin.remoteOnly', n ? '1' : null);
    setTab(n ? 'remote' : 'overview');
  };
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
    // A rejected reconnect (key changed, too many attempts) is final: go back to the login screen.
    const bad = (e: Error) => {
      if (socket.active) return; // still retrying on its own
      onLost(e.message === 'unauthorized' ? 'Owner key was rejected, log in again' : e.message === 'too many attempts' ? 'Too many attempts, wait a minute' : `Lost connection (${e.message})`);
    };
    socket.on('connect', on);
    socket.on('disconnect', off);
    socket.on('connect_error', bad);
    return () => { socket.off('connect', on); socket.off('disconnect', off); socket.off('connect_error', bad); };
  }, [socket, refresh, onLost]);

  // Live data: poll once a second (cheap; one owner).
  useEffect(() => {
    refresh();
    const t = setInterval(() => { if (document.visibilityState === 'visible' && socket.connected) refresh(); }, 1000);
    return () => clearInterval(t);
  }, [refresh, socket]);

  const ctx: Ctx = { socket, snap, refresh, flash };
  const counts: Partial<Record<Tab, number>> = { remote: (snap?.offline.length ?? 0) + (snap?.onlineControl ? snap.games.length : 0), live: (snap?.games.length ?? 0) + (snap?.rooms.length ?? 0), offline: snap?.offline.length ?? 0 };
  return (
    <div className="dash">
      <header className="top">
        <div className="brand"><span className={`brand-dot ${connected ? '' : 'off'}`} /> Ludo Admin</div>
        <div className="top-meta">
          <span className="server" title={url}>{url.replace(/^https?:\/\//, '')}</span>
          <span className={`pill ${connected ? 'ok' : 'bad'}`}>{connected ? (snap ? `${snap.online} online` : '…') : 'Reconnecting…'}</span>
          <button className={`ghost ${remoteOnly ? 'on' : ''}`} onClick={toggleRemote} data-testid="remote-only">{remoteOnly ? 'Full panel' : 'Remote only'}</button>
          <button className="ghost" onClick={onLogout}>Log out</button>
        </div>
      </header>
      <nav className="tabs">
        {TABS.filter((t) => !remoteOnly || t.id === 'remote').map((t) => (
          <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)} data-testid={`tab-${t.id}`}>
            {t.label}{counts[t.id] ? <span className="count">{counts[t.id]}</span> : null}
          </button>
        ))}
      </nav>
      <main>
        <Boundary resetKey={`${tab}:${snap?.now ?? 0}`}>
        {tab === 'overview' && <OverviewPanel {...ctx} go={setTab} />}
        {tab === 'remote' && <RemotePanel {...ctx} />}
        {tab === 'live' && <GamesPanel {...ctx} />}
        {tab === 'offline' && <OfflinePanel {...ctx} />}
        {tab === 'users' && <UsersPanel {...ctx} />}
        {tab === 'theme' && <ThemePanel {...ctx} />}
        {tab === 'config' && <ConfigPanel {...ctx} />}
        {tab === 'notice' && <NoticePanel {...ctx} />}
        </Boundary>
      </main>
      {msg && <div className={`flash ${msg.bad ? 'bad' : ''}`}>{msg.text}</div>}
    </div>
  );
}

export function App() {
  const [session, setSession] = useState<{ socket: AdminSocket; url: string } | null>(null);
  const [lost, setLost] = useState<string | undefined>();
  const onLost = useCallback((reason: string) => {
    setSession((s) => { s?.socket.close(); return null; });
    setLost(reason);
  }, []);
  if (!session) return <Login reason={lost} onDone={(socket, url) => { setLost(undefined); setSession({ socket, url }); }} />;
  return (
    <Dashboard socket={session.socket} url={session.url} onLost={onLost}
      onLogout={() => { session.socket.close(); store('admin.key', null); setSession(null); }} />
  );
}
