import { useCallback, useEffect, useRef, useState } from 'react';
import { HOME, YARD, movePath, type Color, type GameState } from '@ludo/engine';
import { play } from '../audio/sfx';
import { buzz } from '../native/haptics';
import { wait } from '../config';
import { ordinal } from '../ui/kit';
import type { GameController, Snapshot } from './controller';

export interface TokenOverride { p: number; mode: 'hop' | 'fly'; n: number }
export interface DiceView { color: Color; value: number; rolling: boolean }

const STEP_MS = 110;
const ROLL_MS = 500;

/**
 * Turns the stream of authoritative snapshots into an animated display.
 * Snapshots are queued and played one by one (dice tumble, token hops, captures),
 * so rapid updates never skip animations; if the queue backs up or a seq is missed
 * we jump straight to the latest state.
 */
export function useGameDisplay(ctrl: GameController, toast: (t: string) => void) {
  const [snap, setSnap] = useState<Snapshot>(() => ctrl.snapshot());
  const [shown, setShown] = useState<GameState>(() => ctrl.snapshot().state);
  const [overrides, setOverrides] = useState<Record<string, TokenOverride>>({});
  const [dice, setDice] = useState<DiceView>(() => {
    const s = ctrl.snapshot().state;
    return { color: s.players[s.turn].color, value: s.dice ?? 6, rolling: false };
  });
  const [busy, setBusy] = useState(false);
  const [sparkle, setSparkle] = useState<{ color: Color; n: number } | null>(null);
  const rollStarted = useRef(0);
  const toastRef = useRef(toast);
  toastRef.current = toast;

  useEffect(() => {
    let alive = true;
    let current = ctrl.snapshot().state;
    const queue: Snapshot[] = [];
    let running = false;
    let hopN = 0;
    const nameOf = (c: Color) => ctrl.snapshot().seats.find((s) => s.color === c)?.name ?? c;
    const key = (c: Color, t: number) => c + t;

    const animate = async (next: GameState, backlog: number) => {
      const ev = next.last;
      if (next.seq !== current.seq + 1 || backlog > 2) return; // snap
      if (ev.type === 'roll') {
        const since = performance.now() - rollStarted.current;
        if (since > ROLL_MS + 400) play('dice'); // not started by a local tap
        setDice({ color: ev.color, value: ev.value, rolling: true });
        await wait(Math.max(120, ROLL_MS - (since < ROLL_MS + 400 ? since : 0)));
        if (!alive) return;
        rollStarted.current = 0;
        setDice({ color: ev.color, value: ev.value, rolling: false });
        if (ev.value === 6 && !ev.skipped) { play('six'); buzz('light'); }
        if (ev.skipped) {
          toastRef.current(ev.reason === 'three-sixes' ? 'Three sixes — turn lost' : 'No moves');
          await wait(850);
        } else {
          await wait(150);
        }
      } else if (ev.type === 'move') {
        const path = movePath(ev.from, ev.to);
        for (const p of path) {
          if (!alive) return;
          hopN++;
          setOverrides((o) => ({ ...o, [key(ev.color, ev.token)]: { p, mode: 'hop', n: hopN } }));
          play('step');
          await wait(ev.from === YARD ? 220 : STEP_MS);
        }
        await wait(60);
        if (ev.captured.length) {
          play('capture');
          buzz('heavy');
          toastRef.current('Captured!');
          setOverrides((o) => {
            const n = { ...o };
            for (const c of ev.captured) n[key(c.color, c.token)] = { p: YARD, mode: 'fly', n: ++hopN };
            return n;
          });
          await wait(520);
        }
        if (ev.to === HOME) {
          play('home');
          setSparkle({ color: ev.color, n: ++hopN });
          await wait(350);
        }
        if (ev.finished) {
          const rank = next.players.find((p) => p.color === ev.color)?.rank ?? 1;
          toastRef.current(`${nameOf(ev.color)} finished ${ordinal(rank)}!`);
          buzz('success');
          await wait(600);
        } else if (ev.bonus && !ev.captured.length && ev.to !== HOME) {
          toastRef.current('Six! Roll again');
        } else if (ev.bonus && ev.to === HOME && !ev.captured.length) {
          toastRef.current('Home! Roll again');
        }
      } else if (ev.type === 'leave') {
        toastRef.current(`${nameOf(ev.color)} left the game`);
        await wait(500);
      }
    };

    const run = async () => {
      running = true;
      setBusy(true);
      while (queue.length && alive) {
        const s = queue.shift()!;
        if (s.state.seq <= current.seq && !s.resync) continue;
        if (!s.resync) await animate(s.state, queue.length);
        if (!alive) return;
        current = s.state;
        setOverrides({});
        setShown(s.state);
        if (s.state.last.type !== 'roll' || s.resync) {
          setDice((d) => (d.rolling ? d : { ...d, color: s.state.players[s.state.turn].color, value: s.state.dice ?? d.value }));
        }
      }
      running = false;
      if (!alive) return;
      setBusy(false);
      ctrl.displayed(current.seq);
    };

    const unsub = ctrl.subscribe((s) => {
      setSnap(s);
      queue.push(s);
      if (!running) void run();
    });
    ctrl.displayed(current.seq);
    return () => { alive = false; unsub(); };
  }, [ctrl]);

  /** Called on a local tap so the dice starts tumbling before the result arrives. */
  const startRoll = useCallback((color: Color) => {
    rollStarted.current = performance.now();
    play('dice');
    setDice((d) => ({ ...d, color, rolling: true }));
  }, []);
  const cancelRoll = useCallback(() => setDice((d) => ({ ...d, rolling: false })), []);

  return { snap, shown, overrides, dice, busy, sparkle, startRoll, cancelRoll };
}
