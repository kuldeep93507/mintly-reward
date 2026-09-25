import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { GameInfo, GlobalTheme, Invite, Profile, RoomInfo, ServerConfig } from '@ludo/engine';
import { DEFAULT_SERVER_URL, SHOW_SERVER_SETTING } from '../config';
import { api, setServer, setToken } from '../net/api';
import { closeSocket, getSocket, type GameSocket } from '../net/socket';
import { getJSON, getString, setJSON, setString } from '../native/prefs';
import { setHapticsEnabled } from '../native/haptics';
import { setSoundEnabled } from '../audio/sfx';
import { hideSplash } from '../native/platform';
import { OnlineGameController } from '../game/OnlineGameController';
import type { LocalIdentity, LocalTheme, PlayAgain, Screen, ServerStatus, Settings } from './types';
import { applyOfflineDice, setOfflineSharing, setOfflineSocket } from '../net/offlineLink';
import { DEFAULT_THEME, ThemeContext, type ThemeChoice } from '../game/theme';
import { askNotifyPermission, notifyInvite } from '../native/notify';

const DEFAULT_SETTINGS: Settings = { sound: true, vibration: true, autoMove: true, breakReminder: true, serverUrl: DEFAULT_SERVER_URL };
const BREAK_AFTER_MS = 60 * 60_000;

interface Toast { id: number; text: string }

interface AppCtx {
  ready: boolean;
  /** The player confirmed they are 13 or older (asked once). */
  ageOk: boolean;
  confirmAge: () => void;
  settings: Settings;
  updateSettings: (p: Partial<Settings>) => void;
  identity: LocalIdentity;
  profile: Profile | null;
  setProfile: (p: Profile) => void;
  updateIdentity: (p: Partial<LocalIdentity>) => Promise<string | null>;
  config: ServerConfig | null;
  status: ServerStatus;
  reconnect: () => Promise<void>;
  /** Deletes the server account, then starts fresh as a new guest. Returns an error message or null. */
  deleteAccount: () => Promise<string | null>;
  socket: () => GameSocket | null;
  screen: Screen;
  go: (s: Screen) => void;
  replace: (s: Screen) => void;
  back: () => void;
  home: () => void;
  /** Where to go when an online game starts (for Play Again). */
  setPendingOnline: (a: PlayAgain) => void;
  toasts: Toast[];
  toast: (text: string) => void;
  dailyOpen: boolean;
  setDailyOpen: (o: boolean) => void;
  /** Theme actually shown (owner's global theme wins over the player's choice). */
  theme: ThemeChoice;
  localTheme: LocalTheme;
  setLocalTheme: (t: Partial<LocalTheme>) => void;
  globalTheme: GlobalTheme | null;
  /** Latest room invite waiting for Join / Decline. */
  invite: Invite | null;
  setInvite: (i: Invite | null) => void;
}

const Ctx = createContext<AppCtx>(null!);
export const useApp = () => useContext(Ctx);

