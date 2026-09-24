import { useEffect, useMemo } from 'react';
import { useApp } from '../state/AppContext';
import type { GameOutcome } from '../game/controller';
import type { PlayAgain } from '../state/types';
import { startBotsGame, startPassGame } from '../game/startLocal';
import { startSnakesGame } from '../snakes/SnakesController';
import { Avatar } from '../ui/Avatar';
import { Btn, ordinal } from '../ui/kit';
import { Icon } from '../ui/Icon';
import { play } from '../audio/sfx';
import { buzz } from '../native/haptics';
import { PALETTE } from '../game/palette';

function Confetti() {
  const bits = useMemo(() => Array.from({ length: 60 }, (_, i) => ({
    left: Math.random() * 100, delay: Math.random() * 1.5, dur: 2.4 + Math.random() * 2, rot: Math.random() * 360,
    color: ['#E53935', '#2E9E48', '#F9C21A', '#1E7FE0', '#FF7AC6', '#fff'][i % 6], w: 6 + Math.random() * 6,
  })), []);
  return (
    <div className="confetti" aria-hidden>
      {bits.map((b, i) => (
        <i key={i} style={{ left: `${b.left}%`, animationDelay: `${b.delay}s`, animationDuration: `${b.dur}s`, background: b.color, width: b.w, height: b.w * 1.6, transform: `rotate(${b.rot}deg)` }} />
      ))}
    </div>
  );
}

export function ResultScreen({ outcome, again }: { outcome: GameOutcome; again: PlayAgain }) {
  const app = useApp();
  const won = outcome.you === null || outcome.ranking[0] === outcome.you;
  useEffect(() => {
    if (won) { play('win'); buzz('success'); } else play('lose');
  }, [won]);

  const playAgain = () => {
    if (again.kind === 'bots') app.replace({ id: 'game', controller: startBotsGame(again, app.identity, app.profile?.level ?? null), again });
    else if (again.kind === 'pass') app.replace({ id: 'game', controller: startPassGame(again), again });
    else if (again.kind === 'snakes') app.replace({ id: 'snakes', controller: startSnakesGame(again, app.identity), again });
    else if (again.kind === 'online') {
      if ((app.profile?.coins ?? 0) < again.stake) { app.toast('Not enough coins for this table'); app.replace({ id: 'online' }); }
      else app.replace({ id: 'matchmaking', players: again.players, stake: again.stake });
    } else app.replace({ id: 'friends' });
  };

  const seat = (c: string) => outcome.seats.find((s) => s.color === c);
  const podium = outcome.ranking.slice(0, 3);
  const order = podium.length === 3 ? [podium[1], podium[0], podium[2]] : podium.length === 2 ? [podium[1], podium[0]] : podium;
  const winnerName = outcome.you === null ? seat(outcome.ranking[0])?.name : null;

  return (
    <div className="screen result">
      {won && <Confetti />}
      <div className={`result-banner ${won ? 'win' : 'lose'}`}>
        {won ? (winnerName ? `${winnerName} wins!` : 'You Win!') : outcome.you && outcome.ranking.indexOf(outcome.you) >= 0 ? `You came ${ordinal(outcome.ranking.indexOf(outcome.you) + 1)}` : 'Game Over'}
      </div>
      <div className="podium">
        {order.map((c) => {
          const place = outcome.ranking.indexOf(c) + 1;
          const s = seat(c);
          return (
            <div key={c} className={`pod pod-${place}`}>
              {place === 1 && <span className="pod-crown"><Icon name="crown" size={34} /></span>}
              <div className="pod-av" style={{ borderColor: PALETTE[c].main }}><Avatar id={s?.avatar ?? 0} size={place === 1 ? 76 : 60} /></div>
              <div className="pod-name">{s?.isYou ? 'You' : s?.name}</div>
              {outcome.payouts?.[c] ? <div className="pod-coins"><Icon name="coin" size={16} />+{outcome.payouts[c]!.toLocaleString()}</div> : null}
              <div className="pod-block" style={{ background: `linear-gradient(${PALETTE[c].light}, ${PALETTE[c].dark})` }}>{place}</div>
            </div>
          );
        })}
      </div>
      {outcome.ranking.length > 3 && (
        <div className="rest-ranks">
          {outcome.ranking.slice(3).map((c, i) => (
            <div key={c} className="rest-row"><b>{i + 4}</b><Avatar id={seat(c)?.avatar ?? 0} size={32} />{seat(c)?.isYou ? 'You' : seat(c)?.name}</div>
          ))}
        </div>
      )}
      {outcome.online && outcome.you && (
        <div className="result-coins">
          {outcome.payouts?.[outcome.you] ? <>You won <Icon name="coin" size={24} /> <b>{outcome.payouts[outcome.you]!.toLocaleString()}</b></>
            : outcome.stake > 0 ? 'Better luck next time!' : 'Friendly game — no coins at stake'}
        </div>
      )}
      <div className="result-btns">
        <Btn variant="green" size="lg" onClick={playAgain} data-testid="play-again">Play Again</Btn>
        <Btn variant="blue" size="lg" onClick={app.home} data-testid="home">Home</Btn>
      </div>
    </div>
  );
}
