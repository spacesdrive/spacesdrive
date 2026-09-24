/**
 * Fetches live GitHub statistics, re-renders the profile card SVGs and refreshes
 * the generated block of README.md. Files are only written when their content
 * actually changes, so an unchanged run leaves the working tree clean.
 *
 * Usage:
 *   GITHUB_TOKEN=... npm run stats            # update files
 *   GITHUB_TOKEN=... npm run stats -- --dry-run  # print the stats, write nothing
 */
import { readFile, writeFile } from 'node:fs/promises';
import { profile } from '../profile.config.ts';
import { renderCard, type Layout } from './lib/card/card.ts';
import type { Theme } from './lib/card/theme.ts';
import { createGraphQLClient } from './lib/github.ts';
import { describeCard, renderStatsBlock, replaceStatsBlock, type CardImages } from './lib/readme.ts';
import { collectStats } from './lib/stats.ts';

const ROOT = new URL('../', import.meta.url);
const README = new URL('README.md', ROOT);
const PORTRAIT = new URL('assets/avatar-luma.txt', ROOT);

const CARDS: Record<keyof CardImages, { path: string; theme: Theme; layout: Layout }> = {
  wideDark: { path: 'assets/profile-card-dark.svg', theme: 'dark', layout: 'wide' },
  wideLight: { path: 'assets/profile-card-light.svg', theme: 'light', layout: 'wide' },
  narrowDark: { path: 'assets/profile-card-mobile-dark.svg', theme: 'dark', layout: 'narrow' },
  narrowLight: { path: 'assets/profile-card-mobile-light.svg', theme: 'light', layout: 'narrow' },
};

/** Writes `content` to `file` unless it already holds exactly that. Returns whether it wrote. */
async function writeIfChanged(file: URL, content: string): Promise<boolean> {
  const current = await readFile(file, 'utf8').catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') return null;
    throw error;
  });
  if (current === content) return false;
  await writeFile(file, content);
  return true;
}

async function main(): Promise<void> {
  const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
  if (!token) {
    throw new Error('Set GITHUB_TOKEN (locally: GITHUB_TOKEN=$(gh auth token) npm run stats)');
  }
  const dryRun = process.argv.includes('--dry-run');

  const stats = await collectStats(createGraphQLClient(token), profile.login);
  console.log('Collected stats:', { ...stats, createdAt: stats.createdAt.toISOString() });
  if (dryRun) return;

  const portrait = (await readFile(PORTRAIT, 'utf8')).replace(/\r\n/g, '\n').trimEnd().split('\n');
  const description = describeCard(profile, stats);
  const now = new Date();
  const changed: string[] = [];

  for (const card of Object.values(CARDS)) {
    const svg = renderCard({ profile, stats, portrait, description, now, theme: card.theme, layout: card.layout });
    if (await writeIfChanged(new URL(card.path, ROOT), svg)) changed.push(card.path);
  }

  const images: CardImages = {
    wideDark: `./${CARDS.wideDark.path}`,
    wideLight: `./${CARDS.wideLight.path}`,
    narrowDark: `./${CARDS.narrowDark.path}`,
    narrowLight: `./${CARDS.narrowLight.path}`,
  };
  const readme = await readFile(README, 'utf8');
  const updated = replaceStatsBlock(readme, renderStatsBlock(images, description));
  if (await writeIfChanged(README, updated)) changed.push('README.md');

  console.log(changed.length ? `Updated: ${changed.join(', ')}` : 'No changes.');
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