function randomId() {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [ageOk, setAgeOk] = useState(true);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [identity, setIdentity] = useState<LocalIdentity>({ name: 'Player', avatar: 0 });
  const [profile, setProfileState] = useState<Profile | null>(null);
  const [config, setConfig] = useState<ServerConfig | null>(null);
  const [status, setStatus] = useState<ServerStatus>('connecting');
  const [stack, setStack] = useState<Screen[]>([{ id: 'home' }]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [dailyOpen, setDailyOpen] = useState(false);
  const [localTheme, setLocalThemeState] = useState<LocalTheme>(DEFAULT_THEME);
  const [globalTheme, setGlobalTheme] = useState<GlobalTheme | null>(null);
  const [invite, setInvite] = useState<Invite | null>(null);
  const socketRef = useRef<GameSocket | null>(null);
  const roomUpdateRef = useRef<((room: RoomInfo) => void) | null>(null);
  const deviceIdRef = useRef('');
  const stackRef = useRef(stack);
  stackRef.current = stack;
  const pendingOnline = useRef<PlayAgain>({ kind: 'room' });
  const configRef = useRef(config);
  configRef.current = config;
  const identityRef = useRef(identity);
  identityRef.current = identity;

  const screen = stack[stack.length - 1];
  const go = useCallback((s: Screen) => setStack((st) => [...st, s]), []);
  const replace = useCallback((s: Screen) => setStack((st) => [...st.slice(0, -1), s]), []);
  const back = useCallback(() => setStack((st) => (st.length > 1 ? st.slice(0, -1) : st)), []);
  const home = useCallback(() => setStack([{ id: 'home' }]), []);

  const toast = useCallback((text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600);
  }, []);

  const setProfile = useCallback((p: Profile) => {
    setProfileState(p);
    setOfflineSharing(!!p.tester);
    const ident = { name: p.name, avatar: p.avatar };
    setIdentity(ident);
    void setJSON('identity', ident);
  }, []);

  const attachSocket = useCallback((url: string, token: string) => {
    const s = getSocket(url, token);
    socketRef.current = s;
    s.removeAllListeners('profile');
    s.removeAllListeners('game:start');
    for (const ev of ['theme', 'broadcast', 'invite:received', 'offline:dice'] as const) s.removeAllListeners(ev);
    s.on('profile', (p) => setProfile(p));
    s.on('theme', (t) => setGlobalTheme(t));
    s.on('broadcast', (b) => toast(b.message));
    s.on('offline:dice', applyOfflineDice);
    s.on('invite:received', (i) => {
      setInvite(i);
      void notifyInvite(i);
    });
    setOfflineSocket(s);
    // The server may still hold us in a friends room (e.g. the app was restarted inside the
    // reconnect grace period). Show that lobby so the player can see it and leave it.
    if (roomUpdateRef.current) s.off('room:update', roomUpdateRef.current);
    roomUpdateRef.current = (room) => {
      const top = stackRef.current[stackRef.current.length - 1];
      if (top.id === 'lobby' || top.id === 'game') return;
      setStack((st) => [...st.filter((x) => x.id !== 'game' && x.id !== 'snakes'), { id: 'lobby', room }]);
    };
    s.on('room:update', roomUpdateRef.current);
    // A game started (matchmaking, a friends room, or a resend after reconnect).
    s.on('game:start', (info: GameInfo) => {
      const top = stackRef.current[stackRef.current.length - 1];
      if (top.id === 'game' && top.info?.gameId === info.gameId) return; // the controller handles resyncs
      const ctrl = new OnlineGameController(s, info, configRef.current?.maxMissedTurns ?? null, setProfile);
      const again = pendingOnline.current;
      setStack((st) => [...st.filter((x) => x.id === 'home'), { id: 'game', controller: ctrl, again, info }]);
    });
  }, [setProfile, toast]);

  const connect = useCallback(async (url: string) => {
    setServer(url);
    setStatus('connecting');
    try {
      const ident = identityRef.current;
      const auth = await api.guest(deviceIdRef.current, ident.name, ident.avatar);
      setToken(auth.token);
      let prof = auth.profile;
      // A name/avatar changed while offline was only saved on the phone: send it now.
      if (await getString('identityDirty') === '1') {
        if (ident.name !== prof.name || ident.avatar !== prof.avatar) {
          try { prof = (await api.updateMe({ name: ident.name, avatar: ident.avatar })).profile; } catch { /* keep the server's */ }
        }
        await setString('identityDirty', '');
      }
      setProfile(prof);
      const cfg = await api.config();
      setConfig(cfg);
      if (cfg.theme) setGlobalTheme(cfg.theme);
      attachSocket(url, auth.token);
      setStatus('online');
    } catch {
      setStatus('offline');
      setProfileState(null);
      setToken(null);
      closeSocket();
      socketRef.current = null;
      setOfflineSocket(null);
    }
  }, [attachSocket, setProfile]);

  // Boot: settings, identity, device id, then guest login.
  useEffect(() => {
    void (async () => {
      setLocalThemeState(await getJSON<LocalTheme>('theme', DEFAULT_THEME));
      setAgeOk((await getString('ageOk')) === '1');
      const stored = await getJSON<Settings>('settings', DEFAULT_SETTINGS);
      // Use the server address baked into this build unless the player typed their own.
      const s: Settings = { ...DEFAULT_SETTINGS, ...stored, serverUrl: SHOW_SERVER_SETTING && stored.serverUrlCustom ? stored.serverUrl : DEFAULT_SERVER_URL };
      setSettings(s);
      setSoundEnabled(s.sound);
      setHapticsEnabled(s.vibration);
      const ident = await getJSON<LocalIdentity>('identity', {
        name: 'Player' + Math.floor(1000 + Math.random() * 9000),
        avatar: Math.floor(Math.random() * 12),
      });
      setIdentity(ident);
      identityRef.current = ident;
      void setJSON('identity', ident);
      let dev = await getString('deviceId');
      if (!dev) { dev = randomId(); await setString('deviceId', dev); }
      deviceIdRef.current = dev;
      setReady(true);
      void hideSplash();
      setTimeout(() => { void askNotifyPermission(); }, 1500);
      await connect(s.serverUrl);
    })();
  }, [connect]);

  const confirmAge = useCallback(() => {
    setAgeOk(true);
    void setString('ageOk', '1');
  }, []);

  // Play-time reminder: after an hour on screen, suggest a short break (then again every hour).
  useEffect(() => {
    if (!ready || settings.breakReminder === false) return;
    let played = 0;
    let last = Date.now();
    const t = setInterval(() => {
      const now = Date.now();
      if (document.visibilityState === 'visible' && now - last < 60_000) played += now - last;
      last = now;
      if (played >= BREAK_AFTER_MS) {
        played = 0;
        toast("You've been playing for an hour. Time for a short break!");
      }
    }, 15_000);
    return () => clearInterval(t);
  }, [ready, settings.breakReminder, toast]);

  // Offline: try again when the app comes back, the network returns, and every 20 s.
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  useEffect(() => {
    if (!ready || status !== 'offline') return;
    const retry = () => { void connect(settingsRef.current.serverUrl); };
    const onVisible = () => { if (document.visibilityState === 'visible') retry(); };
    window.addEventListener('online', retry);
    document.addEventListener('visibilitychange', onVisible);
    const t = setInterval(retry, 20_000);
    return () => {
      window.removeEventListener('online', retry);
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(t);
    };
  }, [ready, status, connect]);

  const updateSettings = useCallback((p: Partial<Settings>) => {
    setSettings((s) => {
      const n = { ...s, ...p };
      if (p.serverUrl !== undefined) n.serverUrlCustom = p.serverUrl.replace(/\/+$/, '') !== DEFAULT_SERVER_URL.replace(/\/+$/, '');
      void setJSON('settings', n);
      setSoundEnabled(n.sound);
      setHapticsEnabled(n.vibration);
      if (p.serverUrl !== undefined && p.serverUrl !== s.serverUrl) {
        closeSocket();
        void connect(n.serverUrl);
      }
      return n;
    });
  }, [connect]);

  const updateIdentity = useCallback(async (p: Partial<LocalIdentity>): Promise<string | null> => {
    const n = { ...identityRef.current, ...p };
    setIdentity(n);
    void setJSON('identity', n);
    if (status === 'online') {
      try {
        const r = await api.updateMe(p);
        setProfile(r.profile);
      } catch (e) {
        return (e as Error).message;
      }
    } else {
      void setString('identityDirty', '1');
    }
    return null;
  }, [status, setProfile]);

  const deleteAccount = useCallback(async (): Promise<string | null> => {
    try {
      await api.deleteMe();
    } catch (e) {
      return (e as Error).message;
    }
    closeSocket();
    socketRef.current = null;
    setToken(null);
    setProfileState(null);
    const dev = randomId();
    deviceIdRef.current = dev;
    await setString('deviceId', dev);
    const ident = { name: 'Player' + Math.floor(1000 + Math.random() * 9000), avatar: Math.floor(Math.random() * 12) };
    setIdentity(ident);
    identityRef.current = ident;
    await setJSON('identity', ident);
    await connect(settings.serverUrl);
    return null;
  }, [connect, settings.serverUrl]);

  const setLocalTheme = useCallback((p: Partial<LocalTheme>) => {
    setLocalThemeState((t) => {
      const n = { ...t, ...p };
      void setJSON('theme', n);
      return n;
    });
  }, []);

  const theme = useMemo<ThemeChoice>(() => {
    const g = globalTheme;
    if (!g) return localTheme;
    return {
      board: g.board ?? (g.locked ? DEFAULT_THEME.board : localTheme.board),
      dice: g.dice ?? (g.locked ? DEFAULT_THEME.dice : localTheme.dice),
    };
  }, [globalTheme, localTheme]);

  const value = useMemo<AppCtx>(() => ({
    ready, ageOk, confirmAge, settings, updateSettings, identity, profile, setProfile, updateIdentity, config, status,
    reconnect: () => connect(settings.serverUrl),
    deleteAccount,
    socket: () => socketRef.current,
    screen, go, replace, back, home,
    setPendingOnline: (a) => { pendingOnline.current = a; },
    toasts, toast, dailyOpen, setDailyOpen,
    theme, localTheme, setLocalTheme, globalTheme, invite, setInvite,
  }), [ready, ageOk, confirmAge, settings, updateSettings, identity, profile, setProfile, updateIdentity, config, status, connect, deleteAccount, screen, go, replace, back, home, toasts, toast, dailyOpen, theme, localTheme, setLocalTheme, globalTheme, invite]);

  return <Ctx.Provider value={value}><ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider></Ctx.Provider>;
}
