import { Header } from '../ui/kit';
import { DiceFace } from '../game/Dice';
import { Pawn } from '../game/Pawn';
import { Icon } from '../ui/Icon';

const RULES = [
  { art: <DiceFace value={6} />, title: 'Roll a 6 to start', text: 'Tokens leave the yard only on a 6. Tap your dice when it glows, then tap a glowing token.' },
  { art: <span className="ht-pawns"><Pawn color="green" /><Pawn color="green" /></span>, title: 'Race around the board', text: 'Move clockwise around the track, then up your coloured home column to the centre.' },
  { art: <span className="ht-bonus">+1</span>, title: 'Bonus rolls', text: 'Rolling a 6, capturing a token or bringing a token home earns another roll.' },
  { art: <span className="ht-three"><DiceFace value={6} /><DiceFace value={6} /><DiceFace value={6} /></span>, title: 'Three sixes', text: 'Roll three 6s in a row and your turn is lost.' },
  { art: <span className="ht-cap"><Pawn color="red" /><Pawn color="blue" /></span>, title: 'Capture!', text: 'Land on an opponent to send it back to its yard.' },
  { art: <Icon name="star" size={44} className="ht-star" />, title: 'Safe squares', text: 'Tokens on star squares and coloured start squares cannot be captured.' },
  { art: <span className="ht-home"><Pawn color="yellow" /></span>, title: 'Exact roll home', text: 'You need the exact number to reach the centre. First to bring all 4 tokens home wins.' },
  { art: <Icon name="heart" size={40} className="ht-heart" />, title: 'Online timer', text: 'Online, each turn has a timer. Miss your turn and you lose a heart — lose them all and you are out of the game.' },
];

export function HowToContent() {
  return (
    <div className="howto">
      {RULES.map((r) => (
        <div key={r.title} className="ht-row">
          <div className="ht-art">{r.art}</div>
          <div><div className="ht-title">{r.title}</div><div className="ht-text">{r.text}</div></div>
        </div>
      ))}
    </div>
  );
}

export function HowToScreen() {
  return (
    <div className="screen">
      <Header title="How to Play" />
      <HowToContent />
    </div>
  );
}
