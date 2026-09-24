// Owner dice control ("remote control"): pure helpers shared by the server
// (online, authoritative) and the app (offline games). Nothing here is random;
// callers fall back to their normal dice when no override applies.

import { type GameState, applyRoll, legalTokens } from './rules.js';
import { scoreMove } from './bot.js';

/**
 * 'once'    use `value` for the next roll only
 * 'always6' roll a six every time (except when it would be the third six in a row)
 * 'best'    pick the value whose best move scores highest (capture > finish > open)
 */
export type OwnerDiceMode = 'once' | 'always6' | 'best';

export interface DiceOverride {
  mode: OwnerDiceMode;
  /** Only for 'once'. */
  value?: number;
}

/** How good rolling `value` is for the current player (-Infinity when the turn is wasted). */
export function rollValueScore(state: GameState, value: number): number {
  if (state.phase !== 'roll') return -Infinity;
  const next = applyRoll(state, value);
  if (next.phase !== 'move') return -Infinity;
  let best = -Infinity;
  for (const t of legalTokens(next)) best = Math.max(best, scoreMove(next, t));
  // A six also earns another roll.
  return best + (value === 6 ? 15 : 0);
}

/** The dice value (1..6) giving the current player the best move per the bot's scoring. */
export function bestRoll(state: GameState): number {
  let best = 6;
  let bestScore = -Infinity;
  for (let v = 6; v >= 1; v--) {
    const s = rollValueScore(state, v);
    if (s > bestScore) { bestScore = s; best = v; }
  }
  return best;
}

/** Resolves an override to a dice value for the current player, or null for a normal roll. */
export function overrideValue(state: GameState, o: DiceOverride | null | undefined): number | null {
  if (!o) return null;
  if (o.mode === 'once') return o.value !== undefined && Number.isInteger(o.value) && o.value >= 1 && o.value <= 6 ? o.value : null;
  if (o.mode === 'best') return bestRoll(state);
  // always6: never throw away the turn with a third six.
  if (state.sixes >= 2) {
    let best = 5;
    let bestScore = -Infinity;
    for (let v = 5; v >= 1; v--) {
      const s = rollValueScore(state, v);
      if (s > bestScore) { bestScore = s; best = v; }
    }
    return best;
  }
  return 6;
}
