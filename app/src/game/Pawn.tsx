import type { Color } from '@ludo/engine';
import { PALETTE } from './palette';
import { useBoardLook } from './theme';

/** An original pin-shaped pawn with shading and a white outline. */
export function Pawn({ color, size = '100%' }: { color: Color; size?: number | string }) {
  const p = PALETTE[color];
  const id = `pg-${color}`;
  const stroke = useBoardLook().pawnStroke;
  return (
    <svg className="pawn" width={size} height={size} viewBox="0 0 40 52" aria-hidden>
      <defs>
        <radialGradient id={id} cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor={p.light} />
          <stop offset="0.55" stopColor={p.main} />
          <stop offset="1" stopColor={p.dark} />
        </radialGradient>
      </defs>
      <ellipse cx="20" cy="47" rx="13" ry="4" fill="rgba(0,0,0,0.35)" />
      {/* body: a teardrop pin with a round base */}
      <path d="M20 4 C30 4 36 11 36 19 C36 28 27 33 24 42 L16 42 C13 33 4 28 4 19 C4 11 10 4 20 4Z"
        fill={`url(#${id})`} stroke={stroke} strokeWidth="3" strokeLinejoin="round" />
      <ellipse cx="20" cy="43" rx="11" ry="4.5" fill={p.dark} stroke={stroke} strokeWidth="2.5" />
      <circle cx="20" cy="18.5" r="7" fill="#fff" opacity="0.95" />
      <circle cx="20" cy="18.5" r="4.2" fill={p.main} />
      <ellipse cx="13" cy="12" rx="3.5" ry="2.2" fill="#fff" opacity="0.55" transform="rotate(-35 13 12)" />
    </svg>
  );
}
