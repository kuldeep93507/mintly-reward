import { memo } from 'react';
import { LADDERS, SNAKES, snakesCell } from '@ludo/engine';
import { useBoardLook } from '../game/theme';

/** Centre of square 1..100 in board units (1 unit = 1 cell, 10x10). */
export function squarePoint(sq: number): [x: number, y: number] {
  const [r, c] = snakesCell(sq);
  return [c + 0.5, r + 0.5];
}

const CELL_COLORS: Record<string, [string, string]> = {
  classic: ['#FFF6D6', '#FFE08A'],
  night: ['#231C5A', '#2F2775'],
  wood: ['#F3DCB5', '#E2BD86'],
  candy: ['#FFF0F8', '#FFD1EA'],
};
const SNAKE_COLORS = ['#2E9E48', '#E53935', '#8E4FF0', '#1E7FE0', '#F57C00'];

function Ladder({ from, to }: { from: number; to: number }) {
  const [x1, y1] = squarePoint(from);
  const [x2, y2] = squarePoint(to);
  const len = Math.hypot(x2 - x1, y2 - y1);
  const nx = -(y2 - y1) / len * 0.2;
  const ny = (x2 - x1) / len * 0.2;
  const rungs = Math.max(2, Math.floor(len / 0.42));
  return (
    <g className="sl-ladder">
      <g stroke="#7a4a1e" strokeWidth={0.13} strokeLinecap="round">
        <line x1={x1 + nx} y1={y1 + ny} x2={x2 + nx} y2={y2 + ny} />
        <line x1={x1 - nx} y1={y1 - ny} x2={x2 - nx} y2={y2 - ny} />
      </g>
      <g stroke="#c98a48" strokeWidth={0.08} strokeLinecap="round">
        {Array.from({ length: rungs }, (_, i) => {
          const t = (i + 0.5) / rungs;
          const cx = x1 + (x2 - x1) * t;
          const cy = y1 + (y2 - y1) * t;
          return <line key={i} x1={cx + nx} y1={cy + ny} x2={cx - nx} y2={cy - ny} />;
        })}
      </g>
    </g>
  );
}

function Snake({ head, tail, color }: { head: number; tail: number; color: string }) {
  const [x1, y1] = squarePoint(head);
  const [x2, y2] = squarePoint(tail);
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  const px = -dy / len;
  const py = dx / len;
  const w = Math.min(1.1, len * 0.28);
  const c1 = [x1 + dx * 0.3 + px * w, y1 + dy * 0.3 + py * w];
  const c2 = [x1 + dx * 0.7 - px * w, y1 + dy * 0.7 - py * w];
  const d = `M${x1} ${y1} C${c1[0]} ${c1[1]} ${c2[0]} ${c2[1]} ${x2} ${y2}`;
  const ang = (Math.atan2(c1[1] - y1, c1[0] - x1) * 180) / Math.PI;
  return (
    <g className="sl-snake">
      <path d={d} fill="none" stroke="rgba(0,0,0,0.25)" strokeWidth={0.36} strokeLinecap="round" transform="translate(0.04 0.06)" />
      <path d={d} fill="none" stroke={color} strokeWidth={0.32} strokeLinecap="round" />
      <path d={d} fill="none" stroke="#FFE066" strokeWidth={0.1} strokeLinecap="round" strokeDasharray="0.12 0.3" opacity={0.85} />
      <g transform={`translate(${x1} ${y1}) rotate(${ang})`}>
        <ellipse rx={0.3} ry={0.24} fill={color} stroke="rgba(0,0,0,0.3)" strokeWidth={0.03} />
        <circle cx={0.1} cy={-0.1} r={0.07} fill="#fff" /><circle cx={0.12} cy={-0.1} r={0.035} fill="#111" />
        <circle cx={0.1} cy={0.1} r={0.07} fill="#fff" /><circle cx={0.12} cy={0.1} r={0.035} fill="#111" />
        <path d="M0.28 0 L0.46 -0.04 M0.28 0 L0.46 0.04" stroke="#E53935" strokeWidth={0.03} strokeLinecap="round" />
      </g>
    </g>
  );
}

/** Static Snakes & Ladders board: numbered squares, ladders, then snakes on top. */
export const SnakesBoard = memo(function SnakesBoard({ theme }: { theme: string }) {
  const look = useBoardLook();
  const [a, b] = CELL_COLORS[theme] ?? CELL_COLORS.classic;
  const dark = theme === 'night';
  return (
    <svg className="board-svg sl-board" viewBox="0 0 10 10" aria-label="Snakes and Ladders board">
      <rect width="10" height="10" fill={look.bg} />
      {Array.from({ length: 100 }, (_, i) => {
        const sq = i + 1;
        const [r, c] = snakesCell(sq);
        return (
          <g key={sq}>
            <rect x={c} y={r} width={1} height={1} fill={(r + c) % 2 ? a : b} stroke={look.cellStroke} strokeWidth={0.02} />
            <text x={c + 0.08} y={r + 0.28} fontSize={0.24} fontWeight={800} fill={dark ? '#b9b2ea' : '#6d5a2a'} fontFamily="Nunito, sans-serif">{sq}</text>
          </g>
        );
      })}
      <path d="M0.5 0.25 l0.1 0.22 0.24 0.02 -0.18 0.16 0.06 0.24 -0.22 -0.13 -0.22 0.13 0.06 -0.24 -0.18 -0.16 0.24 -0.02z" transform="translate(0.02 0.08)" fill="#FFC928" stroke="#9a6a00" strokeWidth={0.02} />
      {Object.entries(LADDERS).map(([f, t]) => <Ladder key={f} from={Number(f)} to={t} />)}
      {Object.entries(SNAKES).map(([h, t], i) => <Snake key={h} head={Number(h)} tail={t} color={SNAKE_COLORS[i % SNAKE_COLORS.length]} />)}
    </svg>
  );
});
