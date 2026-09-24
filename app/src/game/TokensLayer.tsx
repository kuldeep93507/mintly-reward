import { HOME, squareKey, tokenPoint, type Color, type GameState } from '@ludo/engine';
import { Pawn } from './Pawn';
import type { TokenOverride } from './useGameDisplay';
import { PALETTE } from './palette';

// Offsets (cell units) for 2-4 tokens sharing a square.
const STACK: Record<number, [number, number][]> = {
  2: [[-0.17, -0.17], [0.17, 0.17]],
  3: [[-0.2, -0.18], [0.2, -0.18], [0, 0.2]],
  4: [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]],
};

interface Props {
  state: GameState;
  overrides: Record<string, TokenOverride>;
  movable: number[];
  onMove: (t: number) => void;
  rotation: number;
  sparkle: { color: Color; n: number } | null;
}

export function TokensLayer({ state, overrides, movable, onMove, rotation, sparkle }: Props) {
  const cur = state.players[state.turn].color;
  const items = state.players.flatMap((pl) => pl.tokens.map((prog, i) => {
    const o = overrides[pl.color + i];
    return { color: pl.color, i, prog: o ? o.p : prog, o, out: pl.out };
  }));
  const groups = new Map<string, typeof items>();
  for (const it of items) {
    const k = squareKey(it.color, it.prog, it.i);
    groups.set(k, [...(groups.get(k) ?? []), it]);
  }
  const placed = items.map((it) => {
    const g = groups.get(squareKey(it.color, it.prog, it.i))!;
    let [r, c] = tokenPoint(it.color, it.prog, it.i);
    let scale = 1;
    if (g.length > 1) {
      const n = Math.min(g.length, 4);
      const [dr, dc] = STACK[n][Math.min(g.indexOf(it), 3)];
      r += dr; c += dc;
      scale = it.prog === HOME ? 0.5 : 0.66;
    } else if (it.prog === HOME) scale = 0.6;
    const isMovable = it.color === cur && movable.includes(it.i) && !it.o;
    return { ...it, r, c, scale, isMovable };
  });
  // Draw lower rows in front; movable tokens on top.
  placed.sort((a, b) => (a.isMovable ? 1 : 0) - (b.isMovable ? 1 : 0) || a.r - b.r);

  return (
    <div className="tokens-layer">
      {placed.map((t) => (
        <div
          key={t.color + t.i}
          className={`token ${t.o ? 'm-' + t.o.mode : ''} ${t.isMovable ? 'movable' : ''} ${t.out ? 'gone' : ''}`}
          style={{ left: `${(t.c / 15) * 100}%`, top: `${(t.r / 15) * 100}%`, zIndex: t.isMovable ? 50 : Math.round(t.r * 2) }}
          onClick={t.isMovable ? () => onMove(t.i) : undefined}
          data-testid={t.isMovable ? 'movable' : undefined}
          data-token={`${t.color}-${t.i}`}
        >
          <div className="token-rot" style={{ transform: `rotate(${-rotation}deg) scale(${t.scale})` }}>
            {t.isMovable && <span className="move-ring" style={{ borderColor: PALETTE[t.color].main }} />}
            <div className={`token-pawn ${t.o?.mode === 'hop' ? 'hop' : ''}`} key={t.o?.n ?? 0}>
              <Pawn color={t.color} />
            </div>
          </div>
        </div>
      ))}
      {sparkle && (
        <div className="sparkle" key={sparkle.n}
          style={{ left: `${(tokenPoint(sparkle.color, HOME, 0)[1] / 15) * 100}%`, top: `${(tokenPoint(sparkle.color, HOME, 0)[0] / 15) * 100}%` }}>
          {Array.from({ length: 10 }, (_, i) => <i key={i} style={{ ['--a' as string]: `${i * 36}deg`, background: i % 2 ? '#FFD54F' : PALETTE[sparkle.color].light }} />)}
        </div>
      )}
    </div>
  );
}
