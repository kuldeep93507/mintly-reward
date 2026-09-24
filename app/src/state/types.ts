import type { BotLevel, Color, GameInfo, RoomInfo } from '@ludo/engine';
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
export type PlayAgain = BotsSetup | PassSetup | OnlineSetup | RoomSetup;

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
  | { id: 'howto' };

export type ServerStatus = 'connecting' | 'online' | 'offline';
