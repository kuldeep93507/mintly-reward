import { useEffect, useState } from 'react';

const PIPS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[28, 28], [72, 72]],
  3: [[26, 26], [50, 50], [74, 74]],
  4: [[28, 28], [72, 28], [28, 72], [72, 72]],
  5: [[26, 26], [74, 26], [50, 50], [26, 74], [74, 74]],
  6: [[28, 24], [72, 24], [28, 50], [72, 50], [28, 76], [72, 76]],
};

export function DiceFace({ value }: { value: number }) {
  return (
    <svg viewBox="0 0 100 100" className="dice-face" aria-label={`Dice ${value}`}>
      <rect x="4" y="9" width="92" height="87" rx="22" fill="#A9A2CF" />
      <rect x="4" y="4" width="92" height="86" rx="22" fill="#FFFFFF" />
      <rect x="10" y="8" width="80" height="30" rx="15" fill="#fff" opacity="0.6" />
      {PIPS[value].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y - 3} r={value === 1 ? 13 : 9.5} fill={value === 1 ? '#E53935' : '#2A2250'} />
      ))}
    </svg>
  );
}

/** Dice button: tumbles while `rolling`, pulses when this player can tap it. */
export function Dice({ value, rolling, canRoll, onRoll, color }:
  { value: number; rolling: boolean; canRoll: boolean; onRoll: () => void; color: string }) {
  const [face, setFace] = useState(value);
  useEffect(() => {
    if (!rolling) { setFace(value); return; }
    const t = setInterval(() => setFace((f) => 1 + ((f + 1 + Math.floor(Math.random() * 4)) % 6)), 75);
    return () => clearInterval(t);
  }, [rolling, value]);
  return (
    <button
      className={`dice ${rolling ? 'rolling' : ''} ${canRoll ? 'can-roll' : ''}`}
      style={{ ['--glow' as string]: color }}
      onClick={canRoll ? onRoll : undefined}
      aria-label={canRoll ? 'Roll the dice' : 'Dice'}
      data-testid={canRoll ? 'roll' : undefined}
    >
      <span className="dice-inner"><DiceFace value={face} /></span>
    </button>
  );
}
