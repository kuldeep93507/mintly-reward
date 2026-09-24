// Snakes & Ladders as pure functions over an immutable state (offline mode).
// 100 squares, a fixed layout, exact roll needed to land on 100,
// and a six gives another roll. The first player to reach 100 wins.

import type { Color } from './board.js';
import type { DiceOverride } from './owner.js';

export const SNAKES_GOAL = 100;

/** Ladders: bottom -> top. */
export const LADDERS: Readonly<Record<number, number>> = {
  1: 38, 4: 14, 9: 31, 21: 42, 28: 84, 36: 44, 51: 67, 71: 91, 80: 100,
};

/** Snakes: head -> tail. */
export const SNAKES: Readonly<Record<number, number>> = {
  16: 6, 47: 26, 49: 11, 56: 53, 62: 19, 64: 60, 87: 24, 93: 73, 95: 75, 98: 78,
};

export interface SnakesPlayer {
  color: Color;
  /** 0 = not on the board yet, 1..100 = square. */
  pos: number;
}

export type SnakesEvent =
  | { type: 'start' }
  | {
      type: 'roll';
      color: Color;
      value: number;
      from: number;
      /** Square reached by walking `value` steps (== from when the roll overshoots 100). */
      landed: number;
      /** Final square after any snake or ladder. */
      to: number;
      jump: 'snake' | 'ladder' | null;
      /** The roll would pass 100, so the player stays put. */
      overshoot: boolean;
      /** Rolled a six (and did not win): roll again. */
      bonus: boolean;
      won: boolean;
    };

export interface SnakesState {
  players: SnakesPlayer[];
  turn: number;
  phase: 'roll' | 'over';
  dice: number | null;
  /** Finishing order once the game is over: the winner first, then by square. */
  ranking: Color[];
  seq: number;
  last: SnakesEvent;
}

export class SnakesError extends Error {}

export function newSnakesGame(colors: Color[]): SnakesState {
  if (colors.length < 2 || colors.length > 4 || new Set(colors).size !== colors.length) {
    throw new SnakesError('A game needs 2 to 4 distinct colours');
  }
  return { players: colors.map((color) => ({ color, pos: 0 })), turn: 0, phase: 'roll', dice: null, ranking: [], seq: 0, last: { type: 'start' } };
}

/** Where a player standing on `from` ends up after rolling `value`. */
export function snakesOutcome(from: number, value: number): { landed: number; to: number; jump: 'snake' | 'ladder' | null; overshoot: boolean } {
  if (from + value > SNAKES_GOAL) return { landed: from, to: from, jump: null, overshoot: true };
  const landed = from + value;
  if (LADDERS[landed] !== undefined) return { landed, to: LADDERS[landed], jump: 'ladder', overshoot: false };
  if (SNAKES[landed] !== undefined) return { landed, to: SNAKES[landed], jump: 'snake', overshoot: false };
  return { landed, to: landed, jump: null, overshoot: false };
}

export function applySnakesRoll(state: SnakesState, value: number): SnakesState {
  if (state.phase !== 'roll') throw new SnakesError('Game is over');
  if (!Number.isInteger(value) || value < 1 || value > 6) throw new SnakesError('Bad dice value');
  const players = state.players.map((p) => ({ ...p }));
  const me = players[state.turn];
  const from = me.pos;
  const o = snakesOutcome(from, value);
  me.pos = o.to;
  const won = o.to === SNAKES_GOAL;
  const bonus = value === 6 && !won;
  const s: SnakesState = {
    ...state,
    players,
    dice: value,
    seq: state.seq + 1,
    last: { type: 'roll', color: me.color, value, from, landed: o.landed, to: o.to, jump: o.jump, overshoot: o.overshoot, bonus, won },
  };
  if (won) {
    s.phase = 'over';
    const others = players.filter((p) => p !== me).sort((a, b) => b.pos - a.pos);
    s.ranking = [me.color, ...others.map((p) => p.color)];
  } else if (!bonus) {
    s.turn = (state.turn + 1) % players.length;
  }
  return s;
}

/** Squares walked for a roll, for hop-by-hop animation (excludes `from`, includes `landed`). */
export function snakesPath(from: number, landed: number): number[] {
  const out: number[] = [];
  for (let p = from + 1; p <= landed; p++) out.push(p);
  return out;
}

/** Row/column (0-based, row 0 at the top) of square 1..100 on a boustrophedon 10x10 board. */
export function snakesCell(square: number): [row: number, col: number] {
  const i = Math.max(1, Math.min(SNAKES_GOAL, square)) - 1;
  const rowFromBottom = Math.floor(i / 10);
  const k = i % 10;
  const col = rowFromBottom % 2 === 0 ? k : 9 - k;
  return [9 - rowFromBottom, col];
}

/** Best dice value for the current player: win if possible, otherwise the furthest final square. */
export function snakesBestRoll(state: SnakesState): number {
  const from = state.players[state.turn].pos;
  let best = 6;
  let bestScore = -Infinity;
  for (let v = 6; v >= 1; v--) {
    const o = snakesOutcome(from, v);
    const score = o.to === SNAKES_GOAL ? 1000 : o.to - from + (v === 6 ? 3 : 0);
    if (score > bestScore) { bestScore = score; best = v; }
  }
  return best;
}

/** Owner dice override for Snakes & Ladders, or null for a normal roll. */
export function snakesOverrideValue(state: SnakesState, o: DiceOverride | null | undefined): number | null {
  if (!o) return null;
  if (o.mode === 'once') return o.value !== undefined && Number.isInteger(o.value) && o.value >= 1 && o.value <= 6 ? o.value : null;
  if (o.mode === 'best') return snakesBestRoll(state);
  const from = state.players[state.turn].pos;
  // Always 6, unless a six would overshoot 100 — then take the best legal value.
  return from + 6 <= SNAKES_GOAL ? 6 : snakesBestRoll(state);
}
