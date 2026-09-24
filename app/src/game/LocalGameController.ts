import {
  type BotLevel, type Color, type GameState, applyMove, applyRoll, chooseMove, currentPlayer, legalTokens, newGame, overrideValue, rollDie,
} from '@ludo/engine';
import { endOffline, offlineId, reportOffline, takeOfflineDice } from '../net/offlineLink';
import { speed } from '../config';
import type { GameController, GameOutcome, SeatView, Snapshot } from './controller';
import { Emitter } from './emitter';

export interface LocalSeat {
  color: Color;
  name: string;
  avatar: number;
  level: number | null;
  bot: BotLevel | null;
  isYou: boolean;
}

/** Test hook: window.__ludoAutoplay = true lets bots play for human seats too. */
const autoplay = () => !!(window as unknown as { __ludoAutoplay?: boolean }).__ludoAutoplay;

export class LocalGameController implements GameController {
  readonly online = false;
  readonly turnSeconds = null;
  readonly maxMissed = null;
  readonly stake = 0;
  readonly prizes: number[] = [];
  readonly you: Color | null;
  private state: GameState;
  private seats: SeatView[];
  private bots = new Map<Color, BotLevel>();
  private updates = new Emitter<Snapshot>();
  private over = new Emitter<GameOutcome>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;
  readonly id = offlineId();

  constructor(seats: LocalSeat[], you: Color | null, private mode: 'bots' | 'pass' = you ? 'bots' : 'pass') {
    this.you = you;
    this.state = newGame(seats.map((s) => s.color));
    this.seats = seats.map((s) => ({
      color: s.color, name: s.name, avatar: s.avatar, level: s.level, isBot: !!s.bot,
      controllable: !s.bot, isYou: s.isYou, connected: true,
    }));
    for (const s of seats) if (s.bot) this.bots.set(s.color, s.bot);
    this.report();
  }

  private report() {
    if (this.state.phase === 'over') { endOffline(this.id); return; }
    reportOffline({
      id: this.id, game: 'ludo', mode: this.mode, state: this.state,
      seats: this.seats.map((s) => ({ color: s.color, name: s.name, isBot: s.isBot, isYou: s.isYou })),
    });
  }

  snapshot(): Snapshot {
    return { state: this.state, seats: this.seats, deadline: null, missed: {} };
  }
  subscribe(l: (s: Snapshot) => void) { return this.updates.on(l); }
  onReaction() { return () => {}; }
  onNotice() { return () => {}; }
  onOver(l: (o: GameOutcome) => void) { return this.over.on(l); }

  private set(next: GameState) {
    this.state = next;
    this.report();
    this.updates.emit(this.snapshot());
    if (next.phase === 'over') {
      this.over.emit({ ranking: next.ranking, seats: this.seats, you: this.you, online: false, stake: 0 });
    }
  }

  private isBotTurn() {
    const c = currentPlayer(this.state).color;
    return this.bots.has(c) || autoplay();
  }

  roll() {
    if (this.disposed || this.state.phase !== 'roll') return;
    const color = currentPlayer(this.state).color;
    this.set(applyRoll(this.state, overrideValue(this.state, takeOfflineDice(this.id, color)) ?? rollDie()));
  }

  move(token: number) {
    if (this.disposed || this.state.phase !== 'move' || !legalTokens(this.state).includes(token)) return;
    this.set(applyMove(this.state, token));
  }

  react() {}
  leave() { this.dispose(); }
  sync() {}

  displayed(seq: number) {
    if (this.disposed || seq !== this.state.seq || this.state.phase === 'over' || !this.isBotTurn()) return;
    if (this.timer) clearTimeout(this.timer);
    const delay = (this.state.phase === 'roll' ? 700 : 550) + Math.random() * 300;
    this.timer = setTimeout(() => {
      this.timer = null;
      if (this.disposed || seq !== this.state.seq) return;
      if (this.state.phase === 'roll') this.roll();
      else {
        const c = currentPlayer(this.state).color;
        this.move(chooseMove(this.state, this.bots.get(c) ?? 'normal'));
      }
    }, delay * speed());
  }

  dispose() {
    this.disposed = true;
    endOffline(this.id);
    if (this.timer) clearTimeout(this.timer);
    this.updates.clear();
    this.over.clear();
  }
}
