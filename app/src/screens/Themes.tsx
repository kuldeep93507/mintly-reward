import { BOARD_THEMES, DICE_SKINS } from '@ludo/engine';
import { useApp } from '../state/AppContext';
import { Header } from '../ui/kit';
import { Icon } from '../ui/Icon';
import { play } from '../audio/sfx';
import { Board } from '../game/Board';
import { DiceFace } from '../game/Dice';
import { Pawn } from '../game/Pawn';
import { BOARD_LOOKS, DICE_LOOKS, ThemeContext } from '../game/theme';

export function ThemesScreen() {
  const app = useApp();
  const g = app.globalTheme;
  const boardLocked = !!g && (g.board !== null || g.locked);
  const diceLocked = !!g && (g.dice !== null || g.locked);
  const look = BOARD_LOOKS[app.theme.board];

  return (
    <div className="screen">
      <Header title="Themes" />
      <div className="themes">
        <div className="theme-preview">
          <div className="board-frame" style={{ ['--frame' as string]: look.frame, ['--frame-edge' as string]: look.frameEdge }}>
            <div className="board-rot"><Board /></div>
          </div>
          <div className="theme-preview-side">
            <span className="tp-dice"><DiceFace value={6} /></span>
            <span className="tp-pawns"><Pawn color="red" /><Pawn color="blue" /></span>
          </div>
        </div>

        <div className="field-label">Board</div>
        {boardLocked && <p className="fine"><Icon name="lock" size={14} /> The board theme is set for everyone right now.</p>}
        <div className="theme-grid">
          {BOARD_THEMES.map((t) => (
            <ThemeContext.Provider key={t} value={{ board: t, dice: app.theme.dice }}>
              <button className={`theme-opt ${app.theme.board === t ? 'on' : ''}`} disabled={boardLocked}
                onClick={() => { play('pop'); app.setLocalTheme({ board: t }); }} data-testid={`board-${t}`}>
                <span className="to-swatch" style={{ background: BOARD_LOOKS[t].frame }}>
                  <span className="to-inner" style={{ background: BOARD_LOOKS[t].bg, borderColor: BOARD_LOOKS[t].cellStroke }}>
                    <Pawn color="green" />
                  </span>
                </span>
                <span className="to-label">{BOARD_LOOKS[t].label}</span>
                {app.theme.board === t && <span className="av-check"><Icon name="check" size={14} /></span>}
              </button>
            </ThemeContext.Provider>
          ))}
        </div>

        <div className="field-label">Dice</div>
        {diceLocked && <p className="fine"><Icon name="lock" size={14} /> The dice skin is set for everyone right now.</p>}
        <div className="theme-grid">
          {DICE_SKINS.map((d) => (
            <ThemeContext.Provider key={d} value={{ board: app.theme.board, dice: d }}>
              <button className={`theme-opt ${app.theme.dice === d ? 'on' : ''}`} disabled={diceLocked}
                onClick={() => { play('pop'); app.setLocalTheme({ dice: d }); }} data-testid={`dice-${d}`}>
                <span className="to-dice"><DiceFace value={5} /></span>
                <span className="to-label">{DICE_LOOKS[d].label}</span>
                {app.theme.dice === d && <span className="av-check"><Icon name="check" size={14} /></span>}
              </button>
            </ThemeContext.Provider>
          ))}
        </div>
      </div>
    </div>
  );
}
