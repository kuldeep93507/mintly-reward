// Board geometry for a classic 15x15 Ludo board.
//
// Seats run clockwise from the top-left yard: red (top-left), green (top-right),
// yellow (bottom-right), blue (bottom-left). Every token's position is stored as
// "progress" relative to its own colour:
//   -1        in the yard
//   0..50     on the shared 52-square track (0 = its start square)
//   51..55    in its own home column
//   56        home (finished)

export type Color = 'red' | 'green' | 'yellow' | 'blue';

export const ALL_COLORS: readonly Color[] = ['red', 'green', 'yellow', 'blue'];

export const YARD = -1;
export const LAST_TRACK = 50;
export const HOME = 56;
export const TRACK_LENGTH = 52;
export const TOKENS_PER_PLAYER = 4;

export type Cell = readonly [row: number, col: number];

/** The shared track, clockwise, starting at red's start square. */
export const TRACK: readonly Cell[] = [
  [6, 1], [6, 2], [6, 3], [6, 4], [6, 5],
  [5, 6], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6],
  [0, 7], [0, 8],
  [1, 8], [2, 8], [3, 8], [4, 8], [5, 8],
  [6, 9], [6, 10], [6, 11], [6, 12], [6, 13], [6, 14],
  [7, 14], [8, 14],
  [8, 13], [8, 12], [8, 11], [8, 10], [8, 9],
  [9, 8], [10, 8], [11, 8], [12, 8], [13, 8], [14, 8],
  [14, 7], [14, 6],
  [13, 6], [12, 6], [11, 6], [10, 6], [9, 6],
  [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0],
  [7, 0], [6, 0],
];

export const START_INDEX: Record<Color, number> = { red: 0, green: 13, yellow: 26, blue: 39 };

/** Track indexes where tokens cannot be captured: the four start squares and the four star squares. */
export const SAFE_INDEXES: readonly number[] = [0, 8, 13, 21, 26, 34, 39, 47];
export const STAR_INDEXES: readonly number[] = [8, 21, 34, 47];

export const HOME_COLUMN: Record<Color, readonly Cell[]> = {
  red: [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5]],
  green: [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7]],
  yellow: [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9]],
  blue: [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7]],
};

/** Top-left cell of each colour's 6x6 yard. */
export const YARD_ORIGIN: Record<Color, Cell> = { red: [0, 0], green: [0, 9], yellow: [9, 9], blue: [9, 0] };

/** Where a token sits inside its yard, in cell units relative to the yard origin (fractional = centre of the spot). */
export const YARD_SPOTS: readonly (readonly [number, number])[] = [
  [1.9, 1.9], [1.9, 4.1], [4.1, 1.9], [4.1, 4.1],
];

/** Where finished tokens are drawn: inside that colour's triangle in the centre. */
export const HOME_SPOT: Record<Color, readonly [number, number]> = {
  red: [7.5, 6.55], green: [6.55, 7.5], yellow: [7.5, 8.45], blue: [8.45, 7.5],
};

/** The absolute track index for a token on the shared track, or null when it is off the track. */
export function trackIndex(color: Color, progress: number): number | null {
  if (progress < 0 || progress > LAST_TRACK) return null;
  return (START_INDEX[color] + progress) % TRACK_LENGTH;
}

export function isSafeIndex(index: number): boolean {
  return SAFE_INDEXES.includes(index);
}

/**
 * Centre of a token in cell units (row, col), e.g. [6.5, 1.5] is the middle of cell (6,1).
 * Yard and home positions depend on which of the four tokens it is.
 */
export function tokenPoint(color: Color, progress: number, token: number): [number, number] {
  if (progress === YARD) {
    const [r0, c0] = YARD_ORIGIN[color];
    const [dr, dc] = YARD_SPOTS[token];
    return [r0 + dr, c0 + dc];
  }
  if (progress === HOME) {
    const [r, c] = HOME_SPOT[color];
    return [r, c];
  }
  const cell = progress <= LAST_TRACK ? TRACK[trackIndex(color, progress)!] : HOME_COLUMN[color][progress - LAST_TRACK - 1];
  return [cell[0] + 0.5, cell[1] + 0.5];
}

/** A stable key for "which square is this token on" — used to group stacked tokens. */
export function squareKey(color: Color, progress: number, token: number): string {
  if (progress === YARD) return `yard-${color}-${token}`;
  if (progress === HOME) return `home-${color}`;
  if (progress <= LAST_TRACK) return `t${trackIndex(color, progress)}`;
  return `h-${color}-${progress}`;
}
