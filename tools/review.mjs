#!/usr/bin/env node
// Review sheet for one flag: the official drawing next to the full formats at the same height,
// an overlay of the drawing's outlines on the original format, and the miniatures at actual size
// and enlarged 4× without smoothing.
//
//   node tools/review.mjs XK --source path/to/source.svg [--out preview/review-XK.png] [--h 320]
//
// The source SVG is the official drawing reduced to the flag field: its viewBox is the field.
// The overlay aligns the source to the original format by height and center (rules U2, U3 for a
// charge centered on the field); use --align none to skip the overlay for off-center charges.
// Source files are not committed: they are working copies of official documents.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import { PNG } from 'pngjs';

const code = process.argv[2];
const arg = (n, d) => {
  const i = process.argv.indexOf(n);
  return i > -1 ? process.argv[i + 1] : d;
};
if (!code || code.startsWith('--')) {
  console.error('Usage: node tools/review.mjs CODE --source source.svg [--out file.png] [--h 320]');
  process.exit(1);
}
const root = new URL('../', import.meta.url);
const out = arg('--out', `preview/review-${code}.png`);
const FULL_H = Number(arg('--h', 320));
const srcPath = arg('--source', null);
const align = arg('--align', 'center');
const read = (p) => readFileSync(new URL(p, root), 'utf8');

const BG = [0xf2, 0xf2, 0xf2];
const PAD = 16;

function render(svg, opts) {
  const r = new Resvg(svg, { background: 'rgba(0,0,0,0)', font: { loadSystemFonts: false }, ...opts });
  const img = r.render();
  return { w: img.width, h: img.height, px: Buffer.from(img.pixels) };
}
const atHeight = (svg, h) => render(svg, { fitTo: { mode: 'height', value: h } });
const atScale = (svg, k) => render(svg, { fitTo: { mode: 'zoom', value: k } });

function zoomNearest(img, k) {
  const w = img.w * k;
  const h = img.h * k;
  const px = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const s = (Math.floor(y / k) * img.w + Math.floor(x / k)) * 4;
      img.px.copy(px, (y * w + x) * 4, s, s + 4);
    }
  return { w, h, px };
}

function text(s, size = 13, color = '#333') {
  const esc = s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(s.length * size * 0.62) + 4}" height="${size + 6}"><text x="1" y="${size}" font-size="${size}" font-family="Inter, DejaVu Sans, sans-serif" fill="${color}">${esc}</text></svg>`;
  return render(svg, { font: { loadSystemFonts: true } });
}

const viewBox = (svg) => svg.match(/viewBox="([-\d.]+) ([-\d.]+) ([\d.]+) ([\d.]+)"/).slice(1).map(Number);

// Outline overlay: the source paths as thin magenta strokes, mapped onto the original format.
function overlaySvg(ours, source) {
  const [, , W, H] = viewBox(ours);
  const [sx, sy, sw, sh] = viewBox(source);
  const k = H / sh;
  const dx = W / 2 - (sx + sw / 2) * k;
  const dy = H / 2 - (sy + sh / 2) * k;
  const paths = [...source.matchAll(/<path\b[^>]*\sd="([^"]+)"/g)].slice(1).map((m) => `<path d="${m[1]}"/>`).join('');
  const body = ours.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${body}<g transform="translate(${dx} ${dy}) scale(${k})" fill="none" stroke="#ff00d4" stroke-width="${1.2 / k}">${paths}</g></svg>`;
}

// Layout: rows of labeled tiles.
const rows = [];
const tile = (label, img) => ({ label: text(label), img });

const original = read(`flags/original/${code}.svg`);
const threeTwo = read(`flags/3x2/${code}.svg`);
const row1 = [];
if (srcPath) {
  const source = readFileSync(srcPath, 'utf8');
  const [, , sw, sh] = viewBox(source);
  row1.push(tile(`source (field ${(sw / sh).toFixed(3)}:1)`, atHeight(source, FULL_H)));
  const [, , W, H] = viewBox(original);
  row1.push(tile(`original ${W}×${H}`, atHeight(original, FULL_H)));
  if (align !== 'none') row1.push(tile('overlay: source outlines on original', atHeight(overlaySvg(original, source), FULL_H)));
} else {
  row1.push(tile('original', atHeight(original, FULL_H)));
}
rows.push(row1);
rows.push([tile('3x2 900×600', atHeight(threeTwo, Math.round(FULL_H * 0.75)))]);

const minis = ['rect-24x16', 'rect-36x24', 'circle-24', 'circle-40'];
const row3 = [];
const row4 = [];
for (const m of minis) {
  const svg = read(`flags/mini/${m}/${code}.svg`);
  const img = atScale(svg, 1);
  row3.push(tile(`${m} 1×`, img));
  row4.push(tile(`${m} ×4`, zoomNearest(img, 4)));
}
// Naive downscale of the 3x2 for comparison: what the miniature would be without simplification.
for (const [w, h] of [[24, 16], [36, 24]]) {
  const img = render(threeTwo, { fitTo: { mode: 'width', value: w } });
  row4.push(tile(`3x2 scaled to ${w}×${h}, ×4`, zoomNearest(img, 4)));
}
rows.push(row3, row4);

// Compose
const rowH = rows.map((r) => Math.max(...r.map((t) => t.img.h + t.label.h + 6)));
const rowW = rows.map((r) => r.reduce((s, t) => s + Math.max(t.img.w, t.label.w) + PAD, PAD));
const title = text(`${code} — review sheet`, 16, '#111');
const W = Math.max(...rowW, title.w + 2 * PAD);
const H = PAD + title.h + PAD + rowH.reduce((a, b) => a + b + PAD, 0);
const png = new PNG({ width: W, height: H });
for (let i = 0; i < W * H; i++) {
  png.data[i * 4] = BG[0];
  png.data[i * 4 + 1] = BG[1];
  png.data[i * 4 + 2] = BG[2];
  png.data[i * 4 + 3] = 255;
}
function blit(img, x0, y0) {
  for (let y = 0; y < img.h; y++)
    for (let x = 0; x < img.w; x++) {
      const s = (y * img.w + x) * 4;
      const d = ((y0 + y) * W + (x0 + x)) * 4;
      const a = img.px[s + 3] / 255;
      for (let c = 0; c < 3; c++) png.data[d + c] = Math.round(img.px[s + c] * a + png.data[d + c] * (1 - a));
    }
}
blit(title, PAD, PAD);
let y = PAD + title.h + PAD;
rows.forEach((r, i) => {
  let x = PAD;
  for (const t of r) {
    blit(t.label, x, y);
    blit(t.img, x, y + t.label.h + 6);
    x += Math.max(t.img.w, t.label.w) + PAD;
  }
  y += rowH[i] + PAD;
});
mkdirSync(dirname(new URL(out, root).pathname), { recursive: true });
writeFileSync(new URL(out, root), PNG.sync.write(png));
console.log(`Wrote ${out} (${W}×${H})`);
