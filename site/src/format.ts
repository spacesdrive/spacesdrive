/** Small text helpers shared by the commands. */
import { link, text, type OutputLine, type Part } from './terminal.ts';

const numberFormat = new Intl.NumberFormat('en-US');

export const formatNumber = (value: number): string => numberFormat.format(value);

/** `key ........ value`, with the value starting at column `width`. */
export function keyValue(key: string, value: Part[] | string, width = 16): OutputLine {
  const dots = '.'.repeat(Math.max(width - key.length - 2, 1));
  const parts = typeof value === 'string' ? [text(value)] : value;
  return [text(key, 'key'), text(` ${dots} `, 'muted'), ...parts];
}

/** `key ........ 1,234` for a count. */
export const countLine = (key: string, value: number, width = 16): OutputLine =>
  keyValue(key, [text(formatNumber(value), 'number')], width);

/** A horizontal bar such as `██████░░░░` for a fraction between 0 and 1. */
export function bar(fraction: number, width = 20): Part[] {
  const filled = Math.round(Math.min(1, Math.max(0, fraction)) * width);
  return [text('█'.repeat(filled), 'accent'), text('░'.repeat(width - filled), 'muted')];
}

export const truncate = (value: string, max: number): string =>
  value.length > max ? `${value.slice(0, max - 1)}…` : value;

export const heading = (title: string): OutputLine => [text(`── ${title} `, 'accent'), text('─'.repeat(24), 'muted')];

/** A profile value that looks like a domain or URL becomes a link; anything else stays text. */
export function linkOrText(value: string): Part {
  if (/^https?:\/\//.test(value)) return link(value, value);
  if (/^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(value)) return link(value, `https://${value}`);
  return text(value);
}

/** "16 Nov 2025" */
export const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

/** Whole years and months between two dates, e.g. "1 year, 3 months". */
export function formatDuration(from: Date, to: Date): string {
  let months = (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth());
  if (to.getUTCDate() < from.getUTCDate()) months--;
  months = Math.max(months, 0);
  const plural = (count: number, unit: string): string => `${count} ${unit}${count === 1 ? '' : 's'}`;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (years === 0) return months === 0 ? 'less than a month' : plural(rest, 'month');
  return rest === 0 ? plural(years, 'year') : `${plural(years, 'year')}, ${plural(rest, 'month')}`;
}
