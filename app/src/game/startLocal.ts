import { ALL_COLORS, type Color } from '@ludo/engine';
import type { BotsSetup, LocalIdentity, PassSetup } from '../state/types';
import { LocalGameController, type LocalSeat } from './LocalGameController';

const BOT_NAMES = ['Aarav', 'Mia', 'Leo', 'Zara', 'Kian', 'Nora', 'Ravi', 'Ivy', 'Omar', 'Luna', 'Theo', 'Sana'];

/** Colours for n players starting from `first`, in clockwise (turn) order. Two players sit opposite. */
export function colorsFrom(first: Color, n: number): Color[] {
  const i = ALL_COLORS.indexOf(first);
  const at = (k: number) => ALL_COLORS[(i + k) % 4];
  if (n === 2) return [at(0), at(2)];
  if (n === 3) return [at(0), at(1), at(2)];
  return [at(0), at(1), at(2), at(3)];
}

function shuffle<T>(a: T[]): T[] {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

export function startBotsGame(setup: BotsSetup, me: LocalIdentity, myLevel: number | null) {
  const colors = colorsFrom(setup.color, setup.players);
  const names = shuffle(BOT_NAMES);
  const avatars = shuffle([...Array(12).keys()].filter((a) => a !== me.avatar));
  const lv = setup.level === 'easy' ? 2 : setup.level === 'normal' ? 6 : 12;
  const seats: LocalSeat[] = colors.map((color, k) => (k === 0
    ? { color, name: me.name, avatar: me.avatar, level: myLevel, bot: null, isYou: true }
    : { color, name: names[k], avatar: avatars[k], level: lv + Math.floor(Math.random() * 4), bot: setup.level, isYou: false }));
  return new LocalGameController(seats, setup.color);
}

export function startPassGame(setup: PassSetup) {
  const colors = colorsFrom('red', setup.names.length);
  const seats: LocalSeat[] = colors.map((color, k) => ({
    color, name: setup.names[k] || `Player ${k + 1}`, avatar: [0, 4, 9, 2][k], level: null, bot: null, isYou: false,
  }));
  return new LocalGameController(seats, null);
}
