import type { Color, GameState } from '@ludo/engine';

/** One seat as the game screen needs it, whatever the game mode. */
export interface SeatView {
  color: Color;
  name: string;
  avatar: number;
  level: number | null;
  isBot: boolean;
  /** This device may roll/move for this seat. */
  controllable: boolean;
  isYou: boolean;
  connected: boolean;
}

export interface Snapshot {
  state: GameState;
  seats: SeatView[];
  /** Local-clock epoch ms when the current turn times out (online only). */
  deadline: number | null;
  missed: Partial<Record<Color, number>>;
  /** Full resync (reconnect): the screen should jump to it without animating. */
  resync?: boolean;
}

export interface GameOutcome {
  ranking: Color[];
  seats: SeatView[];
  payouts?: Partial<Record<Color, number>>;
  you: Color | null;
  online: boolean;
  stake: number;
}

/**
 * Common interface for local (vs computer / pass & play) and online games.
 * The game screen only talks to this.
 */
export interface GameController {
  readonly online: boolean;
  /** Your colour; null in pass & play where everyone shares the device. */
  readonly you: Color | null;
  readonly turnSeconds: number | null;
  readonly maxMissed: number | null;
  readonly stake: number;
  readonly prizes: number[];
  snapshot(): Snapshot;
  subscribe(l: (s: Snapshot) => void): () => void;
  onReaction(l: (r: { color: Color; text: string }) => void): () => void;
  onOver(l: (o: GameOutcome) => void): () => void;
  onNotice(l: (msg: string) => void): () => void;
  roll(): void;
  move(token: number): void;
  react(text: string): void;
  /** Quit (online: forfeit). */
  leave(): void;
  /** The screen finished animating everything up to `seq`; local bots may act now. */
  displayed(seq: number): void;
  /** Ask for a full resend (after app resume). */
  sync(): void;
  dispose(): void;
}
