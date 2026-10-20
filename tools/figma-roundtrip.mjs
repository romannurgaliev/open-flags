#!/usr/bin/env node
// Pixel comparison, Figma ↔ repository.
// Takes renders of the component sets from Figma (PNGs downloaded via get_screenshot or REST /images
// with format=png) and compares each variant with a render of the SVG from flags/ at the same scale.
// Only "interior" pixels are compared: those whose 8 neighbors in our render all have the same
// color. At edges the Figma and resvg rasterizers antialias differently.
//
//   node tools/figma-roundtrip.mjs <directory with PNGs>
// PNG names: square-16.png … rect-60x40.png, original.png, 3x2.png, 1x1.png.
// Set layout as in the pilot Figma file: miniatures in a row (padding 16, step size+16),
// full formats in a 5-column grid (padding 60, step max size+60).

import { readFileSync, existsSync } from 'node:fs';
import { PNG } from 'pngjs';
import { Resvg } from '@resvg/resvg-js';
import { allCodes, FORMATS, loadMeta, originalSize } from '../src/build.mjs';
import { rgbToLab, deltaE2000 } from '../src/color.mjs';

const dir = process.argv[2];
const root = new URL('../', import.meta.url);
const codes = allCodes();

function render(svg, scale) {
  const r = new Resvg(svg, { fitTo: { mode: 'zoom', value: scale }, font: { loadSystemFonts: false } });
  const img = r.render();
  return { w: img.width, h: img.height, px: img.pixels };
}

const rows = [];
let worst = 0;
for (const spec of FORMATS) {
  const name = spec.dir.replace('mini/', '');
  const file = `${dir}/${name}.png`;
  if (!existsSync(file)) continue;
  const shot = PNG.sync.read(readFileSync(file));
  const full = !spec.tier;
  const sizes = codes.map((c) => (spec.fmt === 'original' ? originalSize(loadMeta(c)) : { W: spec.W, H: spec.H }));
  const maxW = Math.max(...sizes.map((s) => s.W));
  const maxH = Math.max(...sizes.map((s) => s.H));
  const gap = full ? 60 : 16;
  const cols = full ? 5 : 25;
  const setW = gap + cols * (maxW + gap);
  const scale = shot.width / setW;
  let mism = 0;
  let checked = 0;
  const bad = [];
  codes.forEach((code, i) => {
    const svg = readFileSync(new URL(`flags/${spec.dir}/${code}.svg`, root), 'utf8');
    const ours = render(svg, scale);
    const ox = Math.round((gap + (i % cols) * (maxW + gap)) * scale);
    const oy = Math.round((gap + Math.floor(i / cols) * (maxH + gap)) * scale);
    let m = 0;
    for (let y = 1; y < ours.h - 1; y++)
      for (let x = 1; x < ours.w - 1; x++) {
        const k = (y * ours.w + x) * 4;
        if (ours.px[k + 3] < 255) continue;
        let interior = true;
        for (let dy = -1; dy <= 1 && interior; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const q = ((y + dy) * ours.w + x + dx) * 4;
            if (ours.px[q] !== ours.px[k] || ours.px[q + 1] !== ours.px[k + 1] || ours.px[q + 2] !== ours.px[k + 2] || ours.px[q + 3] !== 255) {
              interior = false;
              break;
            }
          }
        if (!interior) continue;
        const sx = ox + x;
        const sy = oy + y;
        if (sx >= shot.width || sy >= shot.height) continue;
        const s = (sy * shot.width + sx) * 4;
        checked++;
        const d = deltaE2000(rgbToLab([ours.px[k], ours.px[k + 1], ours.px[k + 2]]), rgbToLab([shot.data[s], shot.data[s + 1], shot.data[s + 2]]));
        if (d > 3) m++;
      }
    mism += m;
    if (m) bad.push(`${code}:${m}`);
  });
  worst = Math.max(worst, mism);
  rows.push(`| ${name} | ${scale.toFixed(3)} | ${checked} | ${mism} | ${bad.join(' ') || '—'} |`);
}
console.log('| Set | Scale | Interior pixels compared | Mismatches (ΔE2000 > 3) | Where |\n|---|---|---|---|---|');
console.log(rows.join('\n'));
process.exit(worst ? 1 : 0);
