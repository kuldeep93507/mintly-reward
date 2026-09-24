import {
  ALL_COLORS, HOME_COLUMN, LADDERS, SNAKES, START_INDEX, TRACK, YARD_ORIGIN, snakesCell, tokenPoint,
  type Color, type GameState, type SnakesState,
} from '@ludo/engine';

export const COLORS: Record<Color, string> = { red: '#ef4444', green: '#22c55e', yellow: '#eab308', blue: '#3b82f6' };

/** Compact live Ludo board drawn from the shared engine geometry. */
export function LudoMini({ state }: { state: GameState }) {
  const starts = new Map(ALL_COLORS.map((c) => [START_INDEX[c], c] as const));
  return (
    <svg className="mini" viewBox="0 0 15 15" aria-label="Board">
      <rect width="15" height="15" fill="#111827" />
      {ALL_COLORS.map((c) => {
        const [r, col] = YARD_ORIGIN[c];
        return <rect key={c} x={col + 0.15} y={r + 0.15} width={5.7} height={5.7} rx={0.6} fill={COLORS[c]} opacity={0.28} />;
      })}
      {TRACK.map(([r, c], i) => (
        <rect key={i} x={c + 0.06} y={r + 0.06} width={0.88} height={0.88} rx={0.15}
          fill={starts.has(i) ? COLORS[starts.get(i)!] : '#1f2937'} opacity={starts.has(i) ? 0.7 : 1} />
      ))}
      {ALL_COLORS.map((c) => HOME_COLUMN[c].map(([r, col], i) => (
        <rect key={c + i} x={col + 0.06} y={r + 0.06} width={0.88} height={0.88} rx={0.15} fill={COLORS[c]} opacity={0.45} />
      )))}
      <rect x={6} y={6} width={3} height={3} fill="#374151" />
      {state.players.flatMap((p) => p.tokens.map((prog, i) => {
        const [r, c] = tokenPoint(p.color, prog, i);
        return (
          <circle key={p.color + i} cx={c} cy={r} r={0.36} fill={COLORS[p.color]} stroke={p.out ? '#6b7280' : '#fff'}
            strokeWidth={0.1} opacity={p.out ? 0.35 : 1} />
        );
      }))}
    </svg>
  );
}

/** Compact Snakes & Ladders board with player positions. */
export function SnakesMini({ state }: { state: SnakesState }) {
  const pt = (sq: number) => { const [r, c] = snakesCell(sq); return [c + 0.5, r + 0.5] as const; };
  return (
    <svg className="mini" viewBox="0 0 10 10" aria-label="Board">
      <rect width="10" height="10" fill="#111827" />
      {Array.from({ length: 100 }, (_, i) => {
        const [r, c] = snakesCell(i + 1);
        return <rect key={i} x={c + 0.04} y={r + 0.04} width={0.92} height={0.92} rx={0.1} fill={(r + c) % 2 ? '#1f2937' : '#273244'} />;
      })}
      {Object.entries(LADDERS).map(([a, b]) => { const [x1, y1] = pt(+a); const [x2, y2] = pt(b); return <line key={a} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#a16207" strokeWidth={0.14} />; })}
      {Object.entries(SNAKES).map(([a, b]) => { const [x1, y1] = pt(+a); const [x2, y2] = pt(b); return <line key={a} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#16a34a" strokeWidth={0.18} strokeLinecap="round" />; })}
      {state.players.map((p, i) => {
        const [x, y] = pt(Math.max(1, p.pos));
        return <circle key={p.color} cx={x + (i % 2 ? 0.18 : -0.18)} cy={y + (i > 1 ? 0.18 : -0.18)} r={0.26} fill={COLORS[p.color]} stroke="#fff" strokeWidth={0.07} opacity={p.pos ? 1 : 0.5} />;
      })}
    </svg>
  );
}
