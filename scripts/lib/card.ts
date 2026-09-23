/**
 * Renders the terminal-style profile card as a self-contained SVG.
 *
 * Everything is laid out on a character grid, so it only relies on the viewer
 * having *some* monospace font. GitHub serves README images with a strict CSP,
 * which rules out web fonts and scripts; inline CSS is allowed.
 */
import { formatNumber } from './format.ts';
import type { GitHubStats, ProfileConfig, ProfileField, ProfileSection } from './types.ts';

/** Monospace advance width as a fraction of the font size. */
const ADVANCE = 0.6;

const FONT_SIZE = 14;
const CHAR_WIDTH = FONT_SIZE * ADVANCE;
const LINE_HEIGHT = 17;

/** The portrait uses a smaller font than the text so it gets more detail in the same space. */
const PORTRAIT_FONT_SIZE = 12;
const PORTRAIT_CHAR_WIDTH = PORTRAIT_FONT_SIZE * ADVANCE;
const PORTRAIT_LINE_HEIGHT = 14.4;
/** Width-to-height ratio of one portrait cell, used by the generator to avoid distortion. */
export const PORTRAIT_CELL_ASPECT = PORTRAIT_CHAR_WIDTH / PORTRAIT_LINE_HEIGHT;

const FONT_STACK =
  "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Cascadia Mono', 'DejaVu Sans Mono', 'Liberation Mono', monospace";
const PADDING = 24;
const TITLE_BAR_HEIGHT = 34;
/** Horizontal space between portrait and text in the wide layout, in pixels. */
const PORTRAIT_GAP = 36;

export type Theme = 'dark' | 'light';
export type Layout = 'wide' | 'narrow';

type Tone = 'text' | 'key' | 'muted' | 'accent' | 'number' | 'added' | 'deleted' | 'path' | 'cursor';

interface Segment {
  text: string;
  tone: Tone;
}

type Line = Segment[];

interface Palette {
  background: string;
  border: string;
  titleBar: string;
  lights: readonly [string, string, string];
  portrait: readonly [string, string];
  tones: Record<Tone, string>;
}

const PALETTES: Record<Theme, Palette> = {
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

interface LayoutSpec {
  /** Width of the text column in characters. */
  infoColumns: number;
  /** Portrait above the text instead of beside it. */
  stacked: boolean;
  /** Keys that would push values past this column get their own line. */
  maxValueColumn: number;
}

const LAYOUTS: Record<Layout, LayoutSpec> = {
  wide: { infoColumns: 58, stacked: false, maxValueColumn: Infinity },
  narrow: { infoColumns: 44, stacked: true, maxValueColumn: 16 },
};

export interface CardInput {
  profile: ProfileConfig;
  stats: GitHubStats;
  /** ASCII portrait, one string per row. */
  portrait: readonly string[];
  theme: Theme;
  layout: Layout;
  now: Date;
  /** Accessible description of the image. */
  description: string;
}

const segment = (text: string, tone: Tone): Segment => ({ text, tone });
const lineLength = (line: Line): number => line.reduce((total, part) => total + part.text.length, 0);

/**
 * Greedy word wrap. A parenthesised group such as "(Pinecone + Groq)" is kept
 * together; anything longer than the width is split.
 */
function wrap(text: string, width: number): string[] {
  const lines: string[] = [];
  let current = '';
  for (const word of text.match(/\S*\([^)]*\)\S*|\S+/g) ?? []) {
    let rest = word;
    while (rest.length > width) {
      if (current) lines.push(current);
      lines.push(rest.slice(0, width));
      current = '';
      rest = rest.slice(width);
    }
    if (!current) current = rest;
    else if (current.length + 1 + rest.length <= width) current += ` ${rest}`;
    else {
      lines.push(current);
      current = rest;
    }
  }
  if (current || lines.length === 0) lines.push(current);
  return lines;
}

/** `key ....... value`, with the value wrapped and aligned under its first line. */
function fieldLines(key: string, value: string, valueColumn: number, width: number): Line[] {
  const dots = '.'.repeat(Math.max(valueColumn - key.length - 2, 1));
  const [first = '', ...rest] = wrap(value, width - valueColumn);
  return [
    [segment(key, 'key'), segment(` ${dots} `, 'muted'), segment(first, 'text')],
    ...rest.map((text): Line => [segment(' '.repeat(valueColumn), 'text'), segment(text, 'text')]),
  ];
}

/** `key .......... value` filling exactly `width` characters, value flush right. */
function statCell(cell: StatCell, width: number): Line {
  const valueLength = lineLength(cell.value);
  const dots = '.'.repeat(Math.max(width - cell.key.length - valueLength - 2, 1));
  return [segment(cell.key, 'key'), segment(` ${dots} `, 'muted'), ...cell.value];
}

