import type { Color } from '@ludo/engine';
import { Avatar } from '../ui/Avatar';
import { Icon } from '../ui/Icon';
import type { SeatView } from './controller';
import { Dice } from './Dice';
import type { DiceView } from './useGameDisplay';
import { PALETTE } from './palette';
import { ordinal } from '../ui/kit';

interface Props {
  seat: SeatView | undefined;
  corner: 0 | 1 | 2 | 3; // TL, TR, BR, BL
  active: boolean;
  rank: number | null;
  out: boolean;
  dice: DiceView;
  canRoll: boolean;
  onRoll: () => void;
  /** Turn timer (online): local epoch ms deadline and full turn length. */
  deadline: number | null;
  turnMs: number | null;
  hearts: { left: number; max: number } | null;
  bubble: { text: string; id: number } | null;
}

export function PlayerPanel({ seat, corner, active, rank, out, dice, canRoll, onRoll, deadline, turnMs, hearts, bubble }: Props) {
  const right = corner === 1 || corner === 2;
  const bottom = corner >= 2;
  if (!seat) return <div className="panel empty" />;
  const col = PALETTE[seat.color as Color];
  const remaining = deadline && turnMs ? Math.max(0, deadline - Date.now()) : 0;
  return (
    <div className={`panel ${right ? 'right' : ''} ${bottom ? 'bottom' : ''} ${active ? 'active' : ''} ${out ? 'out' : ''}`}
      style={{ ['--pc' as string]: col.main, ['--pcd' as string]: col.dark }}
      data-color={seat.color}>
      <div className="panel-card">
        <div className="panel-avatar">
          <Avatar id={seat.avatar} size={46} />
          {active && deadline && turnMs && remaining > 0 && (
            <svg className="timer-ring" viewBox="0 0 52 52" key={deadline}>
              <circle cx="26" cy="26" r="24" pathLength={100}
                style={{ animationDuration: `${turnMs}ms`, animationDelay: `-${turnMs - remaining}ms` }} />
            </svg>
          )}
          {seat.isBot && <span className="cpu-badge">CPU</span>}
          {!seat.connected && <span className="conn-off" title="Disconnected"><Icon name="wifiOff" size={12} /></span>}
          {rank && <span className={`rank-badge r${Math.min(rank, 4)}`}>{rank}</span>}
        </div>
        <div className="panel-info">
          <div className="panel-name">{seat.isYou ? 'You' : seat.name}</div>
          <div className="panel-sub">
            {seat.level != null && <span className="lvl">Lv {seat.level}</span>}
            {hearts && (
              <span className="hearts">
                {Array.from({ length: hearts.max }, (_, i) => (
                  <Icon key={i} name="heart" size={11} className={i < hearts.left ? 'h-on' : 'h-off'} />
                ))}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="panel-dice">
        {rank !== null && !out && (
          <div className={`rank-medal r${Math.min(rank, 4)}`} title={`Finished ${ordinal(rank)}`}>
            {rank === 1 && <Icon name="crown" size={16} />}
            <span>{ordinal(rank)}</span>
          </div>
        )}
        {out && <div className="rank-medal left">Left</div>}
        {active && !out && rank === null && (
          <Dice value={dice.color === seat.color ? dice.value : 6} rolling={dice.rolling && dice.color === seat.color}
            canRoll={canRoll} onRoll={onRoll} color={col.main} />
        )}
      </div>
      {bubble && <div className="bubble" key={bubble.id}>{bubble.text}</div>}
    </div>
  );
}
