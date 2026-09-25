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
  const winner = outcome.ranking[0];
  const winnerSeat = seat(winner);
  const youPlace = outcome.you ? outcome.ranking.indexOf(outcome.you) + 1 : 0;
  const leftSet = new Set(outcome.left ?? []);

  return (
    <div className="screen result">
      {won && <Confetti />}
      <div className={`result-banner ${won ? 'win' : 'lose'}`}>
        {won ? (outcome.you === null ? `${winnerSeat?.name ?? 'Winner'} wins!` : 'You Win!') : youPlace > 0 ? `You came ${ordinal(youPlace)}` : 'Game Over'}
      </div>

      {winnerSeat && (
        <div className="winner-card" style={{ ['--wc' as string]: PALETTE[winner].main }}>
          <span className="winner-crown"><Icon name="crown" size={40} /></span>
          <div className="winner-av"><Avatar id={winnerSeat.avatar} size={84} /></div>
          <div className="winner-label">WINNER</div>
          <div className="winner-name">{winnerSeat.isYou ? 'You' : winnerSeat.name}</div>
        </div>
      )}

      <div className="standings" data-testid="standings">
        <div className="standings-title">Final standings</div>
        {outcome.ranking.map((c, i) => {
          const place = i + 1;
          const s = seat(c);
          const pay = outcome.payouts?.[c];
          return (
            <div key={c} className={`stand-row p${Math.min(place, 4)} ${s?.isYou ? 'you' : ''}`} style={{ animationDelay: `${150 + i * 120}ms` }}>
              <div className={`stand-place p${Math.min(place, 4)}`}>
                {place === 1 && <Icon name="crown" size={14} />}
                {ordinal(place)}
              </div>
              <div className="stand-av" style={{ borderColor: PALETTE[c].main }}><Avatar id={s?.avatar ?? 0} size={40} /></div>
              <div className="stand-name">
                <span>{s?.isYou ? 'You' : s?.name}</span>
                <small>{leftSet.has(c) ? 'Left the game' : s?.isBot ? 'Computer' : place === 1 ? 'Winner' : `Finished ${ordinal(place)}`}</small>
              </div>
              <span className="stand-color" style={{ background: PALETTE[c].main }} />
              {pay ? <div className="stand-pay"><Icon name="coin" size={18} />+{pay.toLocaleString()}</div> : null}
            </div>
          );
        })}
      </div>

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
