// Twelve original cartoon avatars, drawn procedurally in SVG.

const BG = ['#FF7A59', '#4FC3F7', '#9CCC65', '#BA68C8', '#FFD54F', '#4DB6AC', '#F06292', '#7986CB', '#FFB74D', '#81C784', '#64B5F6', '#E57373'];
const SKIN = ['#F9D3B4', '#E8B08A', '#C68642', '#8D5524'];
const HAIR = ['#2B1B12', '#6B3E26', '#E0A526', '#1B1B1B', '#B23A48', '#5D4037'];

interface Look { skin: number; hair: number; style: number; acc: number; mouth: number }
const LOOKS: Look[] = [
  { skin: 0, hair: 0, style: 0, acc: 0, mouth: 0 },
  { skin: 2, hair: 3, style: 1, acc: 1, mouth: 1 },
  { skin: 1, hair: 2, style: 2, acc: 0, mouth: 0 },
  { skin: 3, hair: 3, style: 3, acc: 2, mouth: 2 },
  { skin: 0, hair: 4, style: 4, acc: 0, mouth: 1 },
  { skin: 1, hair: 1, style: 5, acc: 1, mouth: 0 },
  { skin: 2, hair: 0, style: 2, acc: 3, mouth: 2 },
  { skin: 0, hair: 5, style: 1, acc: 0, mouth: 0 },
  { skin: 3, hair: 1, style: 4, acc: 1, mouth: 1 },
  { skin: 1, hair: 3, style: 0, acc: 2, mouth: 2 },
  { skin: 2, hair: 2, style: 3, acc: 0, mouth: 0 },
  { skin: 0, hair: 3, style: 5, acc: 3, mouth: 1 },
];

function Hair({ style, color }: { style: number; color: string }) {
  switch (style) {
    case 0: // short side part
      return <path d="M26 46 C24 24 44 16 56 18 C70 20 78 30 76 46 C70 36 58 30 44 32 C36 34 30 40 26 46Z" fill={color} />;
    case 1: // spiky
      return <path d="M25 46 L28 26 L36 32 L40 18 L48 28 L54 15 L60 28 L68 20 L70 32 L77 28 L76 46 C66 34 36 34 25 46Z" fill={color} />;
    case 2: // long
      return (
        <>
          <path d="M22 50 C18 22 40 14 52 15 C68 16 82 26 78 52 L80 82 L68 80 L70 44 C60 34 40 34 30 44 L32 80 L20 82Z" fill={color} />
        </>
      );
    case 3: // bun
      return (
        <>
          <circle cx="50" cy="16" r="10" fill={color} />
          <path d="M26 46 C24 26 40 20 50 20 C62 20 78 26 74 46 C66 34 36 34 26 46Z" fill={color} />
        </>
      );
    case 4: // curly
      return (
        <g fill={color}>
          {[[30, 34], [38, 25], [50, 21], [62, 25], [70, 34], [25, 45], [75, 45]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="10" />)}
        </g>
      );
    default: // cap
      return (
        <>
          <path d="M25 42 C25 22 75 22 75 42Z" fill="#E53935" />
          <path d="M60 40 L88 42 C88 46 70 46 60 45Z" fill="#B71C1C" />
          <circle cx="50" cy="23" r="3" fill="#fff" />
        </>
      );
  }
}

export function Avatar({ id, size = 56, className = '' }: { id: number; size?: number; className?: string }) {
  const i = ((id % 12) + 12) % 12;
  const look = LOOKS[i];
  const skin = SKIN[look.skin];
  const hair = HAIR[look.hair];
  return (
    <svg className={'avatar ' + className} width={size} height={size} viewBox="0 0 100 100" aria-hidden>
      <defs>
        <radialGradient id={`avbg${i}`} cx="0.35" cy="0.3" r="0.9">
          <stop offset="0" stopColor="#fff" stopOpacity="0.45" />
          <stop offset="0.5" stopColor={BG[i]} />
          <stop offset="1" stopColor={BG[i]} />
        </radialGradient>
        <clipPath id={`avclip${i}`}><circle cx="50" cy="50" r="50" /></clipPath>
      </defs>
      <g clipPath={`url(#avclip${i})`}>
        <rect width="100" height="100" fill={`url(#avbg${i})`} />
        {look.style === 2 && <path d="M22 50 L20 90 L80 90 L78 50Z" fill={hair} />}
        {/* shoulders */}
        <path d="M14 100 C16 80 32 74 50 74 C68 74 84 80 86 100Z" fill={BG[(i + 5) % 12]} />
        <rect x="43" y="62" width="14" height="14" rx="5" fill={skin} />
        {/* face */}
        <ellipse cx="50" cy="48" rx="24" ry="26" fill={skin} />
        <circle cx="26" cy="50" r="5" fill={skin} />
        <circle cx="74" cy="50" r="5" fill={skin} />
        <Hair style={look.style} color={hair} />
        {/* eyes */}
        <ellipse cx="41" cy="50" rx="3.2" ry="4" fill="#222" />
        <ellipse cx="59" cy="50" rx="3.2" ry="4" fill="#222" />
        <circle cx="42.2" cy="48.6" r="1.1" fill="#fff" />
        <circle cx="60.2" cy="48.6" r="1.1" fill="#fff" />
        <path d="M36 42 Q41 39 46 42" stroke="#3a2a20" strokeWidth="2" fill="none" strokeLinecap="round" />
        <path d="M54 42 Q59 39 64 42" stroke="#3a2a20" strokeWidth="2" fill="none" strokeLinecap="round" />
        <ellipse cx="35" cy="59" rx="4" ry="2.5" fill="#FF8A80" opacity="0.55" />
        <ellipse cx="65" cy="59" rx="4" ry="2.5" fill="#FF8A80" opacity="0.55" />
        {look.mouth === 0 && <path d="M42 62 Q50 70 58 62" stroke="#5a2a1a" strokeWidth="2.6" fill="none" strokeLinecap="round" />}
        {look.mouth === 1 && <path d="M42 61 Q50 72 58 61Z" fill="#7a2a1a" />}
        {look.mouth === 2 && <path d="M44 64 Q50 67 56 63" stroke="#5a2a1a" strokeWidth="2.6" fill="none" strokeLinecap="round" />}
        {look.acc === 1 && (
          <g stroke="#1b1b1b" strokeWidth="2.2" fill="rgba(255,255,255,0.25)">
            <circle cx="41" cy="50" r="7" />
            <circle cx="59" cy="50" r="7" />
            <path d="M48 50 L52 50" />
          </g>
        )}
        {look.acc === 2 && <path d="M26 38 Q50 28 74 38" stroke="#FFEB3B" strokeWidth="5" fill="none" strokeLinecap="round" />}
        {look.acc === 3 && <path d="M40 67 Q50 73 60 67 L58 76 Q50 80 42 76Z" fill="#2B1B12" opacity="0.8" />}
      </g>
    </svg>
  );
}
