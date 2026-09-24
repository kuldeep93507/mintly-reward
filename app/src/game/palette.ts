import type { Color } from '@ludo/engine';

export const PALETTE: Record<Color, { main: string; light: string; dark: string; pale: string }> = {
  red: { main: '#E53935', light: '#FF6F60', dark: '#A31515', pale: '#FFD9D6' },
  green: { main: '#2E9E48', light: '#5CCB72', dark: '#1B6B2E', pale: '#D5F2DA' },
  yellow: { main: '#F9C21A', light: '#FFDD63', dark: '#C08E00', pale: '#FFF2C4' },
  blue: { main: '#1E7FE0', light: '#5CAAF5', dark: '#0F4F99', pale: '#D3E7FB' },
};