function divider(title: string, width: number): Line {
  const label = `── ${title} `;
  return [segment(label, 'accent'), segment('─'.repeat(Math.max(width - label.length, 0)), 'muted')];
}

function resolveValue(field: ProfileField, stats: GitHubStats, now: Date): string {
  return typeof field.value === 'function' ? field.value(stats, now) : field.value;
}

/** A key on its own line with the value indented underneath, for narrow cards. */
function stackedFieldLines(key: string, value: string, width: number): Line[] {
  const indent = 2;
  return [
    [segment(key, 'key')],
    ...wrap(value, width - indent).map((text): Line => [segment(' '.repeat(indent), 'text'), segment(text, 'text')]),
  ];
}

function sectionLines(section: ProfileSection, stats: GitHubStats, now: Date, width: number, spec: LayoutSpec): Line[] {
  const fits = (field: ProfileField): boolean => field.key.length + 4 <= spec.maxValueColumn;
  const valueColumn = Math.max(0, ...section.fields.filter(fits).map((field) => field.key.length)) + 4;
  const lines: Line[] = section.title ? [divider(section.title, width)] : [];
  for (const field of section.fields) {
    const value = resolveValue(field, stats, now);
    lines.push(...(fits(field) ? fieldLines(field.key, value, valueColumn, width) : stackedFieldLines(field.key, value, width)));
  }
  return lines;
}

interface StatCell {
  key: string;
  value: Segment[];
}

const count = (value: number): Segment[] => [segment(formatNumber(value), 'number')];

function statColumns(stats: GitHubStats): { left: StatCell[]; right: StatCell[]; full: StatCell[] } {
  return {
    left: [
      { key: 'Repos', value: count(stats.publicRepos) },
      { key: 'Contributed To', value: count(stats.contributedRepos) },
      { key: 'Commits', value: count(stats.commits) },
      { key: 'Pull Requests', value: count(stats.pullRequests) },
      { key: 'Merged PRs', value: count(stats.mergedPullRequests) },
    ],
    right: [
      { key: 'Stars', value: count(stats.stars) },
      { key: 'Forks', value: count(stats.forks) },
      { key: 'Followers', value: count(stats.followers) },
      { key: 'Following', value: count(stats.following) },
      { key: 'Issues', value: count(stats.issues) },
    ],
    full: [
      {
        key: 'Contributions',
        value: [...count(stats.contributionsLastYear), segment(' in the past year', 'text')],
      },
      {
        key: 'Lines of Code',
        value: [
          ...count(stats.linesAdded - stats.linesDeleted),
          segment(' (', 'muted'),
          segment(`+${formatNumber(stats.linesAdded)}`, 'added'),
          segment(' / ', 'muted'),
          segment(`-${formatNumber(stats.linesDeleted)}`, 'deleted'),
          segment(')', 'muted'),
        ],
      },
    ],
  };
}

function statsLines(stats: GitHubStats, width: number, twoColumns: boolean): Line[] {
  const { left, right, full } = statColumns(stats);
  const lines: Line[] = [divider('GitHub Stats', width)];

  if (twoColumns) {
    // left cell | separator " │ " | right cell, summing to exactly `width`.
    const separator = ' │ ';
    const leftWidth = Math.floor((width - separator.length) / 2);
    const rightWidth = width - separator.length - leftWidth;
    const rows = Math.max(left.length, right.length);
    for (let i = 0; i < rows; i++) {
      const leftCell = left[i];
      const rightCell = right[i];
      const line: Line = leftCell ? statCell(leftCell, leftWidth) : [segment(' '.repeat(leftWidth), 'text')];
      if (rightCell) line.push(segment(separator, 'muted'), ...statCell(rightCell, rightWidth));
      lines.push(line);
    }
  } else {
    for (const cell of [...left, ...right]) lines.push(statCell(cell, width));
  }

  for (const cell of full) lines.push(statCell(cell, width));
  return lines;
}

function infoLines(input: CardInput, spec: LayoutSpec): Line[] {
  const { profile, stats, now } = input;
  const width = spec.infoColumns;
  const heading = `${profile.user}@${profile.host}`;
  const lines: Line[] = [
    [segment(profile.user, 'accent'), segment('@', 'muted'), segment(profile.host, 'accent')],
    [segment('─'.repeat(heading.length), 'muted')],
  ];
  profile.sections.forEach((section, index) => {
    if (index > 0 && !section.title) lines.push([]);
    lines.push(...sectionLines(section, stats, now, width, spec));
  });
  lines.push(...statsLines(stats, width, !spec.stacked));
  return lines;
}

function prompt(profile: ProfileConfig, command: Line): Line {
  return [
    segment(`${profile.user}@${profile.host}`, 'key'),
    segment(':', 'muted'),
    segment('~', 'path'),
    segment('$ ', 'muted'),
    ...command,
  ];
}

