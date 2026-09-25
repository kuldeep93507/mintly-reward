import { useCallback, useEffect, useRef, useState } from 'react';
import { ALL_COLORS, EMOJIS, QUICK_CHAT, legalTokens, type Color } from '@ludo/engine';
import { useApp } from '../state/AppContext';
import { setBackOverride } from '../state/back';
import type { PlayAgain } from '../state/types';
import { play } from '../audio/sfx';
import { onResume } from '../native/platform';
import { Btn, Confirm, IconBtn, Modal, Toggle } from '../ui/kit';
import { Icon } from '../ui/Icon';
import { HowToContent } from '../screens/HowTo';
import { wait } from '../config';
import { Board } from './Board';
import { BOARD_LOOKS } from './theme';
import { TokensLayer } from './TokensLayer';
import { PlayerPanel } from './PlayerPanel';
import { useGameDisplay } from './useGameDisplay';
import type { GameController, GameOutcome } from './controller';

const autoplay = () => !!(window as unknown as { __ludoAutoplay?: boolean }).__ludoAutoplay;

export function GameScreen({ controller: ctrl, again }: { controller: GameController; again: PlayAgain }) {
  const app = useApp();
  const [toasts, setToasts] = useState<{ id: number; text: string }[]>([]);
  const toast = useCallback((text: string) => {
    const id = Math.random();
    setToasts((t) => [...t.slice(-1), { id, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 1500);
  }, []);
  const { snap, shown, overrides, dice, busy, sparkle, startRoll, cancelRoll } = useGameDisplay(ctrl, toast);
  const [menu, setMenu] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  const [howto, setHowto] = useState(false);
  const [tray, setTray] = useState(false);
  const [bubbles, setBubbles] = useState<Partial<Record<Color, { text: string; id: number }>>>({});
  const [outcome, setOutcome] = useState<GameOutcome | null>(null);
  const [connected, setConnected] = useState(true);
  const acted = useRef(-1); // seq at which we already sent an action (avoid double taps)

  const look = BOARD_LOOKS[app.theme.board];
  const cur = shown.players[shown.turn];
  const curSeat = snap.seats.find((s) => s.color === cur.color);
  const myTurn = !busy && shown.phase !== 'over' && !!curSeat?.controllable && !autoplay() && acted.current !== shown.seq;
  const canRoll = myTurn && shown.phase === 'roll' && !dice.rolling;
  const movable = myTurn && shown.phase === 'move' ? legalTokens(shown) : [];

  // Rotate the board so your yard sits bottom-left (like holding the board yourself).
  const youIdx = ctrl.you ? ALL_COLORS.indexOf(ctrl.you) : 3;
  const rotation = ((3 - youIdx + 4) % 4) * 90;
  const cornerOf = (c: Color) => ((ALL_COLORS.indexOf(c) + rotation / 90) % 4) as 0 | 1 | 2 | 3;

  const doRoll = useCallback(() => {
    if (acted.current === shown.seq) return; // double tap
    acted.current = shown.seq;
    startRoll(cur.color);
    ctrl.roll();
  }, [ctrl, cur.color, shown.seq, startRoll]);
  const doMove = useCallback((t: number) => {
    if (acted.current === shown.seq) return; // double tap: one move per state
    acted.current = shown.seq;
    play('click');
    ctrl.move(t);
  }, [ctrl, shown.seq]);

  // Auto-move when there is only one real choice.
  useEffect(() => {
    if (!app.settings.autoMove || movable.length === 0) return;
    const progs = new Set(movable.map((t) => cur.tokens[t]));
    if (movable.length !== 1 && progs.size !== 1) return;
    const t = setTimeout(() => { if (acted.current !== shown.seq) doMove(movable[0]); }, 380);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown.seq, busy, app.settings.autoMove]);

  // "Your turn" ping.
  const lastPing = useRef(-1);
  useEffect(() => {
    if (canRoll && lastPing.current !== shown.seq && (shown.last.type !== 'move' || !shown.last.bonus)) {
      lastPing.current = shown.seq;
      play('turn');
    }
  }, [canRoll, shown.seq, shown.last]);

  // Notices (errors from the server) reset a pending action.
  useEffect(() => ctrl.onNotice((m) => { acted.current = -1; cancelRoll(); toast(m); }), [ctrl, cancelRoll, toast]);
  useEffect(() => ctrl.onOver((o) => setOutcome(o)), [ctrl]);
  useEffect(() => ctrl.onReaction(({ color, text }) => {
    const id = Math.random();
    play('pop');
    setBubbles((b) => ({ ...b, [color]: { text, id } }));
    setTimeout(() => setBubbles((b) => (b[color]?.id === id ? { ...b, [color]: undefined } : b)), 2600);
  }), [ctrl]);

  // Show the result once every animation has played.
  const { replace } = app;
  useEffect(() => {
    if (!outcome || busy) return;
    let alive = true;
    void wait(1100).then(() => { if (alive) replace({ id: 'result', outcome, again }); });
    return () => { alive = false; };
  }, [outcome, busy, again, replace]);

  // Online: resync on resume, track connection.
  useEffect(() => {
    if (!ctrl.online) return;
    const off = onResume(() => ctrl.sync());
    const s = app.socket();
    const on = () => setConnected(true);
    const offc = () => setConnected(false);
    s?.on('connect', on);
    s?.on('disconnect', offc);
    return () => { off(); s?.off('connect', on); s?.off('disconnect', offc); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctrl]);

  useEffect(() => {
    setBackOverride(() => setConfirmExit(true));
    return () => setBackOverride(null);
  }, []);

  useEffect(() => () => ctrl.dispose(), [ctrl]);

  const exit = () => {
    ctrl.leave();
    app.home();
  };

  const corners: (Color | undefined)[] = [undefined, undefined, undefined, undefined];
  for (const p of shown.players) corners[cornerOf(p.color)] = p.color;
  const panel = (corner: 0 | 1 | 2 | 3) => {
    const color = corners[corner];
    const p = shown.players.find((x) => x.color === color);
    const seat = snap.seats.find((s) => s.color === color);
    const active = !!p && cur.color === color && shown.phase !== 'over';
    const liveTurn = snap.state.players[snap.state.turn]?.color === color && !busy;
    return (
      <PlayerPanel
        seat={seat} corner={corner} active={active} rank={p?.rank ?? null} out={!!p?.out}
        dice={dice} canRoll={active && canRoll} onRoll={doRoll}
        deadline={liveTurn ? snap.deadline : null} turnMs={ctrl.turnSeconds ? ctrl.turnSeconds * 1000 : null}
        hearts={ctrl.maxMissed && color ? { max: ctrl.maxMissed, left: ctrl.maxMissed - (snap.missed[color] ?? 0) } : null}
        bubble={color ? bubbles[color] ?? null : null}
      />
    );
  };

  return (
    <div className="screen game-screen">
      <div className="game-top">
        <IconBtn icon="menu" label="Menu" onClick={() => setMenu(true)} />
        <div className="game-title">
          {ctrl.online && ctrl.stake > 0 ? (
            <span className="prize-pill"><Icon name="trophy" size={16} /> Win <Icon name="coin" size={18} /> {ctrl.prizes[0]?.toLocaleString()}</span>
          ) : (
            <span className="mode-pill">{again.kind === 'bots' ? 'Vs Computer' : again.kind === 'pass' ? 'Pass & Play' : 'Friends'}</span>
          )}
          {ctrl.online && !connected && <span className="reconnecting"><Icon name="wifiOff" size={14} /> Reconnecting…</span>}
        </div>
        {ctrl.online ? <IconBtn icon="smile" label="Chat" onClick={() => setTray((t) => !t)} /> : <span className="icon-btn-spacer" />}
      </div>

      <div className="game-mid">
      <div className="panels-row">{panel(0)}{panel(1)}</div>
      <div className="board-area">
        <div className="board-frame" style={{ ['--frame' as string]: look.frame, ['--frame-edge' as string]: look.frameEdge }}>
          <div className="board-rot" style={{ transform: `rotate(${rotation}deg)` }}>
            <Board />
            <TokensLayer state={shown} overrides={overrides} movable={movable} onMove={doMove} rotation={rotation} sparkle={sparkle} />
          </div>
          <div className="game-toasts">
            {toasts.map((t) => <div key={t.id} className="game-toast">{t.text}</div>)}
          </div>
        </div>
      </div>
      <div className="panels-row">{panel(3)}{panel(2)}</div>
      <div className="turn-hint">
        {shown.phase !== 'over' && curSeat && (
          canRoll ? <span className="hint-go">Tap the dice to roll!</span>
            : movable.length > 0 ? <span className="hint-go">Tap a glowing token</span>
              : <span>{curSeat.isYou ? 'Your turn' : `${curSeat.name}'s turn`}</span>
        )}
      </div>

      </div>
      {tray && (
        <div className="chat-tray" onClick={(e) => e.stopPropagation()}>
          <div className="emoji-grid">
            {EMOJIS.map((e) => <button key={e} className="emoji" onClick={() => { ctrl.react(e); setTray(false); }}>{e}</button>)}
          </div>
          <div className="quick-grid">
            {QUICK_CHAT.map((q) => <button key={q} className="quick" onClick={() => { ctrl.react(q); setTray(false); }}>{q}</button>)}
          </div>
        </div>
      )}

      {menu && (
        <Modal title="Menu" onClose={() => setMenu(false)}>
          <div className="menu-list">
            <Toggle label="Sound" on={app.settings.sound} onChange={(v) => app.updateSettings({ sound: v })} />
            <Toggle label="Auto move" on={app.settings.autoMove} onChange={(v) => app.updateSettings({ autoMove: v })} />
            <Btn variant="blue" onClick={() => { setMenu(false); setHowto(true); }}><Icon name="book" /> How to Play</Btn>
            <Btn variant="red" onClick={() => { setMenu(false); setConfirmExit(true); }}><Icon name="exit" /> Exit Game</Btn>
          </div>
        </Modal>
      )}
      {howto && <Modal title="How to Play" onClose={() => setHowto(false)} className="tall"><HowToContent /></Modal>}
      {confirmExit && (
        <Confirm
          title="Leave game?"
          text={ctrl.online ? 'If you leave now you forfeit this match and lose your entry fee.' : 'Your progress in this game will be lost.'}
          yes="Leave" no="Stay" onYes={exit} onNo={() => setConfirmExit(false)}
        />
      )}
    </div>
  );
}
