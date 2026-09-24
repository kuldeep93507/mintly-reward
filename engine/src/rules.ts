// Classic Ludo rules as pure functions over an immutable GameState.
// The same code runs on the server (authoritative online games) and in the app
// (vs computer and pass & play), so both always agree on what is legal.

import {
  type Color, HOME, TOKENS_PER_PLAYER, YARD, isSafeIndex, trackIndex,
} from './board.js';

export interface PlayerState {
  color: Color;
  /** Progress of each of the four tokens (see board.ts). */
  tokens: number[];
  /** 1-based finishing place once all four tokens are home (or the game ends). */
  rank: number | null;
  /** Left the game or was removed for missing too many turns. */
  out: boolean;
}

export interface CapturedToken {
  color: Color;
  token: number;
  from: number;
}

export type GameEvent =
  | { type: 'start' }
  | { type: 'roll'; color: Color; value: number; skipped: false }
  | { type: 'roll'; color: Color; value: number; skipped: true; reason: 'no-moves' | 'three-sixes' }
  | {
      type: 'move';
      color: Color;
      token: number;
      from: number;
      to: number;
      captured: CapturedToken[];
      bonus: boolean;
      finished: boolean;
    }
  | { type: 'leave'; color: Color };

export interface GameState {
  players: PlayerState[];
  /** Index into players of whose turn it is. */
  turn: number;
  phase: 'roll' | 'move' | 'over';
  /** The dice value waiting to be used (phase 'move'), or the last roll. */
  dice: number | null;
  /** Consecutive sixes rolled in the current turn chain. */
  sixes: number;
  /** Colours in finishing order. Complete once phase is 'over'. */
  ranking: Color[];
  /** Increments on every accepted action; clients use it to ignore stale updates. */
  seq: number;
  /** What the last action did, for animation and sound. */
  last: GameEvent;
}

export class RuleError extends Error {}

/** Default seating: two players sit opposite each other. */
export function seatColors(count: number): Color[] {
  if (count === 2) return ['red', 'yellow'];
  if (count === 3) return ['red', 'green', 'yellow'];
  if (count === 4) return ['red', 'green', 'yellow', 'blue'];
  throw new RuleError(`Unsupported player count ${count}`);
}

export function newGame(colors: Color[]): GameState {
  if (colors.length < 2 || colors.length > 4 || new Set(colors).size !== colors.length) {
    throw new RuleError('A game needs 2 to 4 distinct colours');
  }
  return {
    players: colors.map((color) => ({ color, tokens: Array(TOKENS_PER_PLAYER).fill(YARD), rank: null, out: false })),
    turn: 0,
    phase: 'roll',
    dice: null,
    sixes: 0,
    ranking: [],
    seq: 0,
    last: { type: 'start' },
  };
}

export function currentPlayer(state: GameState): PlayerState {
  return state.players[state.turn];
}

export function playerOf(state: GameState, color: Color): PlayerState {
  const p = state.players.find((pl) => pl.color === color);
  if (!p) throw new RuleError(`${color} is not in this game`);
  return p;
}

function isActive(p: PlayerState): boolean {
  return !p.out && p.rank === null;
}

export function canMoveToken(progress: number, dice: number): boolean {
  if (progress === YARD) return dice === 6;
  if (progress === HOME) return false;
  return progress + dice <= HOME;
}

/** Token indexes the current player may move with the given dice value. */
export function legalTokens(state: GameState, dice: number | null = state.dice): number[] {
  if (dice === null || state.phase === 'over') return [];
  const p = currentPlayer(state);
  const out: number[] = [];
  p.tokens.forEach((prog, i) => {
    if (canMoveToken(prog, dice)) out.push(i);
  });
  return out;
}

/** Where a token would land: -1 → 0 when opening, otherwise progress + dice. */
export function destination(progress: number, dice: number): number {
  return progress === YARD ? 0 : progress + dice;
}

/** Opponent tokens that would be captured if `color` lands on `progress`. */
export function capturesAt(state: GameState, color: Color, progress: number): CapturedToken[] {
  const idx = trackIndex(color, progress);
  if (idx === null || isSafeIndex(idx)) return [];
  const hits: CapturedToken[] = [];
  for (const p of state.players) {
    if (p.color === color || p.out) continue;
    p.tokens.forEach((prog, token) => {
      if (trackIndex(p.color, prog) === idx) hits.push({ color: p.color, token, from: prog });
    });
  }
  return hits;
}

