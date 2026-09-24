/** Small SVG building blocks: escaping, grid-aligned text and the stylesheet. */
import { CHAR_WIDTH, FONT_SIZE, FONT_STACK, type Palette, type Tone } from './theme.ts';
import { lineLength, type Line } from './text.ts';

export const escapeXml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Rounds to two decimals so the SVG stays short and diff-friendly. */
export const px = (value: number): string => String(Math.round(value * 100) / 100);

const TONE_CLASS: Record<Tone, string> = {
  text: 't',
  key: 'k',
  muted: 'm',
  accent: 'a',
  number: 'n',
  added: 'p',
  deleted: 'd',
  path: 'h',
  cursor: 'c',
};

/**
 * A `<text>` pinned to the character grid. Viewers fall back to whatever
 * monospace font they have (Consolas is narrower than Menlo or DejaVu Sans Mono),
 * so `textLength` stretches or squeezes the spacing until every glyph occupies
 * exactly one cell, keeping columns aligned on every platform.
 */
export function gridText(content: string, characters: number, x: number, y: number, charWidth: number): string {
  if (characters === 0) return '';
  const length = px(characters * charWidth);
  return `<text x="${px(x)}" y="${px(y)}" textLength="${length}" lengthAdjust="spacing">${content}</text>`;
}

/** One line of coloured text segments. */
export function renderLine(line: Line, x: number, y: number): string {
  const spans = line
    .filter((part) => part.text.length > 0)
    .map((part) => `<tspan class="${TONE_CLASS[part.tone]}">${escapeXml(part.text)}</tspan>`)
    .join('');
  return gridText(spans, lineLength(line), x, y, CHAR_WIDTH);
}

/** Baseline that vertically centres a font inside a line box starting at `top`. */
export const baseline = (top: number, fontSize: number, lineHeight: number): number =>
  top + (lineHeight - fontSize) / 2 + fontSize * 0.8;

export const baseTextStyle = (): string => `text{font-family:${FONT_STACK};font-size:${FONT_SIZE}px;white-space:pre}`;

/** Tone colours, the title bar label and the blinking cursor. */
export function toneStyle(palette: Palette): string {
  const tones = (Object.keys(TONE_CLASS) as Tone[])
    .map((tone) => `.${TONE_CLASS[tone]}{fill:${palette.tones[tone]}}`)
    .join('');
  return [
    '.title{font-size:12px}',
    tones,
    '.c{animation:blink 1.1s steps(1) infinite}',
    '@keyframes blink{50%{fill-opacity:0}}',
    '@media (prefers-reduced-motion:reduce){.c{animation:none}}',
  ].join('');
}
