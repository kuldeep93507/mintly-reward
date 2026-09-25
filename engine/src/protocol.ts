// Wire contract between the app and the game server (REST + Socket.IO).
// Both sides import these types, so a change here is a change to both.

import type { Color } from './board.js';
import type { GameState } from './rules.js';
import type { DiceOverride, OwnerDiceMode } from './owner.js';
import type { SnakesState } from './snakes.js';

export const PROTOCOL_VERSION = 1;

export const EMOJIS = ['😂', '😡', '😢', '😍', '👍', '😮', '😎', '👏', '🙏', '🔥'] as const;
export const QUICK_CHAT = ['Good luck!', 'Well played', 'Hurry up!', 'Oops!', 'Nice move', 'Bye!'] as const;
export const AVATAR_COUNT = 12;
export const NAME_MAX = 16;

export interface Profile {
  id: string;
  /**
   * Owner-marked test account (the owner's own phones). Only test accounts send offline game
   * boards to the server and accept owner dice commands; everyone else's offline games stay private.
   */
  tester?: boolean;
  /** Short public id friends type in to send an invite (e.g. "K7QX2M"). */
  playerId: string;
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
  theme: GlobalTheme;
}

export const BOARD_THEMES = ['classic', 'night', 'wood', 'candy'] as const;
export const DICE_SKINS = ['white', 'gold', 'red', 'neon'] as const;
export type BoardTheme = (typeof BOARD_THEMES)[number];
export type DiceSkin = (typeof DICE_SKINS)[number];

/** Theme pushed by the owner. null = player's own choice. `locked` stops players changing it. */
export interface GlobalTheme {
  board: BoardTheme | null;
  dice: DiceSkin | null;
  locked: boolean;
}

export interface OfflineSeat { color: Color; name: string; isBot: boolean; isYou: boolean }

export interface OfflineGameReport {
  /** Random id per offline game on the device. */
  id: string;
  game: 'ludo' | 'snakes';
  mode: 'bots' | 'pass';
  seats: OfflineSeat[];
  state: GameState | SnakesState;
}

export interface OfflineDiceCommand {
  gameId: string;
  color: Color;
  value: number | null;
  mode: OwnerDiceMode | null;
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

/** A player you recently played an online game with. */
export interface RecentPlayer {
  playerId: string;
  name: string;
  avatar: number;
  level: number;
  online: boolean;
}

export interface Invite {
  fromPlayerId: string;
  fromName: string;
  fromAvatar: number;
  roomCode: string;
}

/** Owner dice control. `mode: null` (and `value: null`) clears the override for that colour. */
export interface OwnerDiceRequest {
  gameId: string;
  color: Color;
  value: number | null;
  mode: OwnerDiceMode | null;
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
  /** Invite a player (by Player ID) to the room you are in. They must be online. */
  'invite:send': (req: { toPlayerId: string; roomCode: string }, ack: (res: Ack) => void) => void;
  'players:recent': (ack: (res: Ack<{ players: RecentPlayer[] }>) => void) => void;
  /** Summary of an offline game running on this device (sent while connected). */
  'offline:state': (report: OfflineGameReport) => void;
  'offline:end': (req: { id: string }) => void;
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
  'invite:received': (i: Invite) => void;
  /** Owner-chosen theme for every player (sent on connect and when it changes). */
  theme: (t: GlobalTheme) => void;
  /** Owner announcement shown to everyone. */
  broadcast: (b: { message: string }) => void;
  /** Dice command for an offline game running in this app. */
  'offline:dice': (c: OfflineDiceCommand) => void;
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

// ---- Owner admin (Socket.IO namespace "/admin") ---------------------------
// Connect with io(url + '/admin', { auth: { key: OWNER_KEY } }). A wrong key gets
// connect_error "unauthorized". Only the separate Ludo Admin app uses this.

export interface OwnerGame {
  gameId: string;
  stake: number;
  prizes: number[];
  seats: SeatInfo[];
  state: GameState;
  deadline: number | null;
  overrides: Partial<Record<Color, DiceOverride>>;
}

export type OwnerRoom = RoomInfo;

export interface OwnerOfflineGame extends OfflineGameReport {
  userId: string;
  userName: string;
  playerId: string;
  online: boolean;
  updatedAt: number;
  overrides: Partial<Record<Color, DiceOverride>>;
}

export interface OwnerUser {
  id: string;
  tester: boolean;
  playerId: string;
  name: string;
  avatar: number;
  coins: number;
  wins: number;
  games: number;
  level: number;
  banned: boolean;
  online: boolean;
}

/** Server-wide numbers for the owner's overview page. */
export interface OwnerStats {
  users: number;
  newToday: number;
  banned: number;
  /** Free virtual coins held by all players. */
  coins: number;
  /** Paid online matches started today / in total. */
  matchesToday: number;
  matchesTotal: number;
  top: OwnerUser[];
  newest: OwnerUser[];
}

export interface OwnerSnapshot {
  now: number;
  online: number;
  /** Whether dice control / declare winner is enabled for online matches (ONLINE_GAME_CONTROL). */
  onlineControl: boolean;
  stats: OwnerStats;
  games: OwnerGame[];
  rooms: OwnerRoom[];
  offline: OwnerOfflineGame[];
  theme: GlobalTheme;
  config: ServerConfig;
}

export interface OwnerConfigPatch {
  dailyRewards?: number[];
  stakes?: number[];
  turnSeconds?: number;
}

export interface OwnerClientToServer {
  'owner:snapshot': (ack: (res: Ack<{ snapshot: OwnerSnapshot }>) => void) => void;
  /** Dice override for any seat of any online game (the server applies it on that seat's next roll). */
  'owner:dice': (req: OwnerDiceRequest, ack: (res: Ack) => void) => void;
  /** Dice override forwarded to the phone running an offline game (needs that phone connected). */
  'owner:offlineDice': (req: OfflineDiceCommand & { userId: string }, ack: (res: Ack) => void) => void;
  /** End a game now. `winner` goes first; everyone else is ranked by progress. */
  'owner:endGame': (req: { gameId: string; winner: Color | null }, ack: (res: Ack) => void) => void;
  'owner:users': (req: { query: string }, ack: (res: Ack<{ users: OwnerUser[] }>) => void) => void;
  /** Give (positive) or take (negative) free virtual coins. */
  'owner:coins': (req: { userId: string; amount: number }, ack: (res: Ack<{ user: OwnerUser }>) => void) => void;
  'owner:rename': (req: { userId: string; name: string }, ack: (res: Ack<{ user: OwnerUser }>) => void) => void;
  'owner:ban': (req: { userId: string; banned: boolean }, ack: (res: Ack<{ user: OwnerUser }>) => void) => void;
  /** Mark/unmark the owner's own test account (enables offline game remote control for it). */
  'owner:tester': (req: { userId: string; tester: boolean }, ack: (res: Ack<{ user: OwnerUser }>) => void) => void;
  'owner:theme': (req: GlobalTheme, ack: (res: Ack) => void) => void;
  'owner:config': (req: OwnerConfigPatch, ack: (res: Ack<{ config: ServerConfig }>) => void) => void;
  'owner:notice': (req: { message: string }, ack: (res: Ack) => void) => void;
}

export type OwnerServerToClient = Record<string, never>;