function clone(state: GameState): GameState {
  return {
    ...state,
    players: state.players.map((p) => ({ ...p, tokens: p.tokens.slice() })),
    ranking: state.ranking.slice(),
  };
}

/** Pass the turn to the next player who is still playing. */
function advance(s: GameState): void {
  const n = s.players.length;
  for (let k = 1; k <= n; k++) {
    const next = (s.turn + k) % n;
    if (isActive(s.players[next])) {
      s.turn = next;
      break;
    }
  }
  s.phase = 'roll';
  s.dice = null;
  s.sixes = 0;
}

/** Ends the game when at most one player is still racing. */
function settleIfOver(s: GameState): boolean {
  const active = s.players.filter(isActive);
  if (active.length > 1) return false;
  for (const p of active) {
    p.rank = s.ranking.length + 1;
    s.ranking.push(p.color);
  }
  // Players who left rank last, most recent leaver ahead of earlier leavers.
  const leavers = s.players.filter((p) => p.out && p.rank === null);
  leavers.reverse();
  for (const p of leavers) {
    p.rank = s.ranking.length + 1;
    s.ranking.push(p.color);
  }
  s.phase = 'over';
  s.dice = null;
  return true;
}

export function applyRoll(state: GameState, value: number): GameState {
  if (state.phase !== 'roll') throw new RuleError('Not time to roll');
  if (!Number.isInteger(value) || value < 1 || value > 6) throw new RuleError('Bad dice value');
  const s = clone(state);
  const color = currentPlayer(s).color;
  s.seq++;
  s.dice = value;
  s.sixes = value === 6 ? s.sixes + 1 : 0;
  if (s.sixes === 3) {
    s.last = { type: 'roll', color, value, skipped: true, reason: 'three-sixes' };
    advance(s);
    s.dice = value;
    return s;
  }
  if (legalTokens(s, value).length === 0) {
    s.last = { type: 'roll', color, value, skipped: true, reason: 'no-moves' };
    advance(s);
    s.dice = value;
    return s;
  }
  s.phase = 'move';
  s.last = { type: 'roll', color, value, skipped: false };
  return s;
}

export function applyMove(state: GameState, token: number): GameState {
  if (state.phase !== 'move' || state.dice === null) throw new RuleError('Not time to move');
  if (!legalTokens(state).includes(token)) throw new RuleError('That token cannot move');
  const s = clone(state);
  const dice = s.dice!;
  const player = currentPlayer(s);
  const from = player.tokens[token];
  const to = destination(from, dice);
  player.tokens[token] = to;

  const captured = capturesAt(state, player.color, to);
  for (const c of captured) playerOf(s, c.color).tokens[c.token] = YARD;

  const finishedToken = to === HOME;
  let finishedPlayer = false;
  if (player.tokens.every((t) => t === HOME)) {
    finishedPlayer = true;
    player.rank = s.ranking.length + 1;
    s.ranking.push(player.color);
  }

  const bonus = !finishedPlayer && (dice === 6 || captured.length > 0 || finishedToken);
  s.seq++;
  s.last = { type: 'move', color: player.color, token, from, to, captured, bonus, finished: finishedPlayer };

  if (settleIfOver(s)) return s;
  if (bonus) {
    s.phase = 'roll';
    s.dice = null;
    // A capture or home bonus after a non-six starts a fresh six count.
    if (dice !== 6) s.sixes = 0;
  } else {
    advance(s);
  }
  return s;
}

/** A player leaves (quits, disconnects for good, or misses too many turns). */
export function applyLeave(state: GameState, color: Color): GameState {
  const s = clone(state);
  const p = playerOf(s, color);
  if (p.out || p.rank !== null || s.phase === 'over') return state;
  p.out = true;
  p.tokens = p.tokens.map(() => YARD);
  s.seq++;
  s.last = { type: 'leave', color };
  if (settleIfOver(s)) return s;
  if (currentPlayer(s).color === color) advance(s);
  return s;
}

export function isOver(state: GameState): boolean {
  return state.phase === 'over';
}

/** Steps a token passes through, for hop-by-hop animation (excludes `from`, includes `to`). */
export function movePath(from: number, to: number): number[] {
  if (from === YARD) return [0];
  const path: number[] = [];
  for (let p = from + 1; p <= to; p++) path.push(p);
  return path;
}

