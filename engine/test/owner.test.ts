import { describe, expect, it } from 'vitest';
import {
  applyRoll, bestRoll, capturesAt, legalTokens, newGame, overrideValue, type GameState,
} from '../src/index.js';

function withTokens(state: GameState, color: string, tokens: number[]): GameState {
  return { ...state, players: state.players.map((p) => (p.color === color ? { ...p, tokens } : p)) };
}

describe('owner dice', () => {
  it("'best' picks the roll that captures", () => {
    // Red token at progress 10; yellow token sits 4 squares ahead on red's track (not a safe square).
    let s = newGame(['red', 'yellow']);
    s = withTokens(s, 'red', [10, -1, -1, -1]);
    // yellow progress p is track index (26 + p) % 52; red progress 14 is index 14 -> yellow p = 40.
    s = withTokens(s, 'yellow', [40, -1, -1, -1]);
    expect(capturesAt(s, 'red', 14)).toHaveLength(1);
    const v = bestRoll(s);
    expect(v).toBe(4);
    const next = applyRoll(s, v);
    expect(legalTokens(next)).toContain(0);
  });

  it("'best' opens a token with a six when nothing else can move", () => {
    const s = newGame(['red', 'yellow']);
    expect(bestRoll(s)).toBe(6);
  });

  it("'once' returns the forced value and 'always6' avoids a third six", () => {
    const s = newGame(['red', 'yellow']);
    expect(overrideValue(s, { mode: 'once', value: 3 })).toBe(3);
    expect(overrideValue(s, { mode: 'once', value: 9 })).toBeNull();
    expect(overrideValue(s, { mode: 'always6' })).toBe(6);
    const two = { ...withTokens(s, 'red', [10, 20, -1, -1]), sixes: 2 };
    const v = overrideValue(two, { mode: 'always6' })!;
    expect(v).toBeGreaterThanOrEqual(1);
    expect(v).toBeLessThanOrEqual(5);
    expect(overrideValue(s, null)).toBeNull();
  });
});
