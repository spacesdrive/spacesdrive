const numberFormat = new Intl.NumberFormat('en-US');

export function formatNumber(value: number): string {
  return numberFormat.format(value);
}

const plural = (count: number, unit: string): string => `${count} ${unit}${count === 1 ? '' : 's'}`;

/** Whole years and months between two dates, e.g. "1 year, 3 months". */
export function formatDuration(from: Date, to: Date): string {
  let months = (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth());
  if (to.getUTCDate() < from.getUTCDate()) months--;
  months = Math.max(months, 0);

  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (years === 0) return months === 0 ? 'less than a month' : plural(rest, 'month');
  return rest === 0 ? plural(years, 'year') : `${plural(years, 'year')}, ${plural(rest, 'month')}`;
}

/** "Nov 2025" */
export function formatMonthYear(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}
