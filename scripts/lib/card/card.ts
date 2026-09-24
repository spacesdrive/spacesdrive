/**
 * Renders the terminal-style profile card as a self-contained SVG: a window
 * frame, the ASCII portrait and the text column.
 *
 * GitHub serves README images with a strict CSP, which rules out web fonts and
 * scripts; inline CSS is allowed.
 */
import type { GitHubStats, ProfileConfig } from '../types.ts';
import { portraitStyle, renderPortrait } from './portrait.ts';
import { baseTextStyle, baseline, escapeXml, px, renderLine, toneStyle } from './svg.ts';
import { infoLines, prompt, segment } from './text.ts';
import {
  CHAR_WIDTH,
  FONT_SIZE,
  LINE_HEIGHT,
  PALETTES,
  PORTRAIT_CHAR_WIDTH,
  PORTRAIT_LINE_HEIGHT,
  type Theme,
} from './theme.ts';

export type Layout = 'wide' | 'narrow';

const PADDING = 24;
const TITLE_BAR_HEIGHT = 34;
/** Horizontal space between portrait and text in the wide layout, in pixels. */
const PORTRAIT_GAP = 36;

const LAYOUTS: Record<Layout, { infoColumns: number; stacked: boolean; maxValueColumn: number }> = {
  wide: { infoColumns: 58, stacked: false, maxValueColumn: Infinity },
  narrow: { infoColumns: 44, stacked: true, maxValueColumn: 16 },
};

export interface CardInput {
  profile: ProfileConfig;
  stats: GitHubStats;
  /** Portrait brightness grid, one string per row. */
  portrait: readonly string[];
  theme: Theme;
  layout: Layout;
  now: Date;
  /** Accessible description of the image. */
  description: string;
}

export function renderCard(input: CardInput): string {
  const { profile, stats, portrait, theme, layout, now } = input;
  const palette = PALETTES[theme];
  const { infoColumns, stacked, maxValueColumn } = LAYOUTS[layout];
  const info = infoLines(profile, stats, now, { width: infoColumns, maxValueColumn, twoColumnStats: !stacked });

  // Size of the two blocks, then the card around them.
  const portraitWidth = Math.max(...portrait.map((row) => row.length)) * PORTRAIT_CHAR_WIDTH;
  const portraitHeight = portrait.length * PORTRAIT_LINE_HEIGHT;
  const infoWidth = infoColumns * CHAR_WIDTH;
  const infoHeight = info.length * LINE_HEIGHT;
  const width = PADDING * 2 + (stacked ? Math.max(infoWidth, portraitWidth) : portraitWidth + PORTRAIT_GAP + infoWidth);

  // A prompt line and a blank line sit above the body, a blank line and a prompt below it.
  const bodyTop = TITLE_BAR_HEIGHT + PADDING - 4 + 2 * LINE_HEIGHT;
  const bodyHeight = stacked ? portraitHeight + LINE_HEIGHT + infoHeight : Math.max(portraitHeight, infoHeight);
  const closingTop = bodyTop + bodyHeight + LINE_HEIGHT;
  const height = closingTop + LINE_HEIGHT + PADDING;

  // Side by side and vertically centred (wide), or portrait above text (narrow).
  const portraitX = stacked ? (width - portraitWidth) / 2 : PADDING;
  const portraitTop = stacked ? bodyTop : bodyTop + (bodyHeight - portraitHeight) / 2;
  const infoX = stacked ? PADDING : PADDING + portraitWidth + PORTRAIT_GAP;
  const infoTop = stacked ? bodyTop + portraitHeight + LINE_HEIGHT : bodyTop + (bodyHeight - infoHeight) / 2;

  const textBaseline = (top: number): number => baseline(top, FONT_SIZE, LINE_HEIGHT);
  const command = `fetch --user ${profile.login}`;
  const body = [
    renderLine(prompt(profile, [segment(command, 'text')]), PADDING, textBaseline(bodyTop - 2 * LINE_HEIGHT)),
    ...info.map((line, i) => renderLine(line, infoX, textBaseline(infoTop + i * LINE_HEIGHT))),
    renderLine(prompt(profile, [segment('█', 'cursor')]), PADDING, textBaseline(closingTop)),
  ];

  const lights = palette.lights
    .map((color, i) => `<circle cx="${20 + i * 20}" cy="${TITLE_BAR_HEIGHT / 2}" r="6" fill="${color}"/>`)
    .join('');

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" width="${px(width)}" height="${px(height)}" viewBox="0 0 ${px(width)} ${px(height)}" role="img" aria-labelledby="card-title">`,
    `<title id="card-title">${escapeXml(input.description)}</title>`,
    `<style>${baseTextStyle()}${portraitStyle()}${toneStyle(palette)}</style>`,
    '<defs>',
    `<clipPath id="frame"><rect width="${px(width)}" height="${px(height)}" rx="10"/></clipPath>`,
    `<linearGradient id="portrait" gradientUnits="userSpaceOnUse" x1="${px(portraitX)}" y1="${px(portraitTop)}" x2="${px(portraitX + portraitWidth)}" y2="${px(portraitTop + portraitHeight)}">`,
    `<stop offset="0" stop-color="${palette.portrait[0]}"/><stop offset="1" stop-color="${palette.portrait[1]}"/>`,
    '</linearGradient>',
    '</defs>',
    '<g clip-path="url(#frame)">',
    `<rect width="${px(width)}" height="${px(height)}" fill="${palette.background}"/>`,
    `<rect width="${px(width)}" height="${TITLE_BAR_HEIGHT}" fill="${palette.titleBar}"/>`,
    `<rect y="${TITLE_BAR_HEIGHT}" width="${px(width)}" height="1" fill="${palette.border}"/>`,
    '</g>',
    `<rect x="0.5" y="0.5" width="${px(width - 1)}" height="${px(height - 1)}" rx="9.5" fill="none" stroke="${palette.border}"/>`,
    lights,
    `<text class="title m" x="${px(width / 2)}" y="${TITLE_BAR_HEIGHT / 2 + 4}" text-anchor="middle">${escapeXml(`${profile.user}@${profile.host}: ~`)}</text>`,
    `<g class="portrait" fill="url(#portrait)">`,
    ...renderPortrait(portrait, theme, portraitX, portraitTop),
    '</g>',
    body.filter(Boolean).join(''),
    '</svg>',
    '',
  ].join('\n');
}
