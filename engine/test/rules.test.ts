import { describe, expect, it } from 'vitest';
import {
  HOME, TRACK, YARD, START_INDEX, applyLeave, applyMove, applyRoll, capturesAt, chooseMove, legalTokens,
  mulberry32, newGame, rollDie, seatColors, tokenPoint, trackIndex, type GameState,
} from '../src/index.js';

function withTokens(state: GameState, color: string, tokens: number[]): GameState {
  return { ...state, players: state.players.map((p) => (p.color === color ? { ...p, tokens } : p)) };
}

describe('board', () => {
  it('has 52 distinct track squares', () => {
    expect(TRACK).toHaveLength(52);
    expect(new Set(TRACK.map(([r, c]) => `${r},${c}`)).size).toBe(52);
  });

  it('each track step moves to an adjacent square', () => {
    for (let i = 0; i < 52; i++) {
      const [r1, c1] = TRACK[i];
      const [r2, c2] = TRACK[(i + 1) % 52];
      const d = Math.abs(r1 - r2) + Math.abs(c1 - c2);
      // The four corners where the path turns into the next arm step diagonally.
      expect(d === 1 || (Math.abs(r1 - r2) === 1 && Math.abs(c1 - c2) === 1)).toBe(true);
    }
  });

  it('the last track square of each colour sits next to its home column', () => {
    expect(TRACK[trackIndex('red', 50)!]).toEqual([7, 0]);
    expect(TRACK[trackIndex('green', 50)!]).toEqual([0, 7]);
    expect(TRACK[trackIndex('yellow', 50)!]).toEqual([7, 14]);
    expect(TRACK[trackIndex('blue', 50)!]).toEqual([14, 7]);
  });

  it('start squares are coloured correctly', () => {
    expect(TRACK[START_INDEX.green]).toEqual([1, 8]);
    expect(TRACK[START_INDEX.yellow]).toEqual([8, 13]);
    expect(TRACK[START_INDEX.blue]).toEqual([13, 6]);
    expect(tokenPoint('red', 0, 0)).toEqual([6.5, 1.5]);
  });
});

describe('rules', () => {
  it('needs a six to open', () => {
    let s = newGame(seatColors(2));
    s = applyRoll(s, 3);
    expect(s.last).toMatchObject({ type: 'roll', skipped: true, reason: 'no-moves' });
    expect(s.turn).toBe(1);
    s = applyRoll(s, 6);
    expect(s.phase).toBe('move');
    expect(legalTokens(s)).toEqual([0, 1, 2, 3]);
    s = applyMove(s, 2);
    expect(s.players[1].tokens[2]).toBe(0);
    // Six gives another roll.
    expect(s.turn).toBe(1);
    expect(s.phase).toBe('roll');
  });

  it('three sixes in a row forfeit the turn', () => {
    let s = newGame(seatColors(2));
    s = applyRoll(s, 6);
    s = applyMove(s, 0);
    s = applyRoll(s, 6);
    s = applyMove(s, 0);
    s = applyRoll(s, 6);
    expect(s.last).toMatchObject({ skipped: true, reason: 'three-sixes' });
    expect(s.turn).toBe(1);
    expect(s.players[0].tokens[0]).toBe(6);
  });

  it('captures on a normal square and grants a bonus roll', () => {
    let s = newGame(seatColors(4));
    // Green token sitting on track index 5 (red progress 5).
    s = withTokens(s, 'green', [(5 - 13 + 52) % 52, YARD, YARD, YARD]);
    s = withTokens(s, 'red', [2, YARD, YARD, YARD]);
    s = applyRoll(s, 3);
    expect(capturesAt(s, 'red', 5)).toHaveLength(1);
    s = applyMove(s, 0);
    expect(s.last).toMatchObject({ type: 'move', bonus: true });
    expect(s.players[1].tokens[0]).toBe(YARD);
    expect(s.turn).toBe(0);
  });

  it('does not capture on safe squares', () => {
    let s = newGame(seatColors(4));
    // Star square at track index 8.
    s = withTokens(s, 'green', [(8 - 13 + 52) % 52, YARD, YARD, YARD]);
    s = withTokens(s, 'red', [4, YARD, YARD, YARD]);
    s = applyRoll(s, 4);
    s = applyMove(s, 0);
    expect(s.players[1].tokens[0]).not.toBe(YARD);
    expect(s.turn).toBe(1);
  });

  it('needs an exact roll to reach home', () => {
    let s = newGame(seatColors(2));
    s = withTokens(s, 'red', [53, YARD, YARD, YARD]);
    s = applyRoll(s, 5);
    expect(s.last).toMatchObject({ skipped: true });
    s = withTokens({ ...s, turn: 0, phase: 'roll' }, 'red', [53, YARD, YARD, YARD]);
    s = applyRoll(s, 3);
    s = applyMove(s, 0);
    expect(s.players[0].tokens[0]).toBe(HOME);
    expect(s.last).toMatchObject({ bonus: true });
  });

  it('ends a two player game when the first player finishes', () => {
    let s = newGame(seatColors(2));
    s = withTokens(s, 'red', [HOME, HOME, HOME, 55]);
    s = applyRoll(s, 1);
    s = applyMove(s, 3);
    expect(s.phase).toBe('over');
    expect(s.ranking).toEqual(['red', 'yellow']);
    expect(s.players[0].rank).toBe(1);
  });

  it('keeps playing after first place in a four player game', () => {
    let s = newGame(seatColors(4));
    s = withTokens(s, 'red', [HOME, HOME, HOME, 55]);
    s = applyRoll(s, 1);
    s = applyMove(s, 3);
    expect(s.phase).toBe('roll');
    expect(s.ranking).toEqual(['red']);
    expect(s.turn).toBe(1);
  });

  it('a player leaving hands the win to the last one standing', () => {
    let s = newGame(seatColors(2));
    s = applyLeave(s, 'red');
    expect(s.phase).toBe('over');
    expect(s.ranking).toEqual(['yellow', 'red']);
  });

  it('skips players who left', () => {
    let s = newGame(seatColors(4));
    s = applyLeave(s, 'green');
    s = applyRoll(s, 2);
    expect(s.players[s.turn].color).toBe('yellow');
  });

  it('rejects illegal actions', () => {
    const s = newGame(seatColors(2));
    expect(() => applyMove(s, 0)).toThrow();
    const r = applyRoll(s, 6);
    expect(() => applyRoll(r, 2)).toThrow();
    expect(() => applyMove(r, 7)).toThrow();
  });
});

describe('bots', () => {
  it('prefers a capture', () => {
    let s = newGame(seatColors(4));
    s = withTokens(s, 'green', [(5 - 13 + 52) % 52, YARD, YARD, YARD]);
    s = withTokens(s, 'red', [2, 20, YARD, YARD]);
    s = applyRoll(s, 3);
    expect(chooseMove(s, 'hard')).toBe(0);
  });

  it('four bots always finish a full game', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const rnd = mulberry32(seed);
      let s = newGame(seatColors(4));
      let steps = 0;
      while (s.phase !== 'over') {
        if (s.phase === 'roll') s = applyRoll(s, rollDie(rnd));
        else s = applyMove(s, chooseMove(s, 'normal', rnd));
        if (++steps > 20000) throw new Error(`seed ${seed} did not finish`);
      }
      expect(s.ranking).toHaveLength(4);
      expect(new Set(s.ranking).size).toBe(4);
      const winner = s.players.find((p) => p.rank === 1)!;
      expect(winner.tokens.every((t) => t === HOME)).toBe(true);
    }
  });
});
