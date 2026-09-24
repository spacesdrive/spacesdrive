/**
 * Copies the web terminal's static files into _site/. The TypeScript is
 * compiled into _site/js/ by `tsc -p tsconfig.site.json`, and the stats
 * snapshot is written to _site/data/ by `npm run stats`.
 */
import { copyFile, mkdir } from 'node:fs/promises';

const SITE = new URL('../site/', import.meta.url);
const OUTPUT = new URL('../_site/', import.meta.url);
const STATIC_FILES = ['index.html', 'styles.css'];

await mkdir(OUTPUT, { recursive: true });
for (const file of STATIC_FILES) await copyFile(new URL(file, SITE), new URL(file, OUTPUT));
console.log(`Copied ${STATIC_FILES.join(', ')} to _site/`);
