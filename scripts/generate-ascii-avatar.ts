/**
 * One-off generator: samples the GitHub avatar into the brightness grid the
 * profile card draws its ASCII portrait from. Its output (assets/avatar-luma.txt)
 * is committed, so the daily stats job never needs to decode images.
 *
 * Usage:
 *   npm run avatar                 # fetches the current avatar from GitHub
 *   npm run avatar -- ./photo.jpg  # or uses a local JPEG
 */
import { readFile, writeFile } from 'node:fs/promises';
import { profile } from '../profile.config.ts';
import { avatarToLumaGrid } from './lib/avatar.ts';

const OUTPUT = new URL('../assets/avatar-luma.txt', import.meta.url);

async function loadAvatar(source: string | undefined): Promise<Buffer> {
  if (source) return readFile(source);
  const url = `https://avatars.githubusercontent.com/${profile.login}?s=460`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Avatar download failed: ${response.status} ${url}`);
  return Buffer.from(await response.arrayBuffer());
}

const grid = avatarToLumaGrid(await loadAvatar(process.argv[2]));
await writeFile(OUTPUT, grid);
console.log(`Wrote ${grid.split('\n').length - 1}-row portrait to ${OUTPUT.pathname}`);
