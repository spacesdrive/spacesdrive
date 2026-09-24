/** Builds the JSON snapshot the web terminal reads (site/data/profile.json). */
import type { PortraitRows, SiteData } from '../../site/src/data.ts';
import { shadePortrait } from './card/portrait.ts';
import { resolveValue } from './card/text.ts';
import type { Theme } from './card/theme.ts';
import type { GitHubStats, ProfileConfig } from './types.ts';

/** The portrait for one theme as rows of characters plus matching rows of opacity digits. */
function portraitRows(rows: readonly string[], theme: Theme): PortraitRows {
  const glyphs: string[] = [];
  const opacity: string[] = [];
  for (const cells of shadePortrait(rows, theme)) {
    const line = cells.map((cell) => cell.glyph).join('').trimEnd();
    glyphs.push(line);
    opacity.push(cells.slice(0, line.length).map((cell) => cell.opacity.toString(36)).join(''));
  }
  return { glyphs, opacity };
}

export function buildSiteData(profile: ProfileConfig, stats: GitHubStats, portrait: readonly string[], now: Date): SiteData {
  const { repositories, languages, login: _login, createdAt, ...numbers } = stats;
  return {
    generatedAt: now.toISOString(),
    profile: {
      name: profile.name,
      login: profile.login,
      user: profile.user,
      host: profile.host,
      createdAt: createdAt.toISOString(),
      sections: profile.sections.map((section) => ({
        title: section.title ?? null,
        fields: section.fields.map((field) => ({ key: field.key, value: resolveValue(field, stats, now) })),
      })),
    },
    stats: numbers,
    repositories,
    languages,
    portrait: { dark: portraitRows(portrait, 'dark'), light: portraitRows(portrait, 'light') },
  };
}
