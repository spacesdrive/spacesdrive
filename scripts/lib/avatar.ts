/**
 * Image processing for the portrait: decodes the avatar, removes the plain
 * studio background and samples the subject into a grid of brightness levels.
 */
import jpeg from 'jpeg-js';
import { LUMA_LEVELS } from './card/portrait.ts';
import { PORTRAIT_CELL_ASPECT } from './card/theme.ts';

/** Output width in characters. The card layout is tuned for this value. */
const COLUMNS = 60;

/** Portion of the photo to keep, as fractions of width and height: head, collar and shoulder. */
const CROP = { left: 0.25, right: 0.8, top: 0, bottom: 0.72 } as const;

/** Background pixels are flood-filled from the border while brighter than this. */
const BACKGROUND_THRESHOLD = 0.6;
/** Maximum brightness step between neighbouring background pixels. */
const BACKGROUND_STEP = 0.03;
/** Cells with less of the subject than this fraction are left blank. */
const MIN_COVERAGE = 0.45;

/** Strength of the unsharp mask applied to the character grid. */
const SHARPEN = 0.9;

interface GrayImage {
  width: number;
  height: number;
  /** Luminance per pixel in the range 0 (black) to 1 (white). */
  pixels: Float32Array;
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
 * Encodes the brightness of each subject cell as one base-36 digit (0 = black,
 * z = white); background cells are spaces. The card turns these levels into
 * characters and opacity per theme, so the face stays a positive image on both.
 */
function toLumaGrid(level: Float32Array, background: Uint8Array, columns: number, rows: number): string {
  const lines: string[] = [];
  for (let row = 0; row < rows; row++) {
    let line = '';
    for (let col = 0; col < columns; col++) {
      const i = row * columns + col;
      line += background[i] ? ' ' : Math.round((level[i] ?? 0) * (LUMA_LEVELS - 1)).toString(36);
    }
    lines.push(line.trimEnd());
  }
  while (lines.length && lines[lines.length - 1] === '') lines.pop();
  return `${lines.join('\n')}\n`;
}

/** Converts a JPEG avatar into the brightness grid stored in assets/avatar-luma.txt. */
export function avatarToLumaGrid(jpegData: Buffer): string {
  const image = toGray(jpegData);
  const { rows, cells, background } = sampleCells(image, findBackground(image), COLUMNS);
  return toLumaGrid(normalise(cells, background, COLUMNS, rows), background, COLUMNS, rows);
}