const escapeXml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const px = (value: number): string => String(Math.round(value * 100) / 100);

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
function gridText(content: string, characters: number, x: number, y: number, charWidth: number): string {
  if (characters === 0) return '';
  const length = px(characters * charWidth);
  return `<text x="${px(x)}" y="${px(y)}" textLength="${length}" lengthAdjust="spacing">${content}</text>`;
}

function renderLine(line: Line, x: number, y: number): string {
  const spans = line
    .filter((part) => part.text.length > 0)
    .map((part) => `<tspan class="${TONE_CLASS[part.tone]}">${escapeXml(part.text)}</tspan>`)
    .join('');
  return gridText(spans, lineLength(line), x, y, CHAR_WIDTH);
}

function renderStyle(palette: Palette): string {
  const tones = (Object.keys(TONE_CLASS) as Tone[])
    .map((tone) => `.${TONE_CLASS[tone]}{fill:${palette.tones[tone]}}`)
    .join('');
  return [
    `text{font-family:${FONT_STACK};font-size:${FONT_SIZE}px;white-space:pre}`,
    `.portrait text{font-size:${PORTRAIT_FONT_SIZE}px}`,
    '.title{font-size:12px}',
    tones,
    '.c{animation:blink 1.1s steps(1) infinite}',
    '@keyframes blink{50%{fill-opacity:0}}',
    '@media (prefers-reduced-motion:reduce){.c{animation:none}}',
  ].join('');
}

export function renderCard(input: CardInput): string {
  const { profile, portrait, theme, layout } = input;
  const palette = PALETTES[theme];
  const spec = LAYOUTS[layout];
  const { stacked } = spec;
  const info = infoLines(input, spec);

  const portraitWidth = Math.max(...portrait.map((row) => row.length)) * PORTRAIT_CHAR_WIDTH;
  const portraitHeight = portrait.length * PORTRAIT_LINE_HEIGHT;
  const infoWidth = spec.infoColumns * CHAR_WIDTH;
  const infoHeight = info.length * LINE_HEIGHT;
  const width = PADDING * 2 + (stacked ? Math.max(infoWidth, portraitWidth) : portraitWidth + PORTRAIT_GAP + infoWidth);

  // A prompt line and a blank line sit above the body, a blank line and a prompt below it.
  const bodyTop = TITLE_BAR_HEIGHT + PADDING - 4 + 2 * LINE_HEIGHT;
  const bodyHeight = stacked ? portraitHeight + LINE_HEIGHT + infoHeight : Math.max(portraitHeight, infoHeight);
  const closingTop = bodyTop + bodyHeight + LINE_HEIGHT;
  const height = closingTop + LINE_HEIGHT + PADDING;

  const portraitX = stacked ? (width - portraitWidth) / 2 : PADDING;
  const portraitTop = stacked ? bodyTop : bodyTop + (bodyHeight - portraitHeight) / 2;
  const infoX = stacked ? PADDING : PADDING + portraitWidth + PORTRAIT_GAP;
  const infoTop = stacked ? bodyTop + portraitHeight + LINE_HEIGHT : bodyTop + (bodyHeight - infoHeight) / 2;

  /** Baseline that vertically centres a font inside a line box starting at `top`. */
  const baseline = (top: number, fontSize: number, lineHeight: number): number =>
    top + (lineHeight - fontSize) / 2 + fontSize * 0.8;
  const textBaseline = (top: number): number => baseline(top, FONT_SIZE, LINE_HEIGHT);

  const command = `fetch --user ${profile.login}`;
  const body = [
    renderLine(prompt(profile, [segment(command, 'text')]), PADDING, textBaseline(bodyTop - 2 * LINE_HEIGHT)),
    ...info.map((line, i) => renderLine(line, infoX, textBaseline(infoTop + i * LINE_HEIGHT))),
    renderLine(prompt(profile, [segment('█', 'cursor')]), PADDING, textBaseline(closingTop)),
  ];
  const portraitLines = portrait.map((row, i) => {
    const y = baseline(portraitTop + i * PORTRAIT_LINE_HEIGHT, PORTRAIT_FONT_SIZE, PORTRAIT_LINE_HEIGHT);
    return gridText(escapeXml(row), row.length, portraitX, y, PORTRAIT_CHAR_WIDTH);
  });

  const lights = palette.lights
    .map((color, i) => `<circle cx="${20 + i * 20}" cy="${TITLE_BAR_HEIGHT / 2}" r="6" fill="${color}"/>`)
    .join('');

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" width="${px(width)}" height="${px(height)}" viewBox="0 0 ${px(width)} ${px(height)}" role="img" aria-labelledby="card-title">`,
    `<title id="card-title">${escapeXml(input.description)}</title>`,
    `<style>${renderStyle(palette)}</style>`,
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
    `<g class="portrait" fill="url(#portrait)">${portraitLines.join('')}</g>`,
    body.filter(Boolean).join(''),
    '</svg>',
    '',
  ].join('\n');
}
