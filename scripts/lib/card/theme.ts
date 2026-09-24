/** Font metrics and colours shared by every part of the card. */

/** Monospace advance width as a fraction of the font size. */
const ADVANCE = 0.6;

export const FONT_SIZE = 14;
export const CHAR_WIDTH = FONT_SIZE * ADVANCE;
export const LINE_HEIGHT = 17;

/** The portrait uses a smaller font than the text so it gets more detail in the same space. */
export const PORTRAIT_FONT_SIZE = 11;
export const PORTRAIT_CHAR_WIDTH = PORTRAIT_FONT_SIZE * ADVANCE;
export const PORTRAIT_LINE_HEIGHT = 13.2;
/** Width-to-height ratio of one portrait cell, used by the avatar generator to avoid distortion. */
export const PORTRAIT_CELL_ASPECT = PORTRAIT_CHAR_WIDTH / PORTRAIT_LINE_HEIGHT;

export const FONT_STACK =
  "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Cascadia Mono', 'DejaVu Sans Mono', 'Liberation Mono', monospace";

export type Theme = 'dark' | 'light';

/** Semantic colour of a run of text. */
export type Tone = 'text' | 'key' | 'muted' | 'accent' | 'number' | 'added' | 'deleted' | 'path' | 'cursor';

export interface Palette {
  background: string;
  border: string;
  titleBar: string;
  lights: readonly [string, string, string];
  /** Gradient across the portrait, top-left to bottom-right. */
  portrait: readonly [string, string];
  tones: Record<Tone, string>;
}

export const PALETTES: Record<Theme, Palette> = {
  dark: {
    background: '#0b0f15',
    border: '#252d38',
    titleBar: '#121821',
    lights: ['#f2575b', '#f4b63f', '#3ecf6b'],
    portrait: ['#5eead4', '#b69cff'],
    tones: {
      text: '#d4dae1',
      key: '#5eead4',
      muted: '#4b5563',
      accent: '#b69cff',
      number: '#fbc760',
      added: '#6ee787',
      deleted: '#ff7b72',
      path: '#79c0ff',
      cursor: '#5eead4',
    },
  },
  light: {
    background: '#fbfcfd',
    border: '#d0d7de',
    titleBar: '#eef1f4',
    lights: ['#ec5f5f', '#e8a83a', '#34b35a'],
    portrait: ['#0f766e', '#6d3fd0'],
    tones: {
      text: '#1f2328',
      key: '#0f766e',
      muted: '#9aa4af',
      accent: '#6d3fd0',
      number: '#9a6700',
      added: '#1a7f37',
      deleted: '#cf222e',
      path: '#0969da',
      cursor: '#0f766e',
    },
  },
};
