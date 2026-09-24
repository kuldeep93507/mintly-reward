import {
  type Color, type SnakesState, applySnakesRoll, newSnakesGame, rollDie, snakesOverrideValue,
} from '@ludo/engine';
import { speed } from '../config';
import type { GameOutcome, SeatView } from '../game/controller';
import { Emitter } from '../game/emitter';
import { endOffline, offlineId, reportOffline, takeOfflineDice } from '../net/offlineLink';
import type { LocalIdentity, SnakesSetup } from '../state/types';
import { colorsFrom } from '../game/startLocal';

const BOT_NAMES = ['Aarav', 'Mia', 'Leo', 'Zara', 'Kian', 'Nora', 'Ravi', 'Ivy'];

/** Test hook: window.__ludoAutoplay = true rolls for human seats too. */
const autoplay = () => !!(window as unknown as { __ludoAutoplay?: boolean }).__ludoAutoplay;

/** Offline Snakes & Ladders (vs computer or pass & play). */
export class SnakesController {
  readonly id = offlineId();
  readonly you: Color | null;
  readonly seats: SeatView[];
  private state: SnakesState;
  private updates = new Emitter<SnakesState>();
  private over = new Emitter<GameOutcome>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;

  constructor(private setup: SnakesSetup, me: LocalIdentity) {
    const colors = colorsFrom('red', setup.names.length);
    const bots = setup.mode === 'bots';
    this.you = bots ? colors[0] : null;
    const botAvatars = [...Array(12).keys()].filter((a) => a !== me.avatar);
    this.seats = colors.map((color, k) => {
      const isYou = bots && k === 0;
      const isBot = bots && k > 0;
      return {
        color,
        name: isYou ? me.name : isBot ? BOT_NAMES[(k * 3 + Math.floor(Math.random() * 8)) % BOT_NAMES.length] : setup.names[k] || `Player ${k + 1}`,
        avatar: isYou ? me.avatar : isBot ? botAvatars[(k * 5) % botAvatars.length] : [0, 4, 9, 2][k],
        level: null, isBot, controllable: !isBot, isYou, connected: true,
      };
    });
    this.state = newSnakesGame(colors);
    this.report();
  }

  snapshot() { return this.state; }
  subscribe(l: (s: SnakesState) => void) { return this.updates.on(l); }
  onOver(l: (o: GameOutcome) => void) { return this.over.on(l); }

  private report() {
    if (this.state.phase === 'over') { endOffline(this.id); return; }
    reportOffline({
      id: this.id, game: 'snakes', mode: this.setup.mode, state: this.state,
      seats: this.seats.map((s) => ({ color: s.color, name: s.name, isBot: s.isBot, isYou: s.isYou })),
    });
  }

  isBotTurn() {
    const seat = this.seats[this.state.turn];
    return seat.isBot || autoplay();
  }

  roll() {
    if (this.disposed || this.state.phase !== 'roll') return;
    const color = this.state.players[this.state.turn].color;
    const v = snakesOverrideValue(this.state, takeOfflineDice(this.id, color)) ?? rollDie();
    this.state = applySnakesRoll(this.state, v);
    this.report();
    this.updates.emit(this.state);
    if (this.state.phase === 'over') {
      this.over.emit({ ranking: this.state.ranking, seats: this.seats, you: this.you, online: false, stake: 0 });
    }
  }

  /** The screen finished animating `seq`; computer players may roll now. */
  displayed(seq: number) {
    if (this.disposed || seq !== this.state.seq || this.state.phase === 'over' || !this.isBotTurn()) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      if (!this.disposed && seq === this.state.seq) this.roll();
    }, (650 + Math.random() * 300) * speed());
  }

  dispose() {
    this.disposed = true;
    if (this.timer) clearTimeout(this.timer);
    endOffline(this.id);
    this.updates.clear();
    this.over.clear();
  }
}

export function startSnakesGame(setup: SnakesSetup, me: LocalIdentity) {
  return new SnakesController(setup, me);
}
