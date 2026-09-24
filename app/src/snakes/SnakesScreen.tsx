import { useCallback, useEffect, useRef, useState } from 'react';
import { snakesPath, type Color, type SnakesState } from '@ludo/engine';
import { useApp } from '../state/AppContext';
import { setBackOverride } from '../state/back';
import type { SnakesSetup } from '../state/types';
import { play } from '../audio/sfx';
import { buzz } from '../native/haptics';
import { wait } from '../config';
import { Confirm, IconBtn } from '../ui/kit';
import { Avatar } from '../ui/Avatar';
import { Dice } from '../game/Dice';
import { Pawn } from '../game/Pawn';
import { PALETTE } from '../game/palette';
import { BOARD_LOOKS } from '../game/theme';
import type { GameOutcome } from '../game/controller';
import { SnakesBoard, squarePoint } from './SnakesBoard';
import type { SnakesController } from './SnakesController';

const ROLL_MS = 500;
const STEP_MS = 170;
const STACK: [number, number][] = [[-0.17, -0.12], [0.17, -0.12], [-0.17, 0.16], [0.17, 0.16]];

interface Move { sq: number; mode: 'hop' | 'slide'; n: number }

export function SnakesScreen({ controller: ctrl, again }: { controller: SnakesController; again: SnakesSetup }) {
  const app = useApp();
  const [shown, setShown] = useState<SnakesState>(() => ctrl.snapshot());
  const [moves, setMoves] = useState<Partial<Record<Color, Move>>>({});
  const [dice, setDice] = useState({ color: ctrl.snapshot().players[0].color as Color, value: 6, rolling: false });
  const [busy, setBusy] = useState(false);
  const [toasts, setToasts] = useState<{ id: number; text: string }[]>([]);
  const [confirmExit, setConfirmExit] = useState(false);
  const [outcome, setOutcome] = useState<GameOutcome | null>(null);
  const rollStarted = useRef(0);
  const acted = useRef(-1);

  const toast = useCallback((text: string) => {
    const id = Math.random();
    setToasts((t) => [...t.slice(-1), { id, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 1500);
  }, []);

  useEffect(() => {
    let alive = true;
    let current = ctrl.snapshot();
    const queue: SnakesState[] = [];
    let running = false;
    let n = 0;
    const animate = async (s: SnakesState) => {
      const ev = s.last;
      if (ev.type !== 'roll' || s.seq !== current.seq + 1) return;
      const since = performance.now() - rollStarted.current;
      if (since > ROLL_MS + 400) play('dice');
      setDice({ color: ev.color, value: ev.value, rolling: true });
      await wait(Math.max(120, ROLL_MS - (since < ROLL_MS + 400 ? since : 0)));
      if (!alive) return;
      rollStarted.current = 0;
      setDice({ color: ev.color, value: ev.value, rolling: false });
      if (ev.overshoot) {
        toast(`Need exactly ${100 - ev.from}`);
        await wait(700);
        return;
      }
      for (const sq of snakesPath(ev.from, ev.landed)) {
        if (!alive) return;
        setMoves((m) => ({ ...m, [ev.color]: { sq, mode: 'hop', n: ++n } }));
        play('step');
        await wait(STEP_MS);
      }
      if (ev.jump) {
        await wait(120);
        if (ev.jump === 'ladder') { play('six'); toast('Ladder! Climb up'); } else { play('capture'); buzz('heavy'); toast('Snake bite!'); }
        setMoves((m) => ({ ...m, [ev.color]: { sq: ev.to, mode: 'slide', n: ++n } }));
        await wait(850);
      }
      if (ev.won) { play('home'); buzz('success'); await wait(500); }
      else if (ev.bonus) toast('Six! Roll again');
      await wait(120);
    };
    const run = async () => {
      running = true;
      setBusy(true);
      while (queue.length && alive) {
        const s = queue.shift()!;
        if (s.seq <= current.seq) continue;
        await animate(s);
        if (!alive) return;
        current = s;
        setMoves({});
        setShown(s);
      }
      running = false;
      if (!alive) return;
      setBusy(false);
      ctrl.displayed(current.seq);
    };
    const off = ctrl.subscribe((s) => { queue.push(s); if (!running) void run(); });
    const offOver = ctrl.onOver((o) => setOutcome(o));
    ctrl.displayed(current.seq);
    return () => { alive = false; off(); offOver(); };
  }, [ctrl, toast]);

  useEffect(() => {
    if (!outcome || busy) return;
    let alive = true;
    void wait(900).then(() => { if (alive) app.replace({ id: 'result', outcome, again }); });
    return () => { alive = false; };
  }, [outcome, busy, again, app]);

  useEffect(() => {
    setBackOverride(() => setConfirmExit(true));
    return () => setBackOverride(null);
  }, []);
  useEffect(() => () => ctrl.dispose(), [ctrl]);

  const cur = shown.players[shown.turn];
  const curSeat = ctrl.seats[shown.turn];
  const canRoll = !busy && shown.phase === 'roll' && curSeat.controllable && !ctrl.isBotTurn() && acted.current !== shown.seq && !dice.rolling;
  const doRoll = () => {
    acted.current = shown.seq;
    rollStarted.current = performance.now();
    play('dice');
    setDice((d) => ({ ...d, color: cur.color, rolling: true }));
    ctrl.roll();
  };

  // Token positions (animated square, else the settled one); stack tokens sharing a square.
  const tokens = shown.players.map((p, i) => ({ color: p.color, i, sq: moves[p.color]?.sq ?? p.pos, m: moves[p.color] }));
  const bySq = new Map<number, number[]>();
  tokens.forEach((t) => bySq.set(Math.max(1, t.sq), [...(bySq.get(Math.max(1, t.sq)) ?? []), t.i]));
  const look = BOARD_LOOKS[app.theme.board];

  return (
    <div className="screen game-screen snakes-screen">
      <div className="game-top">
        <IconBtn icon="menu" label="Menu" onClick={() => setConfirmExit(true)} />
        <div className="game-title"><span className="mode-pill">Snakes &amp; Ladders</span></div>
        <span className="icon-btn-spacer" />
      </div>
      <div className="game-mid">
        <div className="board-area">
          <div className="board-frame" style={{ ['--frame' as string]: look.frame, ['--frame-edge' as string]: look.frameEdge }}>
            <div className="board-rot">
              <SnakesBoard theme={app.theme.board} />
              <div className="tokens-layer">
                {tokens.map((t) => {
                  const group = bySq.get(Math.max(1, t.sq))!;
                  let [x, y] = squarePoint(Math.max(1, t.sq));
                  if (group.length > 1) { const [dx, dy] = STACK[group.indexOf(t.i) % 4]; x += dx; y += dy; }
                  return (
                    <div key={t.color} className={`token sl-token ${t.m ? 'm-' + t.m.mode : ''} ${t.sq === 0 ? 'waiting' : ''}`}
                      style={{ left: `${x * 10}%`, top: `${y * 10}%`, zIndex: t.color === cur.color ? 40 : 10 + Math.round(y) }}
                      data-token={t.color} data-square={t.sq}>
                      <div className="token-rot" style={{ transform: `scale(${group.length > 1 ? 1.1 : 1.35})` }}>
                        <div className={`token-pawn ${t.m?.mode === 'hop' ? 'hop' : ''}`} key={t.m?.n ?? 0}><Pawn color={t.color} /></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="game-toasts">{toasts.map((t) => <div key={t.id} className="game-toast">{t.text}</div>)}</div>
          </div>
        </div>
        <div className="sl-players">
          {ctrl.seats.map((s, i) => {
            const active = i === shown.turn && shown.phase !== 'over';
            return (
              <div key={s.color} className={`sl-player ${active ? 'active' : ''}`} style={{ ['--pc' as string]: PALETTE[s.color].main, ['--pcd' as string]: PALETTE[s.color].dark }}>
                <Avatar id={s.avatar} size={34} />
                <span className="sl-pname">{s.isYou ? 'You' : s.name}</span>
                <span className="sl-psq">{shown.players[i].pos || '—'}</span>
                {s.isBot && <span className="cpu-badge">CPU</span>}
              </div>
            );
          })}
        </div>
        <div className="sl-dice-row">
          <Dice value={dice.color === cur.color || dice.rolling ? dice.value : 6} rolling={dice.rolling} canRoll={canRoll} onRoll={doRoll} color={PALETTE[dice.rolling ? dice.color : cur.color].main} />
        </div>
        <div className="turn-hint">
          {shown.phase !== 'over' && (canRoll ? <span className="hint-go">Tap the dice to roll!</span> : <span>{curSeat.isYou ? 'Your turn' : `${curSeat.name}'s turn`}</span>)}
        </div>
      </div>
      {confirmExit && (
        <Confirm title="Leave game?" text="Your progress in this game will be lost." yes="Leave" no="Stay"
          onYes={() => { ctrl.dispose(); app.home(); }} onNo={() => setConfirmExit(false)} />
      )}
    </div>
  );
}
