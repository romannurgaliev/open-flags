#!/usr/bin/env node
// Контактный лист: все флаги во всех форматах.
//   node scripts/sheet.mjs preview/contact-sheet.png [--scale 2] [--dir flags] [--codes JP,BD]
//
// Колонки: полные форматы (высота 48 css px), миниатюры в настоящем размере, и «пиксельный вид»
// S-ступени: рендер 1x, увеличенный в 4 раза без сглаживания — так видно сетку.
// Черновики (status draft / blocked-review в метаданных) помечены красным углом.

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import { PNG } from 'pngjs';

const arg = (n, d) => {
  const i = process.argv.indexOf(n);
  return i > -1 ? process.argv[i + 1] : d;
};
const out = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'preview/contact-sheet.png';
const S = Number(arg('--scale', 1));
const base = new URL(`../${arg('--dir', 'flags')}/`, import.meta.url);
const root = new URL('../', import.meta.url);
const codes = (arg('--codes', null)?.split(',') ?? readdirSync(new URL('data/flags/', root)).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5))).sort();

const BG = [0xe9, 0xe9, 0xe9];
const FULL_H = 48;
const cols = [
  { dir: 'original', label: 'original', h: FULL_H },
  { dir: '3x2', label: '3:2', h: FULL_H },
  { dir: '1x1', label: '1:1', h: FULL_H },
  { dir: 'mini/square-16', label: '□ 16' },
  { dir: 'mini/square-24', label: '□ 24' },
  { dir: 'mini/square-40', label: '□ 40' },
  { dir: 'mini/circle-16', label: '○ 16' },
  { dir: 'mini/circle-24', label: '○ 24' },
  { dir: 'mini/circle-40', label: '○ 40' },
  { dir: 'mini/rect-24x16', label: '3:2 · 16' },
  { dir: 'mini/rect-36x24', label: '3:2 · 24' },
  { dir: 'mini/rect-60x40', label: '3:2 · 40' },
  { dir: 'mini/square-16', label: '□ 16 ×4', zoom: 4 },
  { dir: 'mini/circle-16', label: '○ 16 ×4', zoom: 4 },
  { dir: 'mini/rect-24x16', label: '3:2 · 16 ×4', zoom: 4 },
];

function render(svg, scale) {
  const r = new Resvg(svg, { fitTo: { mode: 'zoom', value: scale }, background: 'rgba(0,0,0,0)', font: { loadSystemFonts: false } });
  const img = r.render();
  return { w: img.width, h: img.height, px: img.pixels };
}

function zoomNearest(img, k) {
  const w = img.w * k;
  const h = img.h * k;
  const px = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const s = ((Math.floor(y / k) * img.w + Math.floor(x / k)) * 4);
      const d = (y * w + x) * 4;
      img.px.copy(px, d, s, s + 4);
    }
  return { w, h, px };
}

function text(s, size = 11, weight = 400, color = '#222') {
  const esc = s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(s.length * size * 0.62) + 4}" height="${size + 6}"><text x="1" y="${size}" font-size="${size}" font-weight="${weight}" font-family="Inter, DejaVu Sans, sans-serif" fill="${color}">${esc}</text></svg>`;
  const r = new Resvg(svg, { font: { loadSystemFonts: true }, fitTo: { mode: 'zoom', value: S } });
  const img = r.render();
  return { w: img.width, h: img.height, px: img.pixels };
}

// Рендерим всё заранее, чтобы посчитать ширины колонок.
const cells = codes.map((code) => {
  const meta = JSON.parse(readFileSync(new URL(`data/flags/${code}.json`, root), 'utf8'));
  return cols.map((c) => {
    const f = new URL(`${c.dir}/${code}.svg`, base);
    if (!existsSync(f)) return null;
    const svg = readFileSync(f, 'utf8');
    const m = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
    const vbH = Number(m[2]);
    let img;
    if (c.zoom) img = zoomNearest(render(svg, 1), c.zoom * S);
    else img = render(svg, c.h ? (c.h / vbH) * S : S);
    const full = ['original', '3x2', '1x1'].includes(c.dir);
    const draft = full ? meta.status.full.startsWith('draft') : meta.status.mini !== 'ok';
    return { img, draft, meta };
  });
});

const pad = 10 * S;
const gap = 14 * S;
const labelW = 44 * S;
const colW = cols.map((_, j) => Math.max(...cells.map((r) => r[j]?.img.w ?? 0), 0));
const rowH = cells.map((r) => Math.max(...r.map((c) => c?.img.h ?? 0)));
const headH = 22 * S;
const W = pad * 2 + labelW + colW.reduce((a, b) => a + b + gap, 0);
const H = pad * 2 + headH + rowH.reduce((a, b) => a + b + gap * 0.8, 0);
const png = new PNG({ width: Math.ceil(W), height: Math.ceil(H) });
for (let i = 0; i < png.width * png.height; i++) png.data.set([...BG, 255], i * 4);

function blit(img, x0, y0) {
  x0 = Math.round(x0);
  y0 = Math.round(y0);
  for (let y = 0; y < img.h; y++)
    for (let x = 0; x < img.w; x++) {
      const s = (y * img.w + x) * 4;
      const a = img.px[s + 3] / 255;
      if (!a) continue;
      const X = x0 + x;
      const Y = y0 + y;
      if (X < 0 || Y < 0 || X >= png.width || Y >= png.height) continue;
      const d = (Y * png.width + X) * 4;
      // resvg отдаёт премультиплицированные значения
      for (let k = 0; k < 3; k++) png.data[d + k] = Math.round(img.px[s + k] + png.data[d + k] * (1 - a));
    }
}
function corner(x0, y0) {
  for (let y = 0; y < 6 * S; y++) for (let x = 0; x < 6 * S - y; x++) {
    const d = ((Math.round(y0) + y) * png.width + Math.round(x0) + x) * 4;
    png.data.set([0xd0, 0x10, 0x30, 255], d);
  }
}

let x = pad + labelW;
cols.forEach((c, j) => {
  blit(text(c.label, 10, 500, '#555'), x, pad);
  x += colW[j] + gap;
});
let y = pad + headH;
cells.forEach((row, i) => {
  blit(text(codes[i], 12, 600), pad, y + rowH[i] / 2 - 9 * S);
  let x = pad + labelW;
  row.forEach((c, j) => {
    if (c) {
      blit(c.img, x, y + (rowH[i] - c.img.h) / 2);
      if (c.draft) corner(x - 3 * S, y + (rowH[i] - c.img.h) / 2 - 3 * S);
    }
    x += colW[j] + gap;
  });
  y += rowH[i] + gap * 0.8;
});

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, PNG.sync.write(png));
console.log(`Лист: ${out} (${png.width}×${png.height})`);
