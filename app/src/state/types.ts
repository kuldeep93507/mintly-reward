import type { BoardTheme, BotLevel, Color, DiceSkin, GameInfo, RoomInfo } from '@ludo/engine';
import type { SnakesController } from '../snakes/SnakesController';
import type { GameController, GameOutcome } from '../game/controller';

export interface Settings {
  sound: boolean;
  vibration: boolean;
  autoMove: boolean;
  serverUrl: string;
}

export interface LocalIdentity {
  name: string;
  avatar: number;
}

export interface BotsSetup { kind: 'bots'; players: 2 | 3 | 4; color: Color; level: BotLevel }
export interface PassSetup { kind: 'pass'; names: string[] }
export interface OnlineSetup { kind: 'online'; players: 2 | 4; stake: number }
export interface RoomSetup { kind: 'room' }
export interface SnakesSetup { kind: 'snakes'; mode: 'bots' | 'pass'; names: string[] }
export type PlayAgain = BotsSetup | PassSetup | OnlineSetup | RoomSetup | SnakesSetup;

/** The player's own look (may be overridden by the owner's global theme). */
export interface LocalTheme { board: BoardTheme; dice: DiceSkin }

export type Screen =
  | { id: 'home' }
  | { id: 'online' }
  | { id: 'matchmaking'; players: 2 | 4; stake: number }
  | { id: 'friends' }
  | { id: 'lobby'; room: RoomInfo }
  | { id: 'bots' }
  | { id: 'pass' }
  | { id: 'game'; controller: GameController; again: PlayAgain; info?: GameInfo }
  | { id: 'result'; outcome: GameOutcome; again: PlayAgain }
  | { id: 'profile' }
  | { id: 'leaderboard' }
  | { id: 'settings' }
  | { id: 'howto' }
  | { id: 'themes' }
  | { id: 'snakes-setup' }
  | { id: 'snakes'; controller: SnakesController; again: SnakesSetup };

export type ServerStatus = 'connecting' | 'online' | 'offline';
