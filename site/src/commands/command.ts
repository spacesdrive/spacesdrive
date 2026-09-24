import type { SiteData } from '../data.ts';
import type { OutputLine } from '../terminal.ts';

export interface Command {
  /** Typed with or without a leading slash: `/stats` or `stats`. */
  name: string;
  /** Argument hint shown by /help, e.g. `<name>`. */
  args?: string;
  /** One line for /help. */
  summary: string;
  /** Wipe the screen before printing (used by /clear). */
  clearsScreen?: boolean;
  run(args: string[], data: SiteData): OutputLine[];
}

/** The value of a profile field by key, e.g. `field(data, 'Host')`. */
export function field(data: SiteData, key: string): string | undefined {
  for (const section of data.profile.sections) {
    const match = section.fields.find((item) => item.key === key);
    if (match) return match.value;
  }
  return undefined;
}
