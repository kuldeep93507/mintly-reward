import { memo } from 'react';
import { ALL_COLORS, HOME_COLUMN, START_INDEX, STAR_INDEXES, TRACK, YARD_ORIGIN, YARD_SPOTS, type Color } from '@ludo/engine';
import { PALETTE } from './palette';
import { useBoardLook } from './theme';

const STAR = 'M0 -0.34 L0.1 -0.11 L0.33 -0.1 L0.15 0.05 L0.21 0.28 L0 0.15 L-0.21 0.28 L-0.15 0.05 L-0.33 -0.1 L-0.1 -0.11Z';

// Direction of the entry arrow on each colour's start square (row, col unit vector).
const START_ARROW: Record<Color, number> = { red: 0, green: 90, yellow: 180, blue: 270 };

/** Static board drawn from the engine geometry. 1 SVG unit = 1 cell. */
export const Board = memo(function Board() {
  const startCells = new Map(ALL_COLORS.map((c) => [START_INDEX[c], c] as const));
  const look = useBoardLook();
  return (
    <svg className="board-svg" viewBox="0 0 15 15" aria-label="Ludo board">
      <defs>
        {ALL_COLORS.map((c) => (
          <linearGradient key={c} id={`yard-${c}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={PALETTE[c].light} />
            <stop offset="1" stopColor={PALETTE[c].main} />
          </linearGradient>
        ))}
        <radialGradient id="spot-shade" cx="0.5" cy="0.35" r="0.65">
          <stop offset="0" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.25" />
        </radialGradient>
      </defs>
      <rect x="0" y="0" width="15" height="15" fill={look.bg} />

      {/* track squares */}
      {TRACK.map(([r, c], i) => {
        const sc = startCells.get(i);
        return (
          <rect key={i} x={c + 0.04} y={r + 0.04} width={0.92} height={0.92} rx={0.12}
            fill={sc ? PALETTE[sc].main : look.cell} stroke={look.cellStroke} strokeWidth={0.05} />
        );
      })}
      {/* home columns */}
      {ALL_COLORS.map((color) => HOME_COLUMN[color].map(([r, c], i) => (
        <rect key={color + i} x={c + 0.04} y={r + 0.04} width={0.92} height={0.92} rx={0.12} fill={PALETTE[color].main} stroke={PALETTE[color].dark} strokeWidth={0.04} />
      )))}
      {/* stars on safe squares */}
      {STAR_INDEXES.map((i) => {
        const [r, c] = TRACK[i];
        return <path key={i} d={STAR} transform={`translate(${c + 0.5} ${r + 0.5}) scale(1.25)`} fill={look.star} stroke={look.starStroke} strokeWidth={0.03} />;
      })}
      {/* arrows on start squares */}
      {ALL_COLORS.map((color) => {
        const [r, c] = TRACK[START_INDEX[color]];
        return (
          <g key={color} transform={`translate(${c + 0.5} ${r + 0.5}) rotate(${START_ARROW[color]})`}>
            <path d="M-0.26 -0.18 L0.24 0 L-0.26 0.18 L-0.14 0Z" fill="#fff" opacity={0.95} />
          </g>
        );
      })}

      {/* yards */}
      {ALL_COLORS.map((color) => {
        const [r0, c0] = YARD_ORIGIN[color];
        return (
          <g key={color}>
            <rect x={c0 + 0.08} y={r0 + 0.08} width={5.84} height={5.84} rx={0.6} fill={`url(#yard-${color})`} stroke={PALETTE[color].dark} strokeWidth={0.08} />
            <rect x={c0 + 0.9} y={r0 + 0.9} width={4.2} height={4.2} rx={0.55} fill={look.yardInner} stroke={PALETTE[color].dark} strokeWidth={0.06} />
            {YARD_SPOTS.map(([dr, dc], i) => (
              <g key={i}>
                <circle cx={c0 + dc} cy={r0 + dr} r={0.66} fill={PALETTE[color].main} />
                <circle cx={c0 + dc} cy={r0 + dr} r={0.66} fill="url(#spot-shade)" />
                <circle cx={c0 + dc} cy={r0 + dr} r={0.46} fill={PALETTE[color].pale} opacity={0.5} />
              </g>
            ))}
          </g>
        );
      })}

      {/* centre home triangles */}
      <g stroke="#fff" strokeWidth={0.06} strokeLinejoin="round">
        <path d="M6 6 L6 9 L7.5 7.5Z" fill={PALETTE.red.main} />
        <path d="M6 6 L9 6 L7.5 7.5Z" fill={PALETTE.green.main} />
        <path d="M9 6 L9 9 L7.5 7.5Z" fill={PALETTE.yellow.main} />
        <path d="M6 9 L9 9 L7.5 7.5Z" fill={PALETTE.blue.main} />
      </g>
      <circle cx={7.5} cy={7.5} r={0.42} fill="#fff" opacity={0.9} />
      <path d={STAR} transform="translate(7.5 7.5) scale(1.1)" fill="#FFC928" />
    </svg>
  );
});
