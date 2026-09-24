import { describe, expect, it } from 'vitest';
import {
  LADDERS, SNAKES, SNAKES_GOAL, applySnakesRoll, newSnakesGame, snakesBestRoll, snakesCell, snakesOutcome,
  snakesOverrideValue, snakesPath, type SnakesState,
} from '../src/index.js';

function at(state: SnakesState, positions: number[]): SnakesState {
  return { ...state, players: state.players.map((p, i) => ({ ...p, pos: positions[i] ?? p.pos })) };
}

describe('snakes & ladders', () => {
  it('layout is sane', () => {
    for (const [a, b] of Object.entries(LADDERS)) expect(b).toBeGreaterThan(Number(a));
    for (const [a, b] of Object.entries(SNAKES)) expect(b).toBeLessThan(Number(a));
    const all = [...Object.keys(LADDERS), ...Object.keys(SNAKES)];
    expect(new Set(all).size).toBe(all.length);
    expect(SNAKES[SNAKES_GOAL]).toBeUndefined();
  });

  it('moves, climbs ladders and slides down snakes', () => {
    let s = newSnakesGame(['red', 'blue']);
    s = applySnakesRoll(s, 1);
    expect(s.players[0].pos).toBe(38);
    expect(s.last).toMatchObject({ type: 'roll', from: 0, landed: 1, to: 38, jump: 'ladder' });
    expect(s.turn).toBe(1);
    s = at(s, [38, 10]);
    s = applySnakesRoll(s, 6); // blue 10 -> 16 snake -> 6, six = roll again
    expect(s.players[1].pos).toBe(6);
    expect(s.last).toMatchObject({ jump: 'snake', bonus: true });
    expect(s.turn).toBe(1);
    s = applySnakesRoll(s, 2);
    expect(s.players[1].pos).toBe(8);
    expect(s.turn).toBe(0);
  });

  it('needs the exact roll to finish', () => {
    let s = at(newSnakesGame(['red', 'blue']), [97, 50]);
    s = applySnakesRoll(s, 5);
    expect(s.players[0].pos).toBe(97);
    expect(s.last).toMatchObject({ overshoot: true, to: 97 });
    s = { ...s, turn: 0 };
    s = applySnakesRoll(s, 3);
    expect(s.phase).toBe('over');
    expect(s.ranking).toEqual(['red', 'blue']);
    expect(() => applySnakesRoll(s, 1)).toThrow();
  });

  it('winning with a six ends the game (no bonus)', () => {
    const s = applySnakesRoll(at(newSnakesGame(['red', 'blue', 'green']), [94, 30, 60]), 6);
    expect(s.phase).toBe('over');
    expect(s.ranking).toEqual(['red', 'green', 'blue']);
    expect(s.last).toMatchObject({ bonus: false, won: true });
  });

  it('board geometry and paths', () => {
    expect(snakesCell(1)).toEqual([9, 0]);
    expect(snakesCell(10)).toEqual([9, 9]);
    expect(snakesCell(11)).toEqual([8, 9]);
    expect(snakesCell(100)).toEqual([0, 0]);
    expect(snakesPath(3, 6)).toEqual([4, 5, 6]);
    expect(snakesOutcome(99, 2).overshoot).toBe(true);
  });

  it('best roll wins when possible and avoids snakes', () => {
    expect(snakesBestRoll(at(newSnakesGame(['red', 'blue']), [96]))).toBe(4);
    expect(snakesBestRoll(at(newSnakesGame(['red', 'blue']), [0]))).toBe(1); // ladder 1 -> 38
    const s = at(newSnakesGame(['red', 'blue']), [97]);
    expect(snakesOverrideValue(s, { mode: 'always6' })).toBe(3);
    expect(snakesOverrideValue(s, { mode: 'once', value: 2 })).toBe(2);
    expect(snakesOverrideValue(s, null)).toBeNull();
  });
});
