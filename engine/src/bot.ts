// Computer player. Scores every legal move with simple Ludo heuristics:
// capture > finish > open a token > reach safety, and avoid landing where an
// opponent can hit it next turn.

import { type Color, HOME, LAST_TRACK, TRACK_LENGTH, YARD, isSafeIndex, trackIndex } from './board.js';
import { type GameState, capturesAt, currentPlayer, destination, legalTokens } from './rules.js';

export type BotLevel = 'easy' | 'normal' | 'hard';

/** How many opponent tokens could land on track index `idx` with one roll (1..6). */
function threatsAt(state: GameState, color: Color, idx: number): number {
  if (isSafeIndex(idx)) return 0;
  let n = 0;
  for (const p of state.players) {
    if (p.color === color || p.out) continue;
    for (const prog of p.tokens) {
      const at = trackIndex(p.color, prog);
      if (at === null) continue;
      const dist = (idx - at + TRACK_LENGTH) % TRACK_LENGTH;
      // The opponent must reach idx without turning into its own home column first.
      if (dist >= 1 && dist <= 6 && prog + dist <= LAST_TRACK) n++;
    }
  }
  return n;
}

export function scoreMove(state: GameState, token: number): number {
  const player = currentPlayer(state);
  const dice = state.dice!;
  const from = player.tokens[token];
  const to = destination(from, dice);
  let score = to * 0.6;

  const captured = capturesAt(state, player.color, to);
  if (captured.length) score += 120 + captured.reduce((a, c) => a + c.from, 0);
  if (to === HOME) score += 90;
  if (from === YARD) score += 70;
  if (from <= LAST_TRACK && to > LAST_TRACK && to !== HOME) score += 55;

  const toIdx = trackIndex(player.color, to);
  if (toIdx !== null) {
    if (isSafeIndex(toIdx)) score += 30;
    score -= threatsAt(state, player.color, toIdx) * 40;
  }
  const fromIdx = trackIndex(player.color, from);
  if (fromIdx !== null && threatsAt(state, player.color, fromIdx) > 0) score += 35;
  return score;
}

/** Picks a token for the current player. `random` is only used for the easy level and tie-breaks. */
export function chooseMove(state: GameState, level: BotLevel = 'normal', random: () => number = Math.random): number {
  const legal = legalTokens(state);
  if (legal.length === 0) throw new Error('No legal moves');
  if (level === 'easy' && random() < 0.5) return legal[Math.floor(random() * legal.length)];
  let best = legal[0];
  let bestScore = -Infinity;
  for (const t of legal) {
    const s = scoreMove(state, t) + (level === 'hard' ? 0 : random() * 8);
    if (s > bestScore) {
      bestScore = s;
      best = t;
    }
  }
  return best;
}

/** Deterministic PRNG for tests and replays. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function rollDie(random: () => number = Math.random): number {
  return 1 + Math.floor(random() * 6);
}
