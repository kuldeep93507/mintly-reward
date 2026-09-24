// Small inline icon set (stroke icons + a few filled game icons).
type Name =
  | 'back' | 'gear' | 'coin' | 'gift' | 'trophy' | 'book' | 'globe' | 'users' | 'cpu' | 'phone' | 'share' | 'menu'
  | 'smile' | 'close' | 'sound' | 'mute' | 'exit' | 'lock' | 'check' | 'wifi' | 'wifiOff' | 'edit' | 'plus' | 'key' | 'star' | 'crown' | 'heart' | 'backspace';

export function Icon({ name, size = 24, className = '' }: { name: Name; size?: number; className?: string }) {
  const p = { width: size, height: size, viewBox: '0 0 24 24', className: 'icon ' + className, fill: 'none', stroke: 'currentColor', strokeWidth: 2.4, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
  switch (name) {
    case 'back': return <svg {...p}><path d="M15 5l-7 7 7 7" /></svg>;
    case 'close': return <svg {...p}><path d="M6 6l12 12M18 6L6 18" /></svg>;
    case 'gear': return <svg {...p}><circle cx="12" cy="12" r="3.2" /><path d="M12 2.5v3M12 18.5v3M21.5 12h-3M5.5 12h-3M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1M18.7 18.7l-2.1-2.1M7.4 7.4L5.3 5.3" /></svg>;
    case 'coin': return (
      <svg width={size} height={size} viewBox="0 0 24 24" className={'icon ' + className} aria-hidden>
        <circle cx="12" cy="12" r="10.5" fill="#E09A00" />
        <circle cx="12" cy="11.2" r="9.5" fill="#FFCC1E" />
        <circle cx="12" cy="11.2" r="6.6" fill="none" stroke="#E8A200" strokeWidth="1.6" />
        <path d="M12 7.2l1.2 2.5 2.7.3-2 1.8.6 2.7-2.5-1.4-2.5 1.4.6-2.7-2-1.8 2.7-.3z" fill="#E8A200" />
      </svg>
    );
    case 'gift': return <svg {...p}><rect x="3.5" y="9" width="17" height="11.5" rx="2" /><path d="M2.5 9h19M12 9v11.5M12 9c-2-4-6-5-6-2.5S9.5 9 12 9zM12 9c2-4 6-5 6-2.5S14.5 9 12 9z" /></svg>;
    case 'trophy': return <svg {...p}><path d="M7 4h10v5a5 5 0 01-10 0V4zM7 6H4a3 3 0 003 4M17 6h3a3 3 0 01-3 4M12 14v4M8 21h8M9 18h6" /></svg>;
    case 'book': return <svg {...p}><path d="M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2V5zM4 19a2 2 0 012-2h13" /></svg>;
    case 'globe': return <svg {...p}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" /></svg>;
    case 'users': return <svg {...p}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-4 3-6 6.5-6s6.5 2 6.5 6" /><circle cx="17" cy="9" r="2.8" /><path d="M16.5 14c3 0 5 1.8 5 5" /></svg>;
    case 'cpu': return <svg {...p}><rect x="6" y="6" width="12" height="12" rx="2" /><rect x="9.5" y="9.5" width="5" height="5" rx="1" /><path d="M9 2.5v3M15 2.5v3M9 18.5v3M15 18.5v3M2.5 9h3M2.5 15h3M18.5 9h3M18.5 15h3" /></svg>;
    case 'phone': return <svg {...p}><rect x="6" y="2.5" width="12" height="19" rx="2.5" /><path d="M10.5 18.5h3" /></svg>;
    case 'share': return <svg {...p}><circle cx="6" cy="12" r="2.6" /><circle cx="18" cy="5.5" r="2.6" /><circle cx="18" cy="18.5" r="2.6" /><path d="M8.3 10.8l7.4-4M8.3 13.2l7.4 4" /></svg>;
    case 'menu': return <svg {...p}><path d="M4 6.5h16M4 12h16M4 17.5h16" /></svg>;
    case 'smile': return <svg {...p}><circle cx="12" cy="12" r="9" /><path d="M8 14.5c1 1.5 2.3 2.2 4 2.2s3-.7 4-2.2M9 9.5v.5M15 9.5v.5" /></svg>;
    case 'sound': return <svg {...p}><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" /><path d="M15.5 9a4.5 4.5 0 010 6M18 6.5a8 8 0 010 11" /></svg>;
    case 'mute': return <svg {...p}><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" /><path d="M16 9.5l5 5M21 9.5l-5 5" /></svg>;
    case 'exit': return <svg {...p}><path d="M14 4h4a2 2 0 012 2v12a2 2 0 01-2 2h-4M10 16l-4-4 4-4M6 12h10" /></svg>;
    case 'lock': return <svg {...p}><rect x="5" y="10.5" width="14" height="10" rx="2" /><path d="M8 10.5V8a4 4 0 018 0v2.5" /></svg>;
    case 'check': return <svg {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>;
    case 'wifi': return <svg {...p}><path d="M2.5 9a14 14 0 0119 0M5.5 12.5a9.5 9.5 0 0113 0M8.7 16a5 5 0 016.6 0" /><circle cx="12" cy="19.2" r="0.8" fill="currentColor" /></svg>;
    case 'wifiOff': return <svg {...p}><path d="M3 3l18 18M8.7 16a5 5 0 016.6 0M5.5 12.5a9.5 9.5 0 014-2.3M2.5 9a14 14 0 015-3M14 7.2A14 14 0 0121.5 9" /></svg>;
    case 'edit': return <svg {...p}><path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4" /></svg>;
    case 'plus': return <svg {...p}><path d="M12 5v14M5 12h14" /></svg>;
    case 'key': return <svg {...p}><circle cx="8" cy="15" r="4" /><path d="M11 12l8-8M16 7l2.5 2.5M14 9l2 2" /></svg>;
    case 'backspace': return <svg {...p}><path d="M8 5h12v14H8l-5-7z" /><path d="M12 9.5l5 5M17 9.5l-5 5" /></svg>;
    case 'star': return <svg width={size} height={size} viewBox="0 0 24 24" className={'icon ' + className} aria-hidden><path d="M12 2.5l2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17l-5.9 3.3 1.3-6.5L2.5 9.3l6.6-.8z" fill="currentColor" /></svg>;
    case 'heart': return <svg width={size} height={size} viewBox="0 0 24 24" className={'icon ' + className} aria-hidden><path d="M12 21s-8-5.2-8-11a4.5 4.5 0 018-2.8A4.5 4.5 0 0120 10c0 5.8-8 11-8 11z" fill="currentColor" /></svg>;
    case 'crown': return <svg width={size} height={size} viewBox="0 0 24 24" className={'icon ' + className} aria-hidden><path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z" fill="currentColor" stroke="#9a6a00" strokeWidth="1.2" strokeLinejoin="round" /></svg>;
  }
}
