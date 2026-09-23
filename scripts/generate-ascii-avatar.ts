/**
 * One-off generator: turns the GitHub avatar into the ASCII portrait used by the
 * profile card. Its output (assets/avatar-ascii.txt) is committed, so the daily
 * stats job never needs to decode images.
 *
 * Usage:
 *   npm run avatar                 # fetches the current avatar from GitHub
 *   npm run avatar -- ./photo.jpg  # or uses a local JPEG
 */
import { readFile, writeFile } from 'node:fs/promises';
import jpeg from 'jpeg-js';
import { profile } from '../profile.config.ts';
import { PORTRAIT_CELL_ASPECT } from './lib/card.ts';

const OUTPUT = new URL('../assets/avatar-ascii.txt', import.meta.url);

/** Output width in characters. The card layout is tuned for this value. */
const COLUMNS = 52;

/** Portion of the photo to keep, as fractions of width and height. */
const CROP = { left: 0.27, right: 0.79, top: 0, bottom: 0.76 } as const;

/**
 * Characters ordered from least to most ink. A short ramp with clearly distinct
 * densities reads as a picture; long ramps turn into noise at this size.
 */
const RAMP = " .',;:clodxkO0KXNWM";

/** Background pixels are flood-filled from the border while brighter than this. */
const BACKGROUND_THRESHOLD = 0.6;
/** Maximum brightness step between neighbouring background pixels. */
const BACKGROUND_STEP = 0.03;
/** Cells with less of the subject than this fraction are left blank. */
const MIN_COVERAGE = 0.45;

/** Strength of the unsharp mask applied to the character grid. */
const SHARPEN = 0.9;
/** Values below 1 lift mid-tones so skin keeps some texture. */
const GAMMA = 0.9;

interface GrayImage {
  width: number;
  height: number;
  /** Luminance per pixel in the range 0 (black) to 1 (white). */
  pixels: Float32Array;
}

