#!/usr/bin/env node
// Measures how much the pairs in the confusable-pairs registry differ in miniatures:
// share of pixels with ΔE2000 > 10, and mean ΔE2000 over the whole frame. Prints a Markdown table.
//   node tools/confusable.mjs
import { readFileSync, existsSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { rgbToLab, deltaE2000 } from '../src/color.mjs';

const root = new URL('../', import.meta.url);
const PAIRS = [['TD', 'RO'], ['ID', 'MC'], ['AU', 'NZ'], ['PW', 'KZ'], ['CY', 'XK'], ['PL', 'ID']];
const DIRS = ['mini/square-16', 'mini/circle-16', 'mini/rect-24x16', 'mini/square-24', 'mini/square-40', '1x1'];

function px(dir, code) {
  const f = new URL(`flags/${dir}/${code}.svg`, root);
  if (!existsSync(f)) return null;
  const svg = readFileSync(f, 'utf8');
  const scale = dir === '1x1' ? 40 / 600 : 1;
  const img = new Resvg(svg, { fitTo: { mode: 'zoom', value: scale }, background: '#FFFFFF', font: { loadSystemFonts: false } }).render();
  return { w: img.width, h: img.height, p: img.pixels };
}

const rows = [];
for (const [a, b] of PAIRS) {
  const cells = DIRS.map((d) => {
    const A = px(d, a);
    const B = px(d, b);
    if (!A || !B) return '—';
    let big = 0;
    let sum = 0;
    const n = A.w * A.h;
    for (let i = 0; i < n; i++) {
      const la = rgbToLab([A.p[i * 4], A.p[i * 4 + 1], A.p[i * 4 + 2]]);
      const lb = rgbToLab([B.p[i * 4], B.p[i * 4 + 1], B.p[i * 4 + 2]]);
      const e = deltaE2000(la, lb);
      sum += e;
      if (e > 10) big++;
    }
    return `${Math.round((100 * big) / n)}% / ${(sum / n).toFixed(1)}`;
  });
  rows.push(`| ${a} — ${b} | ${cells.join(' | ')} |`);
}
console.log(`| Pair | ${DIRS.map((d) => d.replace('mini/', '')).join(' | ')} |`);
console.log(`|---|${DIRS.map(() => '---').join('|')}|`);
console.log(rows.join('\n'));
console.log('\nEach cell: share of pixels differing by more than ΔE2000 10 / mean ΔE2000 over the frame. 1x1 is rendered at 40 px.');
