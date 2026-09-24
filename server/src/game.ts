import {
  type Color, type GameInfo, type GameState, type GameUpdate, type SeatInfo,
  applyLeave, applyMove, applyRoll, chooseMove, currentPlayer, newGame, prizeTable,
} from '@ludo/engine';
import type { Hub } from './hub.js';
import { UserError } from './errors.js';

export class GameSession {
  state: GameState;
  readonly prizes: number[];
  missed: Partial<Record<Color, number>> = {};
  deadline: number | null = null;
  over = false;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private hub: Hub,
    readonly id: string,
    readonly stake: number,
    readonly seats: SeatInfo[],
  ) {
    this.state = newGame(seats.map((s) => s.color));
    this.prizes = prizeTable(seats.length, stake);
  }

  get room(): string { return `game:${this.id}`; }

  humans(): SeatInfo[] { return this.seats.filter((s) => !s.isBot); }

  seatOf(userId: string): SeatInfo | undefined { return this.seats.find((s) => s.userId === userId); }

  info(you: Color): GameInfo {
    return { gameId: this.id, you, stake: this.stake, prizes: this.prizes, seats: this.seats, turnSeconds: this.hub.cfg.turnSeconds, update: this.update() };
  }

  update(): GameUpdate {
    return { gameId: this.id, state: this.state, deadline: this.deadline, serverNow: Date.now(), missed: this.missed, seats: this.seats };
  }

  start(): void {
    this.arm();
    for (const s of this.humans()) this.hub.emitToUser(s.userId, 'game:start', this.info(s.color));
  }

  /** Seat whose turn it is. */
  current(): SeatInfo {
    const color = currentPlayer(this.state).color;
    return this.seats.find((s) => s.color === color)!;
  }

  private clearTimer(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  /** Apply a new state, re-arm timers and broadcast. */
  private commit(next: GameState): void {
    this.state = next;
    // With no humans left racing, the result for humans is settled: end quickly.
    if (this.state.phase !== 'over' && !this.state.players.some((p) => !p.out && p.rank === null && !this.seatByColor(p.color).isBot)) {
      for (const p of this.state.players) {
        if (this.state.phase === 'over') break;
        if (!p.out && p.rank === null) this.state = applyLeave(this.state, p.color);
      }
    }
    this.arm();
    this.broadcast();
    if (this.state.phase === 'over') this.finish();
  }

  private seatByColor(c: Color): SeatInfo { return this.seats.find((s) => s.color === c)!; }

  broadcast(): void {
    if (this.hub.closed) return;
    this.hub.io.to(this.room).emit('game:state', this.update());
  }

  private arm(): void {
    this.clearTimer();
    if (this.over) return;
    if (this.state.phase === 'over') {
      this.deadline = null;
      return;
    }
    const cfg = this.hub.cfg;
    const seat = this.current();
    const turnMs = cfg.turnSeconds * 1000 + cfg.animGraceMs;
    this.deadline = Date.now() + turnMs;
    if (seat.isBot) {
      this.timer = setTimeout(() => this.safe(() => this.botStep()), cfg.botDelayMs);
    } else {
      this.timer = setTimeout(() => this.safe(() => this.timeout(seat.color)), turnMs);
    }
  }

  private safe(fn: () => void): void {
    this.timer = null;
    if (this.over || this.hub.closed) return;
    try { fn(); } catch (e) { this.hub.cfg.log('game error', this.id, e); }
  }

  private botStep(): void {
    if (this.state.phase === 'roll') this.commit(applyRoll(this.state, this.hub.cfg.rollDie()));
    else if (this.state.phase === 'move') this.commit(applyMove(this.state, chooseMove(this.state, 'normal')));
  }

  private timeout(color: Color): void {
    if (currentPlayer(this.state).color !== color) return this.arm();
    let s = this.state;
    if (s.phase === 'roll') s = applyRoll(s, this.hub.cfg.rollDie());
    if (s.phase === 'move' && currentPlayer(s).color === color) s = applyMove(s, chooseMove(s, 'normal'));
    const missed = (this.missed[color] ?? 0) + 1;
    this.missed = { ...this.missed, [color]: missed };
    if (missed >= this.hub.cfg.maxMissedTurns) {
      s = applyLeave(s, color);
      const seat = this.seatByColor(color);
      this.hub.cfg.log('game', this.id, color, 'removed for inactivity');
      this.hub.emitToRoom(this.room, 'notice', { message: `${seat.name} was removed for missing ${missed} turns` });
      this.hub.releaseUser(seat.userId, this);
    }
    this.commit(s);
  }

  /** A human roll/move. Throws RuleError / Error with a user-facing message. */
  act(userId: string, action: { type: 'roll' } | { type: 'move'; token: number }): void {
    if (this.over || this.state.phase === 'over') throw new UserError('Game is over');
    const seat = this.seatOf(userId);
    if (!seat) throw new UserError('You are not in this game');
    if (this.current().userId !== userId) throw new UserError('Not your turn');
    const next = action.type === 'roll' ? applyRoll(this.state, this.hub.cfg.rollDie()) : applyMove(this.state, action.token);
    if (this.missed[seat.color]) this.missed = { ...this.missed, [seat.color]: 0 };
    this.commit(next);
  }

  leave(userId: string): void {
    const seat = this.seatOf(userId);
    if (!seat || this.over) return;
    this.hub.releaseUser(userId, this);
    const next = applyLeave(this.state, seat.color);
    if (next !== this.state) {
      this.hub.emitToRoom(this.room, 'notice', { message: `${seat.name} left the game` });
      this.commit(next);
    }
  }

  setConnected(userId: string, connected: boolean): void {
    const seat = this.seatOf(userId);
    if (!seat || seat.connected === connected || this.over) return;
    seat.connected = connected;
    this.broadcast();
  }

  private finish(): void {
    if (this.over) return;
    this.over = true;
    this.clearTimer();
    const ranking = this.state.ranking;
    const payouts: Partial<Record<Color, number>> = {};
    const results: { userId: string; payout: number; rank: number }[] = [];
    ranking.forEach((color, i) => {
      const seat = this.seatByColor(color);
      if (seat.isBot || !this.hub.db.getUser(seat.userId)) return;
      // Players who quit or were removed forfeit any prize.
      const left = this.state.players.find((p) => p.color === color)?.out;
      const payout = left ? 0 : this.prizes[i] ?? 0;
      payouts[color] = payout;
      results.push({ userId: seat.userId, payout, rank: i + 1 });
    });
    try {
      this.hub.db.settleGame(results, this.id);
    } catch (e) {
      this.hub.cfg.log('settle failed', this.id, e);
    }
    this.hub.cfg.log('game over', this.id, ranking.join('>'), JSON.stringify(payouts));
    for (const s of this.humans()) {
      const u = this.hub.db.getUser(s.userId);
      if (!u) continue;
      this.hub.emitToUser(s.userId, 'game:over', { gameId: this.id, ranking, payouts, profile: this.hub.db.profile(u) });
      this.hub.releaseUser(s.userId, this);
    }
    this.hub.scheduleGameCleanup(this);
  }

  dispose(): void {
    this.over = true;
    this.clearTimer();
  }
}