async function loadAvatar(source: string | undefined): Promise<Buffer> {
  if (source) return readFile(source);
  const url = `https://avatars.githubusercontent.com/${profile.login}?s=460`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Avatar download failed: ${response.status} ${url}`);
  return Buffer.from(await response.arrayBuffer());
}

function toGray(jpegData: Buffer): GrayImage {
  const { width, height, data } = jpeg.decode(jpegData, { useTArray: true, formatAsRGBA: true });
  const pixels = new Float32Array(width * height);
  for (let i = 0; i < pixels.length; i++) {
    const r = data[i * 4] ?? 0;
    const g = data[i * 4 + 1] ?? 0;
    const b = data[i * 4 + 2] ?? 0;
    pixels[i] = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  }
  return { width, height, pixels };
}

/**
 * Marks the plain studio background by flood-filling bright, smooth pixels from
 * the top, left and right edges (the subject runs off the bottom edge).
 */
function findBackground(image: GrayImage): Uint8Array {
  const { width, height, pixels } = image;
  const background = new Uint8Array(pixels.length);
  const queue: number[] = [];
  const isBright = (i: number): boolean => (pixels[i] ?? 0) > BACKGROUND_THRESHOLD;
  const seed = (i: number): void => {
    if (background[i] || !isBright(i)) return;
    background[i] = 1;
    queue.push(i);
  };

  for (let x = 0; x < width; x++) seed(x);
  for (let y = 0; y < height; y++) {
    seed(y * width);
    seed(y * width + width - 1);
  }

  while (queue.length) {
    const i = queue.pop() as number;
    const x = i % width;
    const y = Math.floor(i / width);
    const neighbours = [x > 0 ? i - 1 : -1, x < width - 1 ? i + 1 : -1, y > 0 ? i - width : -1, y < height - 1 ? i + width : -1];
    for (const n of neighbours) {
      if (n < 0 || background[n] || !isBright(n)) continue;
      if (Math.abs((pixels[n] ?? 0) - (pixels[i] ?? 0)) > BACKGROUND_STEP) continue;
      background[n] = 1;
      queue.push(n);
    }
  }
  return background;
}

interface CellGrid {
  rows: number;
  /** Mean luminance of the subject's pixels in each cell. */
  cells: Float32Array;
  /** 1 where a cell is mostly background and should stay blank. */
  background: Uint8Array;
}

/** Box-filters the cropped subject down to one luminance value per character cell. */
function sampleCells(image: GrayImage, mask: Uint8Array, columns: number): CellGrid {
  const x0 = image.width * CROP.left;
  const y0 = image.height * CROP.top;
  const cropWidth = image.width * (CROP.right - CROP.left);
  const cropHeight = image.height * (CROP.bottom - CROP.top);
  const cellWidth = cropWidth / columns;
  const cellHeight = cellWidth / PORTRAIT_CELL_ASPECT;
  const rows = Math.floor(cropHeight / cellHeight);
  const cells = new Float32Array(columns * rows);
  const background = new Uint8Array(columns * rows);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      const px0 = Math.floor(x0 + col * cellWidth);
      const py0 = Math.floor(y0 + row * cellHeight);
      const px1 = Math.min(image.width, Math.ceil(x0 + (col + 1) * cellWidth));
      const py1 = Math.min(image.height, Math.ceil(y0 + (row + 1) * cellHeight));
      let sum = 0;
      let subject = 0;
      let total = 0;
      for (let y = py0; y < py1; y++) {
        for (let x = px0; x < px1; x++) {
          const i = y * image.width + x;
          total++;
          if (mask[i]) continue;
          sum += image.pixels[i] ?? 0;
          subject++;
        }
      }
      const i = row * columns + col;
      // Averaging only subject pixels keeps the bright backdrop from haloing the outline.
      background[i] = subject < total * MIN_COVERAGE ? 1 : 0;
      cells[i] = subject ? sum / subject : 1;
    }
  }
  removeSpecks(background, columns, rows);
  return { rows, cells, background };
}

/** Blanks subject cells with no subject neighbours (stray hairs, JPEG noise). */
function removeSpecks(background: Uint8Array, columns: number, rows: number): void {
  const isolated: number[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      if (background[row * columns + col]) continue;
      let neighbours = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const r = row + dy;
          const c = col + dx;
          if ((dx || dy) && r >= 0 && r < rows && c >= 0 && c < columns && !background[r * columns + c]) neighbours++;
        }
      }
      if (neighbours === 0) isolated.push(row * columns + col);
    }
  }
  for (const i of isolated) background[i] = 1;
}

/** Maps the subject's luminance to 0..1 using robust percentiles, then sharpens it. */
function normalise(cells: Float32Array, background: Uint8Array, columns: number, rows: number): Float32Array {
  const subject = [...cells].filter((_, i) => !background[i]).sort((a, b) => a - b);
  const low = subject[Math.floor(subject.length * 0.02)] ?? 0;
  const high = subject[Math.floor(subject.length * 0.98)] ?? 1;
  const range = Math.max(high - low, 1e-6);
  const level = cells.map((value) => Math.min(1, Math.max(0, (value - low) / range)));

  // Unsharp mask over the character grid so eyes, brows and jawline survive downsampling.
  const sharpened = new Float32Array(level.length);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      let sum = 0;
      let count = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const r = row + dy;
          const c = col + dx;
          if (r < 0 || r >= rows || c < 0 || c >= columns || background[r * columns + c]) continue;
          sum += level[r * columns + c] ?? 0;
          count++;
        }
      }
      const i = row * columns + col;
      const value = level[i] ?? 0;
      sharpened[i] = Math.min(1, Math.max(0, value + SHARPEN * (value - (count ? sum / count : value))));
    }
  }
  return sharpened;
}

/**
 * Ink follows darkness. On the dark card that is a negative, which still reads
 * well because the likeness is carried by the hair and shoulder silhouette.
 */
function toAscii(level: Float32Array, background: Uint8Array, columns: number, rows: number): string {
  const lines: string[] = [];
  for (let row = 0; row < rows; row++) {
    let line = '';
    for (let col = 0; col < columns; col++) {
      const i = row * columns + col;
      if (background[i]) {
        line += ' ';
        continue;
      }
      const value = level[i] ?? 0;
      const ink = Math.pow(1 - value, GAMMA);
      // Index 0 is a space; the subject always gets at least a faint mark to keep its outline.
      line += RAMP[Math.min(RAMP.length - 1, 1 + Math.round(ink * (RAMP.length - 2)))];
    }
    lines.push(line.trimEnd());
  }
  while (lines.length && lines[lines.length - 1] === '') lines.pop();
  return `${lines.join('\n')}\n`;
}

async function main(): Promise<void> {
  const image = toGray(await loadAvatar(process.argv[2]));
  const { rows, cells, background } = sampleCells(image, findBackground(image), COLUMNS);
  const level = normalise(cells, background, COLUMNS, rows);
  const ascii = toAscii(level, background, COLUMNS, rows);
  await writeFile(OUTPUT, ascii);
  process.stdout.write(ascii);
  console.log(`\nWrote ${COLUMNS}x${ascii.split('\n').length - 1} portrait to ${OUTPUT.pathname}`);
}

await main();
