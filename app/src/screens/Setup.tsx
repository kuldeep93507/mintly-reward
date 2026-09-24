import { useState } from 'react';
import { ALL_COLORS, NAME_MAX, type BotLevel, type Color } from '@ludo/engine';
import { useApp } from '../state/AppContext';
import { Btn, Header, Segmented, COLOR_NAME } from '../ui/kit';
import { Pawn } from '../game/Pawn';
import { startBotsGame, startPassGame, colorsFrom } from '../game/startLocal';
import { play } from '../audio/sfx';
import type { BotsSetup, PassSetup, SnakesSetup } from '../state/types';
import { startSnakesGame } from '../snakes/SnakesController';

export function BotsSetupScreen() {
  const app = useApp();
  const [players, setPlayers] = useState<2 | 3 | 4>(4);
  const [color, setColor] = useState<Color>('blue');
  const [level, setLevel] = useState<BotLevel>('normal');
  const startGame = () => {
    const setup: BotsSetup = { kind: 'bots', players, color, level };
    app.replace({ id: 'game', controller: startBotsGame(setup, app.identity, app.profile?.level ?? null), again: setup });
  };
  const seats = colorsFrom(color, players);
  return (
    <div className="screen">
      <Header title="Vs Computer" />
      <div className="setup">
        <div className="field-label">Players</div>
        <Segmented options={[{ value: 2, label: '2' }, { value: 3, label: '3' }, { value: 4, label: '4' }]} value={players} onChange={setPlayers} />
        <div className="field-label">Your colour</div>
        <div className="color-pick">
          {ALL_COLORS.map((c) => (
            <button key={c} className={`color-opt ${c} ${color === c ? 'on' : ''}`} onClick={() => { play('pop'); setColor(c); }} aria-label={COLOR_NAME[c]}>
              <Pawn color={c} />
              <span>{COLOR_NAME[c]}</span>
            </button>
          ))}
        </div>
        <div className="field-label">Difficulty</div>
        <Segmented options={[{ value: 'easy', label: 'Easy' }, { value: 'normal', label: 'Normal' }, { value: 'hard', label: 'Hard' }]} value={level} onChange={setLevel} />
        <div className="setup-preview">
          {seats.map((c, i) => (
            <span key={c} className="sp-seat"><Pawn color={c} /><small>{i === 0 ? 'You' : 'CPU'}</small></span>
          ))}
        </div>
        <Btn variant="green" size="lg" onClick={startGame} data-testid="start">Start Game</Btn>
      </div>
    </div>
  );
}

export function PassSetupScreen() {
  const app = useApp();
  const [n, setN] = useState<2 | 3 | 4>(2);
  const [names, setNames] = useState(['Player 1', 'Player 2', 'Player 3', 'Player 4']);
  const colors = colorsFrom('red', n);
  const startGame = () => {
    const setup: PassSetup = { kind: 'pass', names: names.slice(0, n).map((x, i) => x.trim() || `Player ${i + 1}`) };
    app.replace({ id: 'game', controller: startPassGame(setup), again: setup });
  };
  return (
    <div className="screen">
      <Header title="Pass & Play" />
      <div className="setup">
        <div className="field-label">Players</div>
        <Segmented options={[{ value: 2, label: '2' }, { value: 3, label: '3' }, { value: 4, label: '4' }]} value={n} onChange={setN} />
        <div className="field-label">Names</div>
        <div className="name-list">
          {colors.map((c, i) => (
            <label key={c} className={`name-row ${c}`}>
              <span className="nr-pawn"><Pawn color={c} /></span>
              <input value={names[i]} maxLength={NAME_MAX} onChange={(e) => setNames((a) => a.map((x, k) => (k === i ? e.target.value : x)))} />
            </label>
          ))}
        </div>
        <Btn variant="green" size="lg" onClick={startGame}>Start Game</Btn>
      </div>
    </div>
  );
}

export function SnakesSetupScreen() {
  const app = useApp();
  const [mode, setMode] = useState<'bots' | 'pass'>('bots');
  const [n, setN] = useState<2 | 3 | 4>(2);
  const [names, setNames] = useState(['Player 1', 'Player 2', 'Player 3', 'Player 4']);
  const colors = colorsFrom('red', n);
  const startGame = () => {
    const setup: SnakesSetup = { kind: 'snakes', mode, names: names.slice(0, n).map((x, i) => x.trim() || `Player ${i + 1}`) };
    app.replace({ id: 'snakes', controller: startSnakesGame(setup, app.identity), again: setup });
  };
  return (
    <div className="screen">
      <Header title="Snakes & Ladders" />
      <div className="setup">
        <div className="field-label">Mode</div>
        <Segmented options={[{ value: 'bots', label: 'Vs Computer' }, { value: 'pass', label: 'Pass & Play' }]} value={mode} onChange={setMode} />
        <div className="field-label">Players</div>
        <Segmented options={[{ value: 2, label: '2' }, { value: 3, label: '3' }, { value: 4, label: '4' }]} value={n} onChange={setN} />
        {mode === 'pass' ? (
          <>
            <div className="field-label">Names</div>
            <div className="name-list">
              {colors.map((c, i) => (
                <label key={c} className={`name-row ${c}`}>
                  <span className="nr-pawn"><Pawn color={c} /></span>
                  <input value={names[i]} maxLength={NAME_MAX} onChange={(e) => setNames((a) => a.map((x, k) => (k === i ? e.target.value : x)))} />
                </label>
              ))}
            </div>
          </>
        ) : (
          <div className="setup-preview">
            {colors.map((c, i) => <span key={c} className="sp-seat"><Pawn color={c} /><small>{i === 0 ? 'You' : 'CPU'}</small></span>)}
          </div>
        )}
        <p className="fine">Climb the ladders, dodge the snakes. Land exactly on 100 to win. A six rolls again.</p>
        <Btn variant="green" size="lg" onClick={startGame} data-testid="start">Start Game</Btn>
      </div>
    </div>
  );
}
