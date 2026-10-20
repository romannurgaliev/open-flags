#!/usr/bin/env node
// Собирает все форматы пилота из data/flags/*.json в flags/.
//
// Запуск: node src/build.mjs [CODE ...]
//
// Форматы:
//   flags/original/CODE.svg      исходная пропорция, высота 600
//   flags/3x2/CODE.svg           900×600
//   flags/1x1/CODE.svg           600×600
//   flags/mini/square-{16,24,40}/CODE.svg
//   flags/mini/circle-{16,24,40}/CODE.svg
//   flags/mini/rect-{24x16,36x24,60x40}/CODE.svg
// Плюс overlays/ — контуры для белых краёв, отдельно от флагов.

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { build } from './flags.mjs';
import { circle, rect, inter, isEmpty } from './kit.mjs';
import { nepalFrame } from './np.mjs';
import { toSvg } from './svg.mjs';

const root = new URL('../', import.meta.url);
export const TIERS = { S: 16, M: 24, L: 40 };
export const FORMATS = [
  { fmt: 'original', dir: 'original' },
  { fmt: '3x2', dir: '3x2', W: 900, H: 600 },
  { fmt: '1x1', dir: '1x1', W: 600, H: 600 },
  ...Object.entries(TIERS).map(([tier, s]) => ({ fmt: 'square', tier, dir: `mini/square-${s}`, W: s, H: s })),
  ...Object.entries(TIERS).map(([tier, s]) => ({ fmt: 'circle', tier, dir: `mini/circle-${s}`, W: s, H: s })),
  ...Object.entries(TIERS).map(([tier, s]) => ({ fmt: 'rect', tier, dir: `mini/rect-${s * 1.5}x${s}`, W: s * 1.5, H: s })),
];

export function loadMeta(code) {
  return JSON.parse(readFileSync(new URL(`data/flags/${code}.json`, root), 'utf8'));
}

export function allCodes() {
  return readdirSync(new URL('data/flags/', root))
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.slice(0, -5))
    .sort();
}

// Ширина и высота original — целые: экспорт Figma округляет viewBox до целого, а дробная ширина
// даёт сдвиг содержимого. Высота — ближайшее к 600 число, при котором ширина по пропорции целая.
// У Непала пропорция иррациональна: ширина округляется (ошибка < 0.1%, C14 это допускает).
export function originalSize(meta) {
  if (meta.ratio.shape === 'pennant') return { W: Math.round(600 * nepalFrame().w), H: 600 };
  const { w, h } = meta.ratio;
  for (let d = 0; d < 200; d++) {
    for (const H of [600 + d, 600 - d]) {
      if ((H * w) % h === 0) return { W: (H * w) / h, H };
    }
  }
  return { W: Math.round((600 * w) / h), H: 600 };
}

export function renderFlag(code, spec, meta = loadMeta(code)) {
  const size = spec.fmt === 'original' ? originalSize(meta) : { W: spec.W, H: spec.H };
  const colors = Object.fromEntries(Object.entries(meta.colors).map(([k, v]) => [k, v.srgb]));
  const ctx = {
    fmt: spec.fmt,
    tier: spec.tier ?? null,
    W: size.W,
    H: size.H,
    px: Boolean(spec.tier),
    circle: spec.fmt === 'circle',
    k: meta.construction,
    c: colors,
  };
  let layers = build(code, ctx);
  const nulls = layers.filter((l) => !l.item);
  if (nulls.length) throw new Error(`${code} ${spec.dir}: пустой слой ${nulls.map((l) => l.fill).join(', ')}`);
  // Всё, что вне холста (круга или прямоугольника), отрезается геометрически: иначе Figma
  // при выключенной обрезке расширяет экспорт под вылезающие фигуры (так было у VA).
  const canvas = ctx.circle ? circle(size.W / 2, size.H / 2, size.W / 2) : rect(0, 0, size.W, size.H);
  layers = layers.map((l) => ({ ...l, item: inter(l.item, canvas) }));
  layers = layers.filter((l) => !isEmpty(l.item));
  for (const l of layers) {
    if (!colors[l.fill]) throw new Error(`${code} ${spec.dir}: цвет "${l.fill}" не описан в metadata.colors`);
  }
  return toSvg(layers.map((l) => ({ ...l, hex: colors[l.fill] })), size.W, size.H, { precision: ctx.px ? 3 : 2, title: `${meta.names?.en ?? code}` });
}

function overlays() {
  // Контур 1 px внутрь для флагов с белым краем: накладывается поверх, во флаг не вшивается.
  const out = new URL('overlays/', root);
  mkdirSync(out, { recursive: true });
  for (const [tier, s] of Object.entries(TIERS)) {
    const ring = `M0 0H${s}V${s}H0Z M1 1V${s - 1}H${s - 1}V1Z`;
    const ringC = `M${s / 2} 0A${s / 2} ${s / 2} 0 1 1 ${s / 2} ${s}A${s / 2} ${s / 2} 0 1 1 ${s / 2} 0Z M${s / 2} 1A${s / 2 - 1} ${s / 2 - 1} 0 1 0 ${s / 2} ${s - 1}A${s / 2 - 1} ${s / 2 - 1} 0 1 0 ${s / 2} 1Z`;
    const w = s * 1.5;
    const ringR = `M0 0H${w}V${s}H0Z M1 1V${s - 1}H${w - 1}V1Z`;
    const svg = (W, H, d) => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><path fill="#000" fill-opacity="0.12" fill-rule="evenodd" d="${d}"/></svg>\n`;
    writeFileSync(new URL(`square-${s}.svg`, out), svg(s, s, ring));
    writeFileSync(new URL(`circle-${s}.svg`, out), svg(s, s, ringC));
    writeFileSync(new URL(`rect-${w}x${s}.svg`, out), svg(w, s, ringR));
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const only = process.argv.slice(2);
  const codes = only.length ? only : allCodes();
  let n = 0;
  for (const code of codes) {
    const meta = loadMeta(code);
    for (const spec of FORMATS) {
      const svg = renderFlag(code, spec, meta);
      const dir = new URL(`flags/${spec.dir}/`, root);
      mkdirSync(dir, { recursive: true });
      writeFileSync(new URL(`${code}.svg`, dir), svg);
      n++;
    }
  }
  overlays();
  console.log(`Собрано ${n} файлов: ${codes.length} флагов × ${FORMATS.length} форматов.`);
}
