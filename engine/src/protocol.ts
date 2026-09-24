// Wire contract between the app and the game server (REST + Socket.IO).
// Both sides import these types, so a change here is a change to both.

import type { Color } from './board.js';
import type { GameState } from './rules.js';

export const PROTOCOL_VERSION = 1;

export const EMOJIS = ['😂', '😡', '😢', '😍', '👍', '😮', '😎', '👏', '🙏', '🔥'] as const;
export const QUICK_CHAT = ['Good luck!', 'Well played', 'Hurry up!', 'Oops!', 'Nice move', 'Bye!'] as const;
export const AVATAR_COUNT = 12;
export const NAME_MAX = 16;

export interface Profile {
  id: string;
  name: string;
  /** 0..AVATAR_COUNT-1 */
  avatar: number;
  coins: number;
  wins: number;
  games: number;
  xp: number;
  level: number;
  /** Consecutive days the daily reward was claimed (0 = none yet). */
  dailyStreak: number;
  /** Epoch ms when the next daily reward can be claimed; null = claimable now. */
  nextDailyAt: number | null;
  /** Epoch ms when free coins can be claimed again; null = claimable now (only while coins are low). */
  nextFreeCoinsAt: number | null;
}

export interface ServerConfig {
  protocol: number;
  /** Entry fees for online quick matches. */
  stakes: number[];
  turnSeconds: number;
  startingCoins: number;
  /** Reward for day 1..7 of a daily streak. */
  dailyRewards: number[];
  freeCoins: number;
  /** Free coins are only offered below this balance. */
  freeCoinsBelow: number;
  freeCoinsCooldownMinutes: number;
  maxMissedTurns: number;
  /** Seconds a quick match waits for humans before filling empty seats with computer players. */
  botFillSeconds: number;
}

export interface LeaderboardEntry {
  id: string;
  name: string;
  avatar: number;
  level: number;
  wins: number;
  coins: number;
}

// ---- REST ----------------------------------------------------------------
// POST /api/auth/guest   body GuestAuthRequest -> AuthResponse
// GET  /api/me           (Authorization: Bearer <token>) -> { profile }
// PATCH /api/me          body { name?, avatar? } -> { profile }
// POST /api/daily        -> RewardResponse
// POST /api/free-coins   -> RewardResponse
// GET  /api/leaderboard  -> { top: LeaderboardEntry[] }
// GET  /api/config       -> ServerConfig
// DELETE /api/me        -> { ok: true }  (permanently deletes the account)
// GET  /health           -> { ok: true }
// Errors: HTTP 4xx/5xx with { error: string }.

export interface GuestAuthRequest {
  /** Random id the app generates once and keeps on the device. */
  deviceId: string;
  name?: string;
  avatar?: number;
}

export interface AuthResponse {
  token: string;
  profile: Profile;
}

export interface RewardResponse {
  profile: Profile;
  reward: number;
}

// ---- Socket.IO -----------------------------------------------------------
// Connect with io(url, { auth: { token } }). An invalid token gets a
// connect_error with message "unauthorized".

export type Ack<T = {}> = ({ ok: true } & T) | { ok: false; error: string };

export interface SeatInfo {
  /** User id, or "bot-<n>" for computer players. */
  userId: string;
  name: string;
  avatar: number;
  level: number;
  color: Color;
  isBot: boolean;
  connected: boolean;
}

export interface RoomInfo {
  code: string;
  hostId: string;
  /** Seats in the room (2..4). The host can start once 2 or more have joined. */
  maxPlayers: number;
  stake: number;
  members: { userId: string; name: string; avatar: number; level: number }[];
}

export interface GameInfo {
  gameId: string;
  /** Your colour in this game. */
  you: Color;
  stake: number;
  /** Coins paid out by finishing place: prizes[0] to 1st, prizes[1] to 2nd, ... */
  prizes: number[];
  seats: SeatInfo[];
  turnSeconds: number;
  update: GameUpdate;
}

export interface GameUpdate {
  gameId: string;
  state: GameState;
  /** Epoch ms (server clock) when the current player's turn times out; null when the game is over. */
  deadline: number | null;
  /** Server clock at send time, so clients can correct for clock skew. */
  serverNow: number;
  /** Missed turns per colour (a player is removed after maxMissedTurns in a row). */
  missed: Partial<Record<Color, number>>;
  /** Seats whose connection state changed are resent here. */
  seats: SeatInfo[];
}

export interface GameResult {
  gameId: string;
  ranking: Color[];
  /** Coins credited to each colour when the game ended. */
  payouts: Partial<Record<Color, number>>;
  /** Your profile after payouts. */
  profile: Profile;
}

export interface ClientToServer {
  'queue:join': (req: { players: 2 | 4; stake: number }, ack: (res: Ack) => void) => void;
  'queue:leave': () => void;
  'room:create': (req: { maxPlayers: 2 | 3 | 4; stake: number }, ack: (res: Ack<{ room: RoomInfo }>) => void) => void;
  'room:join': (req: { code: string }, ack: (res: Ack<{ room: RoomInfo }>) => void) => void;
  'room:leave': () => void;
  'room:start': (ack: (res: Ack) => void) => void;
  'game:roll': (req: { gameId: string }, ack: (res: Ack) => void) => void;
  'game:move': (req: { gameId: string; token: number }, ack: (res: Ack) => void) => void;
  /** `text` must be one of EMOJIS or QUICK_CHAT. */
  'game:react': (req: { gameId: string; text: string }) => void;
  'game:leave': (req: { gameId: string }) => void;
  /** Ask the server to resend the current game (after the app returns from background). */
  'game:sync': (req: { gameId: string }) => void;
}

export interface ServerToClient {
  'queue:status': (s: { players: 2 | 4; stake: number; found: number; elapsed: number }) => void;
  'room:update': (room: RoomInfo) => void;
  'room:closed': (e: { reason: string }) => void;
  /** Sent when a game begins and again on reconnect while a game is running. */
  'game:start': (g: GameInfo) => void;
  'game:state': (u: GameUpdate) => void;
  'game:react': (r: { gameId: string; color: Color; text: string }) => void;
  'game:over': (r: GameResult) => void;
  /** Balance or stats changed (entry fee taken, reward claimed...). */
  profile: (p: Profile) => void;
  notice: (n: { message: string }) => void;
}

/** Coins paid by finishing place for a game with `players` seats and entry fee `stake`. */
export function prizeTable(players: number, stake: number): number[] {
  if (players === 2) return [stake * 2, 0];
  if (players === 3) return [stake * 2, stake, 0];
  return [stake * 3, stake, 0, 0];
}

export function levelForXp(xp: number): number {
  return Math.floor(Math.sqrt(xp / 50)) + 1;
}

/** XP needed to reach `level`. */
export function xpForLevel(level: number): number {
  return (level - 1) ** 2 * 50;
}
