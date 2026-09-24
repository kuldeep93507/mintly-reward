import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { GameInfo, Profile, ServerConfig } from '@ludo/engine';
import { DEFAULT_SERVER_URL } from '../config';
import { api, setServer, setToken } from '../net/api';
import { closeSocket, getSocket, type GameSocket } from '../net/socket';
import { getJSON, getString, setJSON, setString } from '../native/prefs';
import { setHapticsEnabled } from '../native/haptics';
import { setSoundEnabled } from '../audio/sfx';
import { hideSplash } from '../native/platform';
import { OnlineGameController } from '../game/OnlineGameController';
import type { LocalIdentity, PlayAgain, Screen, ServerStatus, Settings } from './types';

const DEFAULT_SETTINGS: Settings = { sound: true, vibration: true, autoMove: true, serverUrl: DEFAULT_SERVER_URL };

interface Toast { id: number; text: string }

interface AppCtx {
  ready: boolean;
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
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [identity, setIdentity] = useState<LocalIdentity>({ name: 'Player', avatar: 0 });
  const [profile, setProfileState] = useState<Profile | null>(null);
  const [config, setConfig] = useState<ServerConfig | null>(null);
  const [status, setStatus] = useState<ServerStatus>('connecting');
  const [stack, setStack] = useState<Screen[]>([{ id: 'home' }]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [dailyOpen, setDailyOpen] = useState(false);
  const socketRef = useRef<GameSocket | null>(null);
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
    const ident = { name: p.name, avatar: p.avatar };
    setIdentity(ident);
    void setJSON('identity', ident);
  }, []);

  const attachSocket = useCallback((url: string, token: string) => {
    const s = getSocket(url, token);
    socketRef.current = s;
    s.removeAllListeners('profile');
    s.removeAllListeners('game:start');
    s.on('profile', (p) => setProfile(p));
    // A game started (matchmaking, a friends room, or a resend after reconnect).
    s.on('game:start', (info: GameInfo) => {
      const top = stackRef.current[stackRef.current.length - 1];
      if (top.id === 'game' && top.info?.gameId === info.gameId) return; // the controller handles resyncs
      const ctrl = new OnlineGameController(s, info, configRef.current?.maxMissedTurns ?? null, setProfile);
      const again = pendingOnline.current;
      setStack((st) => [...st.filter((x) => x.id === 'home'), { id: 'game', controller: ctrl, again, info }]);
    });
  }, [setProfile]);

  const connect = useCallback(async (url: string) => {
    setServer(url);
    setStatus('connecting');
    try {
      const ident = identityRef.current;
      const auth = await api.guest(deviceIdRef.current, ident.name, ident.avatar);
      setToken(auth.token);
      setProfile(auth.profile);
      setConfig(await api.config());
      attachSocket(url, auth.token);
      setStatus('online');
    } catch {
      setStatus('offline');
      setProfileState(null);
      setToken(null);
      closeSocket();
      socketRef.current = null;
    }
  }, [attachSocket, setProfile]);

  // Boot: settings, identity, device id, then guest login.
  useEffect(() => {
    void (async () => {
      const s = await getJSON('settings', DEFAULT_SETTINGS);
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
      await connect(s.serverUrl);
    })();
  }, [connect]);

  const updateSettings = useCallback((p: Partial<Settings>) => {
    setSettings((s) => {
      const n = { ...s, ...p };
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

  const value = useMemo<AppCtx>(() => ({
    ready, settings, updateSettings, identity, profile, setProfile, updateIdentity, config, status,
    reconnect: () => connect(settings.serverUrl),
    deleteAccount,
    socket: () => socketRef.current,
    screen, go, replace, back, home,
    setPendingOnline: (a) => { pendingOnline.current = a; },
    toasts, toast, dailyOpen, setDailyOpen,
  }), [ready, settings, updateSettings, identity, profile, setProfile, updateIdentity, config, status, connect, deleteAccount, screen, go, replace, back, home, toasts, toast, dailyOpen]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
