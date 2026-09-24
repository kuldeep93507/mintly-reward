import { type RoomInfo, seatColors } from '@ludo/engine';
import { randomInt } from 'node:crypto';
import type { Hub, Sock } from './hub.js';
import { UserError } from './errors.js';

interface Room {
  code: string;
  hostId: string;
  maxPlayers: number;
  stake: number;
  members: string[];
  /** Disconnect grace timers per member. */
  away: Map<string, NodeJS.Timeout>;
}

export class Rooms {
  private rooms = new Map<string, Room>();

  constructor(private hub: Hub) {}

  private info(r: Room): RoomInfo {
    return { code: r.code, hostId: r.hostId, maxPlayers: r.maxPlayers, stake: r.stake, members: r.members.map((m) => this.hub.publicUser(m)) };
  }

  private broadcast(r: Room): void {
    const info = this.info(r);
    for (const m of r.members) this.hub.emitToUser(m, 'room:update', info);
  }

  private checkCoins(userId: string, stake: number): void {
    const u = this.hub.db.getUser(userId);
    if (!u || u.coins < stake) throw new UserError('Not enough coins');
  }

  create(userId: string, maxPlayers: unknown, stake: unknown): RoomInfo {
    if (maxPlayers !== 2 && maxPlayers !== 3 && maxPlayers !== 4) throw new UserError('Players must be 2, 3 or 4');
    if (typeof stake !== 'number' || (stake !== 0 && !this.hub.cfg.stakes.includes(stake))) throw new UserError('Invalid stake');
    this.hub.assertFree(userId);
    this.checkCoins(userId, stake);
    let code: string;
    do code = String(randomInt(100000, 1000000)); while (this.rooms.has(code));
    const r: Room = { code, hostId: userId, maxPlayers, stake, members: [userId], away: new Map() };
    this.rooms.set(code, r);
    this.hub.where.set(userId, { kind: 'room', code });
    this.hub.cfg.log('room create', code, `max=${maxPlayers} stake=${stake}`);
    return this.info(r);
  }

  join(userId: string, code: unknown): RoomInfo {
    if (typeof code !== 'string' || !/^\d{6}$/.test(code.trim())) throw new UserError('Room not found');
    const r = this.rooms.get(code.trim());
    if (!r) throw new UserError('Room not found');
    this.hub.assertFree(userId);
    if (r.members.length >= r.maxPlayers) throw new UserError('Room is full');
    this.checkCoins(userId, r.stake);
    r.members.push(userId);
    this.hub.where.set(userId, { kind: 'room', code: r.code });
    this.broadcast(r);
    return this.info(r);
  }

  leave(userId: string): void {
    const w = this.hub.where.get(userId);
    if (w?.kind !== 'room') return;
    const r = this.rooms.get(w.code);
    this.hub.where.delete(userId);
    if (!r) return;
    const t = r.away.get(userId);
    if (t) clearTimeout(t);
    r.away.delete(userId);
    if (userId === r.hostId) return this.closeRoom(r, 'The host left the room');
    r.members = r.members.filter((m) => m !== userId);
    this.broadcast(r);
  }

  start(userId: string): void {
    const w = this.hub.where.get(userId);
    const r = w?.kind === 'room' ? this.rooms.get(w.code) : undefined;
    if (!r) throw new UserError('You are not in a room');
    if (r.hostId !== userId) throw new UserError('Only the host can start');
    if (r.members.length < 2) throw new UserError('Need at least 2 players');
    const members = r.members.slice();
    for (const m of members) this.hub.where.delete(m);
    for (const t of r.away.values()) clearTimeout(t);
    r.away.clear();
    this.rooms.delete(r.code);
    const game = this.hub.startGame({ humans: members, colors: seatColors(members.length), stake: r.stake, shuffle: false, minHumans: members.length });
    if (!game) {
      // Someone could not pay: reopen the room without them.
      const ok = members.filter((m) => (this.hub.db.getUser(m)?.coins ?? 0) >= r.stake);
      if (!ok.includes(r.hostId)) {
        for (const m of members) this.hub.emitToUser(m, 'room:closed', { reason: 'The host cannot pay the entry fee' });
        throw new UserError('Not enough coins');
      }
      r.members = ok;
      this.rooms.set(r.code, r);
      for (const m of ok) this.hub.where.set(m, { kind: 'room', code: r.code });
      for (const m of members) if (!ok.includes(m)) this.hub.emitToUser(m, 'room:closed', { reason: 'Not enough coins for the entry fee' });
      this.broadcast(r);
      throw new UserError('A player could not pay the entry fee');
    }
  }

  onDisconnect(userId: string): void {
    const w = this.hub.where.get(userId);
    const r = w?.kind === 'room' ? this.rooms.get(w.code) : undefined;
    if (!r) return;
    const t = setTimeout(() => {
      r.away.delete(userId);
      if (!this.hub.isOnline(userId)) this.leave(userId);
    }, this.hub.cfg.hostGraceSeconds * 1000);
    r.away.set(userId, t);
  }

  onReconnect(userId: string, socket: Sock): void {
    const w = this.hub.where.get(userId);
    const r = w?.kind === 'room' ? this.rooms.get(w.code) : undefined;
    if (!r) return;
    const t = r.away.get(userId);
    if (t) clearTimeout(t);
    r.away.delete(userId);
    socket.emit('room:update', this.info(r));
  }

  private closeRoom(r: Room, reason: string): void {
    this.rooms.delete(r.code);
    for (const t of r.away.values()) clearTimeout(t);
    for (const m of r.members) {
      if (m !== r.hostId) this.hub.where.delete(m);
      this.hub.emitToUser(m, 'room:closed', { reason });
    }
    this.hub.cfg.log('room closed', r.code, reason);
  }

  list(): RoomInfo[] {
    return [...this.rooms.values()].map((r) => this.info(r));
  }

  close(): void {
    for (const r of this.rooms.values()) for (const t of r.away.values()) clearTimeout(t);
  }
}
