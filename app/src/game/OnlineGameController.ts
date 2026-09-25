import type { Color, GameInfo, GameResult, GameUpdate, Profile, SeatInfo } from '@ludo/engine';
import type { GameSocket } from '../net/socket';
import { emitAck } from '../net/socket';
import type { GameController, GameOutcome, SeatView, Snapshot } from './controller';
import { Emitter } from './emitter';

export class OnlineGameController implements GameController {
  readonly online = true;
  readonly you: Color;
  readonly turnSeconds: number;
  readonly stake: number;
  readonly prizes: number[];
  readonly gameId: string;
  private seatInfo: SeatInfo[];
  private snap: Snapshot;
  private updates = new Emitter<Snapshot>();
  private reactions = new Emitter<{ color: Color; text: string }>();
  private over = new Emitter<GameOutcome>();
  private notices = new Emitter<string>();
  private offs: (() => void)[] = [];
  private finished = false;

  constructor(private socket: GameSocket, info: GameInfo, readonly maxMissed: number | null, private onProfile: (p: Profile) => void) {
    this.gameId = info.gameId;
    this.you = info.you;
    this.turnSeconds = info.turnSeconds;
    this.stake = info.stake;
    this.prizes = info.prizes;
    this.seatInfo = info.seats;
    this.snap = this.toSnap(info.update, false);

    const onState = (u: GameUpdate) => {
      if (u.gameId !== this.gameId || u.state.seq < this.snap.state.seq) return;
      this.snap = this.toSnap(u, false);
      this.updates.emit(this.snap);
    };
    const onStart = (g: GameInfo) => {
      if (g.gameId !== this.gameId) return;
      this.seatInfo = g.seats;
      this.snap = this.toSnap(g.update, true);
      this.updates.emit(this.snap);
    };
    const onReact = (r: { gameId: string; color: Color; text: string }) => {
      if (r.gameId === this.gameId) this.reactions.emit({ color: r.color, text: r.text });
    };
    const onOver = (r: GameResult) => {
      if (r.gameId !== this.gameId || this.finished) return;
      this.finished = true;
      this.onProfile(r.profile);
      const left = this.snap.state.players.filter((p) => p.out).map((p) => p.color);
      this.over.emit({ ranking: r.ranking, payouts: r.payouts, seats: this.seats(), you: this.you, online: true, stake: this.stake, left });
    };
    // A notice may mean we were removed from the game: fetch the latest state too.
    const onNotice = (n: { message: string }) => { this.notices.emit(n.message); if (!this.finished) this.sync(); };
    // Re-sync after a dropped connection comes back.
    const onConnect = () => this.sync();
    socket.on('game:state', onState);
    socket.on('game:start', onStart);
    socket.on('game:react', onReact);
    socket.on('game:over', onOver);
    socket.on('notice', onNotice);
    socket.io.on('reconnect', onConnect);
    this.offs.push(
      () => socket.off('game:state', onState),
      () => socket.off('game:start', onStart),
      () => socket.off('game:react', onReact),
      () => socket.off('game:over', onOver),
      () => socket.off('notice', onNotice),
      () => socket.io.off('reconnect', onConnect),
    );
  }

  private seats(): SeatView[] {
    return this.seatInfo.map((s) => ({
      color: s.color, name: s.name, avatar: s.avatar, level: s.level, isBot: s.isBot,
      controllable: s.color === this.you, isYou: s.color === this.you, connected: s.connected,
    }));
  }

  private toSnap(u: GameUpdate, resync: boolean): Snapshot {
    // Merge seat changes (connection state) into what we know.
    for (const s of u.seats) {
      const i = this.seatInfo.findIndex((x) => x.color === s.color);
      if (i >= 0) this.seatInfo[i] = s; else this.seatInfo.push(s);
    }
    this.seatInfo = [...this.seatInfo];
    // Convert the server deadline to the local clock (corrects clock skew).
    const deadline = u.deadline === null ? null : u.deadline - u.serverNow + Date.now();
    return { state: u.state, seats: this.seats(), deadline, missed: u.missed, resync };
  }

  snapshot() { return this.snap; }
  subscribe(l: (s: Snapshot) => void) { return this.updates.on(l); }
  onReaction(l: (r: { color: Color; text: string }) => void) { return this.reactions.on(l); }
  onOver(l: (o: GameOutcome) => void) { return this.over.on(l); }
  onNotice(l: (m: string) => void) { return this.notices.on(l); }

  roll() {
    void emitAck<{ ok: boolean; error?: string }>((cb) => this.socket.emit('game:roll', { gameId: this.gameId }, cb)).then((r) => {
      if (!r.ok) this.notices.emit(r.error ?? 'Could not roll');
    });
  }
  move(token: number) {
    void emitAck<{ ok: boolean; error?: string }>((cb) => this.socket.emit('game:move', { gameId: this.gameId, token }, cb)).then((r) => {
      if (!r.ok) this.notices.emit(r.error ?? 'Could not move');
    });
  }
  react(text: string) { this.socket.emit('game:react', { gameId: this.gameId, text }); }
  leave() {
    if (!this.finished) this.socket.emit('game:leave', { gameId: this.gameId });
    this.dispose();
  }
  displayed() {}
  sync() { if (!this.finished) this.socket.emit('game:sync', { gameId: this.gameId }); }
  dispose() {
    this.offs.forEach((f) => f());
    this.offs = [];
    this.updates.clear();
    this.reactions.clear();
    this.over.clear();
    this.notices.clear();
  }
}
