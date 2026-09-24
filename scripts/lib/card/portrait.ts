/**
 * The ASCII portrait: turns the brightness grid from assets/avatar-luma.txt into
 * characters and opacities for a theme, and renders them as SVG rows.
 */
import { escapeXml, gridText, baseline } from './svg.ts';
import { PORTRAIT_CHAR_WIDTH, PORTRAIT_FONT_SIZE, PORTRAIT_LINE_HEIGHT, type Theme } from './theme.ts';

/** Brightness levels in the portrait grid, stored as one base-36 digit per cell. */
export const LUMA_LEVELS = 36;
/** Characters ordered from least to most ink; clearly distinct densities read as a picture. */
const RAMP = " .',;:clodxkO0KXNWM";
/** Opacity steps layered on top of the ramp, multiplying the number of visible tones. */
export const OPACITY_STEPS = 10;
/** On the dark card, subject brightness below this renders as empty space. */
const DARK_CUTOFF = 0.5;
/** On the dark card, the portrait starts fading out at this fraction of its height. */
const DARK_FADE_START = 0.55;
/** Brightness of the photo's grey backdrop. */
const BACKDROP_LUMA = 0.7;
/** Backlight ellipse on the dark card, as fractions of the portrait grid: centred behind the head. */
const SPOTLIGHT = { x: 0.42, y: 0.34, radiusX: 0.62, radiusY: 0.5 } as const;

export interface PortraitCell {
  glyph: string;
  /** 0..OPACITY_STEPS */
  opacity: number;
}

/** Parses the stored grid into brightness values (0..1), `null` for background. */
function parseGrid(rows: readonly string[]): (number | null)[][] {
  const width = Math.max(...rows.map((row) => row.length));
  return rows.map((row) =>
    Array.from({ length: width }, (_, x) => {
      const digit = row[x];
      return digit && digit !== ' ' ? parseInt(digit, 36) / (LUMA_LEVELS - 1) : null;
    }),
  );
}

/**
 * Strength of the backlight behind the subject at a cell: 1 at the centre of an
 * ellipse around the head, fading smoothly to 0 before the grid edges.
 */
function spotlight(x: number, y: number, width: number, height: number): number {
  const dx = (x - width * SPOTLIGHT.x) / (width * SPOTLIGHT.radiusX);
  const dy = (y - height * SPOTLIGHT.y) / (height * SPOTLIGHT.radiusY);
  const fade = Math.max(0, 1 - Math.hypot(dx, dy));
  return fade * fade * (3 - 2 * fade);
}

/** Maps a brightness to its rank (0..1) among all subject cells: histogram equalisation. */
function rankOf(grid: (number | null)[][]): (value: number) => number {
  const values = grid
    .flat()
    .filter((value): value is number => value !== null)
    .sort((a, b) => a - b);
  return (value) => {
    let below = 0;
    while (below < values.length && (values[below] ?? 0) < value) below++;
    let upTo = below;
    while (upTo < values.length && (values[upTo] ?? 0) === value) upTo++;
    return values.length ? (below + upTo) / 2 / values.length : value;
  };
}

const glyphFor = (tone: number, minimum: number): string =>
  RAMP[Math.max(minimum, Math.round(tone * (RAMP.length - 1)))] ?? ' ';

const opacityStep = (opacity: number): number => Math.round(Math.min(1, Math.max(0, opacity)) * OPACITY_STEPS);

/**
 * Turns the brightness grid into characters and opacities for one theme, so the
 * face stays a positive image on both cards.
 *
 * Light card: ink follows darkness and the backdrop is left out, as it already
 * matches the card. Dark card: ink follows brightness, and the photo's lit grey
 * backdrop is kept as a soft spotlight so the dark hair and shirt read as a
 * silhouette against it instead of melting into the card.
 */
export function shadePortrait(rows: readonly string[], theme: Theme): PortraitCell[][] {
  const grid = parseGrid(rows);
  const height = grid.length;
  const width = grid[0]?.length ?? 0;
  const equalise = rankOf(grid);
  // Dark card: brightness is histogram-equalised so the face spans the bright end,
  // and the darkest share (hair, shirt) maps to nothing, leaving a clean silhouette.
  const toneOf = (value: number): number =>
    theme === 'dark' ? Math.max(0, (equalise(value) - DARK_CUTOFF) / (1 - DARK_CUTOFF)) : 1 - value;

  return grid.map((row, y) =>
    row.map((value, x): PortraitCell => {
      if (value !== null) {
        // The dark card fades the portrait out below the collar, keeping the focus on the face.
        const fade = theme === 'dark' ? Math.min(1, Math.max(0, (1 - y / height) / (1 - DARK_FADE_START))) : 1;
        const tone = toneOf(value) * fade;
        // On the light card every subject cell keeps a faint mark so the outline never
        // breaks up; on the dark card black hair and shirt stay empty, cut out of the backlight.
        return { glyph: glyphFor(tone, theme === 'light' ? 1 : 0), opacity: opacityStep(0.3 + 0.7 * tone) };
      }
      const light = theme === 'dark' ? spotlight(x, y, width, height) : 0;
      if (light <= 0.02) return { glyph: ' ', opacity: 0 };
      return { glyph: glyphFor(BACKDROP_LUMA * light * 0.85, 0), opacity: opacityStep(0.15 + 0.45 * light) };
    }),
  );
}

/** One `<text>` per portrait row, with runs of equal opacity grouped into a tspan. */
export function renderPortrait(rows: readonly string[], theme: Theme, x: number, top: number): string[] {
  return shadePortrait(rows, theme).map((cells, i) => {
    const last = cells.reduce((end, cell, index) => (cell.glyph === ' ' ? end : index), -1);
    const spans: string[] = [];
    let run = '';
    let runOpacity = -1;
    for (const cell of cells.slice(0, last + 1)) {
      // Spaces take any opacity, so they join whatever run they sit in.
      if (cell.glyph !== ' ' && cell.opacity !== runOpacity) {
        if (run) spans.push(runOpacity < 0 ? run : `<tspan class="o${runOpacity}">${escapeXml(run)}</tspan>`);
        run = '';
        runOpacity = cell.opacity;
      }
      run += cell.glyph;
    }
    if (run) spans.push(runOpacity < 0 ? run : `<tspan class="o${runOpacity}">${escapeXml(run)}</tspan>`);
    const y = baseline(top + i * PORTRAIT_LINE_HEIGHT, PORTRAIT_FONT_SIZE, PORTRAIT_LINE_HEIGHT);
    return gridText(spans.join(''), last + 1, x, y, PORTRAIT_CHAR_WIDTH);
  });
}

/** Portrait font size and the `.o0`..`.oN` opacity classes. */
export const portraitStyle = (): string =>
  `.portrait text{font-size:${PORTRAIT_FONT_SIZE}px}` +
  Array.from({ length: OPACITY_STEPS + 1 }, (_, i) => `.o${i}{fill-opacity:${i / OPACITY_STEPS}}`).join('');
