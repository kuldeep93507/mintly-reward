import { createContext, useContext } from 'react';
import type { BoardTheme, DiceSkin } from '@ludo/engine';

export interface BoardLook {
  label: string;
  /** Board background behind the squares. */
  bg: string;
  cell: string;
  cellStroke: string;
  star: string;
  starStroke: string;
  /** Inner panel of each yard. */
  yardInner: string;
  /** CSS background of the wooden/plastic frame around the board. */
  frame: string;
  frameEdge: string;
  /** Outline colour of the pawns. */
  pawnStroke: string;
}

export const BOARD_LOOKS: Record<BoardTheme, BoardLook> = {
  classic: {
    label: 'Classic', bg: '#FFFFFF', cell: '#FFFFFF', cellStroke: '#D9D6EC', star: '#C9C3E6', starStroke: '#9E97C9', yardInner: '#FFFFFF',
    frame: 'linear-gradient(160deg, #ffd978, #e59a1f 50%, #b8690c)', frameEdge: '#7a4200', pawnStroke: '#FFFFFF',
  },
  night: {
    label: 'Night', bg: '#15103A', cell: '#241D5C', cellStroke: '#4A3F96', star: '#6B5FC7', starStroke: '#A49BF0', yardInner: '#1B154A',
    frame: 'linear-gradient(160deg, #7b6cff, #3a2aa8 50%, #150d52)', frameEdge: '#0a0630', pawnStroke: '#E8E4FF',
  },
  wood: {
    label: 'Wood', bg: '#E2BD86', cell: '#F3DCB5', cellStroke: '#B98A52', star: '#C9975E', starStroke: '#8A5A26', yardInner: '#F6E3C2',
    frame: 'repeating-linear-gradient(100deg, #8a5426 0 14px, #7a4a1e 14px 22px, #93602f 22px 34px)', frameEdge: '#3f220a', pawnStroke: '#FFF4E0',
  },
  candy: {
    label: 'Candy', bg: '#FFE6F4', cell: '#FFF7FC', cellStroke: '#F7B6D8', star: '#FFB3DD', starStroke: '#E0679F', yardInner: '#FFF0F8',
    frame: 'linear-gradient(160deg, #ffb3dd, #ff6fb5 50%, #c93b85)', frameEdge: '#8a1f5a', pawnStroke: '#FFFFFF',
  },
};

export interface DiceLook { label: string; body: string; shade: string; pip: string; one: string; glow?: string }

export const DICE_LOOKS: Record<DiceSkin, DiceLook> = {
  white: { label: 'White', body: '#FFFFFF', shade: '#A9A2CF', pip: '#2A2250', one: '#E53935' },
  gold: { label: 'Gold', body: '#FFD54A', shade: '#B07800', pip: '#5A3A00', one: '#8A2A00' },
  red: { label: 'Red', body: '#E53935', shade: '#7E1414', pip: '#FFFFFF', one: '#FFFFFF' },
  neon: { label: 'Neon', body: '#120C38', shade: '#00E5FF', pip: '#39FF14', one: '#FF2BD6', glow: '#00E5FF' },
};

export interface ThemeChoice { board: BoardTheme; dice: DiceSkin }
export const DEFAULT_THEME: ThemeChoice = { board: 'classic', dice: 'white' };

export const ThemeContext = createContext<ThemeChoice>(DEFAULT_THEME);
export const useTheme = () => useContext(ThemeContext);
export const useBoardLook = () => BOARD_LOOKS[useTheme().board] ?? BOARD_LOOKS.classic;
export const useDiceLook = () => DICE_LOOKS[useTheme().dice] ?? DICE_LOOKS.white;
