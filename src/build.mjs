#!/usr/bin/env node
// Builds every pilot format from data/flags/*.json into flags/.
//
// Usage: node src/build.mjs [CODE ...]
//
// Formats:
//   flags/original/CODE.svg      original aspect ratio, height near 600
//   flags/3x2/CODE.svg           900×600
//   flags/mini/rect-24x16/CODE.svg    tier S
//   flags/mini/rect-36x24/CODE.svg    tier M
//   flags/mini/circle-24/CODE.svg     tier M
//   flags/mini/circle-40/CODE.svg     tier L
// Plus overlays/: outlines for flags with white edges, kept separate from the flags.

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
  rectSpec('S'),
  rectSpec('M'),
  circleSpec('M'),
  circleSpec('L'),
];

// Specs for any shape and tier. Only the ones in FORMATS are published; the rest are kept
// for tests (a square stands in for "a circle exported without its clip") and for adding
// a format later.
export function rectSpec(tier) {
  const s = TIERS[tier];
  return { fmt: 'rect', tier, dir: `mini/rect-${s * 1.5}x${s}`, W: s * 1.5, H: s };
}
export function circleSpec(tier) {
  const s = TIERS[tier];
  return { fmt: 'circle', tier, dir: `mini/circle-${s}`, W: s, H: s };
}
export function squareSpec(tier) {
  const s = TIERS[tier];
  return { fmt: 'square', tier, dir: `mini/square-${s}`, W: s, H: s };
}

export function loadMeta(code) {
  return JSON.parse(readFileSync(new URL(`data/flags/${code}.json`, root), 'utf8'));
}

export function allCodes() {
  return readdirSync(new URL('data/flags/', root))
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.slice(0, -5))
    .sort();
}

// The original width and height are integers: the Figma export rounds the viewBox, and a fractional width
// shifts the content. The height is the number nearest 600 for which the width from the ratio is an integer.
// Nepal's ratio is irrational: the width is rounded (error < 0.1%, which C14 allows).
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
  if (nulls.length) throw new Error(`${code} ${spec.dir}: empty layer ${nulls.map((l) => l.fill).join(', ')}`);
  // Everything outside the canvas (circle or rectangle) is cut off geometrically; otherwise Figma,
  // with clipping off, grows the export to fit shapes that stick out (as happened with VA).
  const canvas = ctx.circle ? circle(size.W / 2, size.H / 2, size.W / 2) : rect(0, 0, size.W, size.H);
  layers = layers.map((l) => ({ ...l, item: inter(l.item, canvas) }));
  layers = layers.filter((l) => !isEmpty(l.item));
  for (const l of layers) {
    if (!colors[l.fill]) throw new Error(`${code} ${spec.dir}: color "${l.fill}" is not defined in metadata.colors`);
  }
  return toSvg(layers.map((l) => ({ ...l, hex: colors[l.fill] })), size.W, size.H, { precision: ctx.px ? 3 : 2, title: `${meta.names?.en ?? code}` });
}

function overlays() {
  // A 1 px inner outline for flags with a white edge: laid on top, not baked into the flag.
  const out = new URL('overlays/', root);
  mkdirSync(out, { recursive: true });
  for (const spec of FORMATS.filter((f) => f.tier)) {
    const s = spec.H;
    const ringC = `M${s / 2} 0A${s / 2} ${s / 2} 0 1 1 ${s / 2} ${s}A${s / 2} ${s / 2} 0 1 1 ${s / 2} 0Z M${s / 2} 1A${s / 2 - 1} ${s / 2 - 1} 0 1 0 ${s / 2} ${s - 1}A${s / 2 - 1} ${s / 2 - 1} 0 1 0 ${s / 2} 1Z`;
    const w = spec.W;
    const ringR = `M0 0H${w}V${s}H0Z M1 1V${s - 1}H${w - 1}V1Z`;
    const svg = (W, H, d) => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><path fill="#000" fill-opacity="0.12" fill-rule="evenodd" d="${d}"/></svg>\n`;
    const name = spec.dir.replace('mini/', '');
    writeFileSync(new URL(`${name}.svg`, out), svg(w, s, spec.fmt === 'circle' ? ringC : ringR));
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
  console.log(`Built ${n} files: ${codes.length} flags × ${FORMATS.length} formats.`);
}
