import { useEffect, useRef, useState } from 'react';
import { AppProvider, useApp } from './state/AppContext';
import { getBackOverride } from './state/back';
import { exitApp, onBackButton } from './native/platform';
import { Confirm } from './ui/kit';
import { Home } from './screens/Home';
import { OnlineScreen, Matchmaking } from './screens/Online';
import { FriendsScreen, Lobby } from './screens/Friends';
import { BotsSetupScreen, PassSetupScreen } from './screens/Setup';
import { ResultScreen } from './screens/Result';
import { ProfileScreen } from './screens/Profile';
import { LeaderboardScreen } from './screens/Leaderboard';
import { SettingsScreen } from './screens/Settings';
import { HowToScreen } from './screens/HowTo';
import { DailyModal } from './screens/Daily';
import { GameScreen } from './game/GameScreen';
import { Logo } from './screens/Home';

function Screens() {
  const app = useApp();
  const s = app.screen;
  switch (s.id) {
    case 'home': return <Home />;
    case 'online': return <OnlineScreen />;
    case 'matchmaking': return <Matchmaking players={s.players} stake={s.stake} />;
    case 'friends': return <FriendsScreen />;
    case 'lobby': return <Lobby room={s.room} />;
    case 'bots': return <BotsSetupScreen />;
    case 'pass': return <PassSetupScreen />;
    case 'game': return <GameScreen controller={s.controller} again={s.again} />;
    case 'result': return <ResultScreen outcome={s.outcome} again={s.again} />;
    case 'profile': return <ProfileScreen />;
    case 'leaderboard': return <LeaderboardScreen />;
    case 'settings': return <SettingsScreen />;
    case 'howto': return <HowToScreen />;
  }
}

function Shell() {
  const app = useApp();
  const [askExit, setAskExit] = useState(false);
  const ref = useRef(app);
  ref.current = app;

  // Android back button: screen override first, then pop, then ask to exit on Home.
  useEffect(() => onBackButton(() => {
    const a = ref.current;
    if (a.dailyOpen) { a.setDailyOpen(false); return; }
    const o = getBackOverride();
    if (o) { o(); return; }
    if (a.screen.id === 'home') setAskExit(true);
    else if (a.screen.id === 'result') a.home();
    else a.back();
  }), []);

  if (!app.ready) {
    return <div className="screen boot"><Logo /><span className="spinner" /></div>;
  }
  // Keying by screen id replays the enter animation on navigation.
  const key = app.screen.id === 'game' ? 'game' + (app.screen.info?.gameId ?? '') : app.screen.id;
  return (
    <>
      <div className="screen-wrap" key={key}><Screens /></div>
      {app.dailyOpen && <DailyModal />}
      <div className="toasts">{app.toasts.map((t) => <div key={t.id} className="toast">{t.text}</div>)}</div>
      {askExit && <Confirm title="Exit Ludo Mintly?" text="See you soon!" yes="Exit" onYes={exitApp} onNo={() => setAskExit(false)} />}
    </>
  );
}

export function App() {
  return (
    <AppProvider>
      <div className="app-bg" />
      <Shell />
    </AppProvider>
  );
}
