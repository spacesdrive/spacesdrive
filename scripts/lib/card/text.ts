/**
 * The text column of the card: profile fields and the GitHub stats grid, laid
 * out as lines of coloured segments on a fixed character grid.
 */
import { formatNumber } from '../format.ts';
import type { GitHubStats, ProfileConfig, ProfileField, ProfileSection } from '../types.ts';
import type { Tone } from './theme.ts';

export interface Segment {
  text: string;
  tone: Tone;
}

export type Line = Segment[];

export interface TextOptions {
  /** Width of the column in characters. */
  width: number;
  /** Keys that would push values past this column get their own line. */
  maxValueColumn: number;
  /** Lay the stats out in two columns instead of one. */
  twoColumnStats: boolean;
}

export const segment = (text: string, tone: Tone): Segment => ({ text, tone });
export const lineLength = (line: Line): number => line.reduce((total, part) => total + part.text.length, 0);

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

/** A key on its own line with the value indented underneath, for narrow cards. */
function stackedFieldLines(key: string, value: string, width: number): Line[] {
  const indent = 2;
  return [
    [segment(key, 'key')],
    ...wrap(value, width - indent).map((text): Line => [segment(' '.repeat(indent), 'text'), segment(text, 'text')]),
  ];
}

function divider(title: string, width: number): Line {
  const label = `── ${title} `;
  return [segment(label, 'accent'), segment('─'.repeat(Math.max(width - label.length, 0)), 'muted')];
}

export function resolveValue(field: ProfileField, stats: GitHubStats, now: Date): string {
  return typeof field.value === 'function' ? field.value(stats, now) : field.value;
}

function sectionLines(section: ProfileSection, stats: GitHubStats, now: Date, options: TextOptions): Line[] {
  const fits = (field: ProfileField): boolean => field.key.length + 4 <= options.maxValueColumn;
  const valueColumn = Math.max(0, ...section.fields.filter(fits).map((field) => field.key.length)) + 4;
  const lines: Line[] = section.title ? [divider(section.title, options.width)] : [];
  for (const field of section.fields) {
    const value = resolveValue(field, stats, now);
    lines.push(
      ...(fits(field)
        ? fieldLines(field.key, value, valueColumn, options.width)
        : stackedFieldLines(field.key, value, options.width)),
    );
  }
  return lines;
}

interface StatCell {
  key: string;
  value: Segment[];
}

/** `key .......... value` filling exactly `width` characters, value flush right. */
function statCell(cell: StatCell, width: number): Line {
  const valueLength = lineLength(cell.value);
  const dots = '.'.repeat(Math.max(width - cell.key.length - valueLength - 2, 1));
  return [segment(cell.key, 'key'), segment(` ${dots} `, 'muted'), ...cell.value];
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

/** Every line of the text column: `user@host` heading, profile sections, then stats. */
export function infoLines(profile: ProfileConfig, stats: GitHubStats, now: Date, options: TextOptions): Line[] {
  const heading = `${profile.user}@${profile.host}`;
  const lines: Line[] = [
    [segment(profile.user, 'accent'), segment('@', 'muted'), segment(profile.host, 'accent')],
    [segment('─'.repeat(heading.length), 'muted')],
  ];
  profile.sections.forEach((section, index) => {
    if (index > 0 && !section.title) lines.push([]);
    lines.push(...sectionLines(section, stats, now, options));
  });
  lines.push(...statsLines(stats, options.width, options.twoColumnStats));
  return lines;
}

/** `user@host:~$ ` followed by `command`. */
export function prompt(profile: ProfileConfig, command: Line): Line {
  return [
    segment(`${profile.user}@${profile.host}`, 'key'),
    segment(':', 'muted'),
    segment('~', 'path'),
    segment('$ ', 'muted'),
    ...command,
  ];
}
