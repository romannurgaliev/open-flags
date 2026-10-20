#!/usr/bin/env node
// Writes baseline/: raster snapshots of the current flags that C15 compares the next PR against.
// Run at release time: the snapshot records the "before" state for the next review.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { PNG } from 'pngjs';
import { FORMATS, allCodes, loadMeta, originalSize } from '../src/build.mjs';
import { render, expectedSize } from './lib/checks.mjs';

const root = new URL('../', import.meta.url);
let n = 0;
for (const code of allCodes()) {
  const meta = loadMeta(code);
  for (const spec of FORMATS) {
    const svg = readFileSync(new URL(`flags/${spec.dir}/${code}.svg`, root), 'utf8');
    const size = expectedSize(spec, meta, originalSize);
    const img = render(svg, spec.tier ? 1 : 200 / size.H);
    const png = new PNG({ width: img.w, height: img.h });
    img.px.copy(png.data);
    const dir = new URL(`baseline/${spec.dir}/`, root);
    mkdirSync(dir, { recursive: true });
    writeFileSync(new URL(`${code}.png`, dir), PNG.sync.write(png));
    n++;
  }
}
console.log(`baseline/: ${n} snapshots`);
