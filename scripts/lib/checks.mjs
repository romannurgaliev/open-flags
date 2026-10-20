// Flag checks. Each check is a function that returns a list of problems { id, msg }.
// The same functions are used by CI (scripts/check.mjs) and by the negative tests (scripts/negative.mjs).
//
//  C01 inventory   a file exists for every country and format, and there are no extra files
//  C02 xml         valid XML, root <svg> with xmlns
//  C03 viewbox     viewBox "0 0 W H"; width and height match the format
//  C04 forbidden   no text, image, use, clipPath, mask, filter, style, script, foreignObject elements,
//                  no stroke*, clip-path, mask, filter, transform, href, opacity attributes
//  C05 paths       every path has an explicit fill (#RRGGBB) and fill-rule, all subpaths are closed (Z),
//                  a path with several subpaths must use fill-rule="evenodd"
//  C06 palette     every fill is a color from the flag's metadata
//  C07 hidden      every path changes at least one pixel (no hidden fills)
//  C08 coverage    a rectangle is fully covered; a circle has nothing drawn outside it and no holes inside
//  C09 probes      probe points from the metadata: color within ΔE2000 ≤ 3
//  C11 grid        rectilinear flags have no mixed pixels in miniatures (pixel grid)
//  C12 budget      file size within budget
//  C13 meta        metadata: required fields, source references, colors
//  C14 ratio       the original aspect ratio matches the metadata
//  C15 diff        visual diff against the previous release baseline (report, not a failure)
//  C16 bounds      geometry stays inside the viewBox (otherwise the Figma export grows the frame)

import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { Resvg } from '@resvg/resvg-js';
import { hexToLab, rgbToLab, deltaE2000 } from '../../src/color.mjs';

export const BUDGET = { mini: 6 * 1024, full: 40 * 1024 };
const FORBIDDEN_TAGS = ['text', 'tspan', 'image', 'use', 'clipPath', 'mask', 'filter', 'style', 'script', 'foreignObject', 'pattern', 'linearGradient', 'radialGradient', 'symbol'];
const FORBIDDEN_ATTRS = /^(stroke.*|clip-path|clip-rule|mask|filter|transform|href|xlink:href|opacity|fill-opacity|style)$/;
const GRID_CLASSES = new Set(['bicolor-h', 'tricolor-v', 'cross']);
const GRID_CODES = new Set(['US']);

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', preserveOrder: true });

export function render(svg, scale = 1) {
  const r = new Resvg(svg, { fitTo: { mode: 'zoom', value: scale }, background: 'rgba(0,0,0,0)', shapeRendering: 2, font: { loadSystemFonts: false } });
  const img = r.render();
  return { w: img.width, h: img.height, px: img.pixels };
}

// Walks a preserveOrder tree; returns [{ tag, attrs }]
function walk(nodes, out = []) {
  for (const n of nodes) {
    const tag = Object.keys(n).find((k) => k !== ':@');
    if (!tag || tag === '#text') continue;
    out.push({ tag, attrs: n[':@'] ?? {} });
    if (Array.isArray(n[tag])) walk(n[tag], out);
  }
  return out;
}

export function expectedSize(spec, meta, originalSize) {
  return spec.fmt === 'original' ? originalSize(meta) : { W: spec.W, H: spec.H };
}

export function lint(svg, spec, meta, size) {
  const p = [];
  const v = XMLValidator.validate(svg);
  if (v !== true) return [{ id: 'C02', msg: `invalid XML: ${v.err.msg}` }];
  const els = walk(parser.parse(svg));
  const root = els[0];
  if (!root || root.tag !== 'svg') return [{ id: 'C02', msg: 'root is not <svg>' }];
  if (root.attrs.xmlns !== 'http://www.w3.org/2000/svg') p.push({ id: 'C02', msg: 'missing xmlns' });
  const vb = (root.attrs.viewBox ?? '').trim().split(/[\s,]+/).map(Number);
  const close = (a, b) => Math.abs(a - b) < 0.011;
  if (vb.length !== 4 || vb[0] !== 0 || vb[1] !== 0 || !close(vb[2], size.W) || !close(vb[3], size.H)) {
    p.push({ id: 'C03', msg: `viewBox "${root.attrs.viewBox}", expected "0 0 ${size.W} ${size.H}"` });
  }
  if (!close(Number(root.attrs.width), size.W) || !close(Number(root.attrs.height), size.H)) {
    p.push({ id: 'C03', msg: `width×height ${root.attrs.width}×${root.attrs.height}, expected ${size.W}×${size.H}` });
  }
  const palette = new Set(Object.values(meta.colors).map((c) => c.srgb.toUpperCase()));
  let paths = 0;
  for (const el of els) {
    if (FORBIDDEN_TAGS.includes(el.tag)) p.push({ id: 'C04', msg: `forbidden element <${el.tag}>` });
    for (const a of Object.keys(el.attrs)) if (FORBIDDEN_ATTRS.test(a)) p.push({ id: 'C04', msg: `forbidden attribute ${a} on <${el.tag}>` });
    if (el.tag === 'path') {
      paths++;
      const fill = el.attrs.fill;
      if (!/^#[0-9A-Fa-f]{6}$/.test(fill ?? '')) p.push({ id: 'C05', msg: `path without an explicit #RRGGBB fill (fill="${fill}")` });
      else if (!palette.has(fill.toUpperCase())) p.push({ id: 'C06', msg: `color ${fill} is not in the flag's palette` });
      const rule = el.attrs['fill-rule'];
      if (!rule) p.push({ id: 'C05', msg: 'path without an explicit fill-rule' });
      const d = el.attrs.d ?? '';
      const subs = d.split(/(?=[Mm])/).filter((s) => s.trim());
      if (!subs.length) p.push({ id: 'C05', msg: 'empty path' });
      for (const s of subs) if (!/[Zz]\s*$/.test(s)) p.push({ id: 'C05', msg: `unclosed subpath: ${s.slice(0, 40)}…` });
      if (subs.length > 1 && rule !== 'evenodd') p.push({ id: 'C05', msg: `path of ${subs.length} subpaths with fill-rule="${rule ?? 'default'}": rings will render as discs` });
    } else if (!['svg', 'title', 'desc', 'g'].includes(el.tag) && !FORBIDDEN_TAGS.includes(el.tag)) {
      p.push({ id: 'C04', msg: `unexpected element <${el.tag}> (allowed: svg, title, desc, g, path)` });
    }
  }
  if (!paths) p.push({ id: 'C05', msg: 'no path elements' });
  const budget = spec.tier ? BUDGET.mini : (meta.budget ?? BUDGET.full);
  const bytes = Buffer.byteLength(svg);
  if (bytes > budget) p.push({ id: 'C12', msg: `size ${bytes} B exceeds the ${budget} B budget` });
  return p;
}

// Pixel checks
export function pixels(svg, spec, meta, size) {
  const p = [];
  const scale = spec.tier ? 1 : Math.min(1, 300 / size.H);
  let img;
  try {
    img = render(svg, scale);
  } catch (e) {
    return [{ id: 'C02', msg: `does not render: ${e.message}` }];
  }
  const { w, h, px } = img;
  const shape = meta.ratio?.shape;
  // C08 coverage
  if (!shape) {
    let holes = 0;
    let outside = 0;
    const R = w / 2;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const a = px[(y * w + x) * 4 + 3];
        if (spec.fmt === 'circle') {
          const d = Math.hypot(x + 0.5 - R, y + 0.5 - R);
          if (d > R + 0.75 && a > 0) outside++;
          if (d < R - 1.25 && a < 250) holes++;
        } else if (a < 250) holes++;
      }
    if (outside) p.push({ id: 'C08', msg: `${outside} px drawn outside the circle (exported as a square?)` });
    if (holes) p.push({ id: 'C08', msg: `${holes} transparent or semi-transparent px inside the shape` });
  }
  // C11 grid
  const gridStrict = spec.tier && spec.fmt !== 'circle' && (GRID_CODES.has(meta.code) || (meta.classes ?? []).every((c) => GRID_CLASSES.has(c) || c === 'square' || c === 'white-edge'));
  if (gridStrict) {
    const pal = Object.values(meta.colors).map((c) => hexToLab(c.srgb));
    let mixed = 0;
    for (let i = 0; i < w * h; i++) {
      const lab = rgbToLab([px[i * 4], px[i * 4 + 1], px[i * 4 + 2]]);
      const best = Math.min(...pal.map((q) => deltaE2000(lab, q)));
      if (best > 3) mixed++;
    }
    if (mixed) p.push({ id: 'C11', msg: `${mixed} mixed pixels: edges are off the pixel grid` });
  }
  return p;
}

// C07: a path whose removal does not change the image is a hidden fill.
export function hidden(svg, spec, size) {
  const p = [];
  const scale = spec.tier ? 2 : Math.min(1, 200 / size.H);
  const base = render(svg, scale).px;
  const re = /<path\b[^>]*\/>/g;
  const all = [...svg.matchAll(re)];
  all.forEach((m, i) => {
    const without = svg.slice(0, m.index) + svg.slice(m.index + m[0].length);
    const img = render(without, scale).px;
    let diff = 0;
    for (let k = 0; k < base.length; k += 4) {
      if (Math.abs(base[k] - img[k]) + Math.abs(base[k + 1] - img[k + 1]) + Math.abs(base[k + 2] - img[k + 2]) + Math.abs(base[k + 3] - img[k + 3]) > 8) {
        diff++;
        break;
      }
    }
    if (!diff) p.push({ id: 'C07', msg: `path #${i + 1} (${(m[0].match(/fill="([^"]+)"/) ?? [])[1]}) changes nothing in the render: hidden fill` });
  });
  return p;
}

// C09: probe points in the original format
export function probes(svg, meta, size) {
  const p = [];
  if (!meta.probes?.length) return [{ id: 'C09', msg: 'no probe points in the metadata' }];
  const img = render(svg, 1);
  for (const pr of meta.probes) {
    const x = Math.min(img.w - 1, Math.floor(pr.at[0] * img.w));
    const y = Math.min(img.h - 1, Math.floor(pr.at[1] * img.h));
    const i = (y * img.w + x) * 4;
    const a = img.px[i + 3];
    if (pr.color === 'transparent') {
      if (a > 5) p.push({ id: 'C09', msg: `point ${pr.at} (${pr.why}): expected transparent` });
      continue;
    }
    const want = meta.colors[pr.color]?.srgb;
    if (!want) {
      p.push({ id: 'C09', msg: `point ${pr.at}: color ${pr.color} is not defined` });
      continue;
    }
    if (a < 250) {
      p.push({ id: 'C09', msg: `point ${pr.at} (${pr.why}): transparent, expected ${pr.color}` });
      continue;
    }
    const got = [img.px[i], img.px[i + 1], img.px[i + 2]];
    const d = deltaE2000(rgbToLab(got), hexToLab(want));
    if (d > 3) p.push({ id: 'C09', msg: `point ${pr.at} (${pr.why}): ΔE2000 ${d.toFixed(1)} from ${pr.color} ${want}, got rgb(${got.join(',')})` });
  }
  return p;
}

// C14: original aspect ratio
export function ratio(svg, meta) {
  const m = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
  if (!m) return [{ id: 'C14', msg: 'no viewBox' }];
  const r = Number(m[1]) / Number(m[2]);
  const want = meta.ratio.shape ? meta.ratio.w_over_h : meta.ratio.w / meta.ratio.h;
  return Math.abs(r - want) / want > 0.001 ? [{ id: 'C14', msg: `ratio ${r.toFixed(4)}, metadata says ${want.toFixed(4)}` }] : [];
}

// C13: metadata
export function metaCheck(meta, globalSources) {
  const p = [];
  const need = ['code', 'iso', 'names', 'classes', 'ratio', 'adopted', 'sources', 'colors', 'construction', 'probes', 'simplification', 'confusable', 'gaps', 'review', 'status'];
  for (const k of need) if (!(k in meta)) p.push({ id: 'C13', msg: `missing field ${k}` });
  const known = new Set([...Object.keys(meta.sources ?? {}), ...Object.keys(globalSources)]);
  const refs = [];
  for (const [k, c] of Object.entries(meta.colors ?? {})) {
    if (!/^#[0-9A-F]{6}$/.test(c.srgb ?? '')) p.push({ id: 'C13', msg: `color ${k}: srgb is not #RRGGBB` });
    if (!['ok', 'provisional', 'conflict'].includes(c.status)) p.push({ id: 'C13', msg: `color ${k}: status "${c.status}"` });
    if (!/^C-[A-Z0-9-]+$/.test(c.rule ?? '')) p.push({ id: 'C13', msg: `color ${k}: no selection rule (rule)` });
    for (const s of c.specs ?? []) refs.push(s.src);
  }
  refs.push(meta.ratio?.source, meta.adopted?.source);
  for (const r of refs.filter(Boolean)) if (!known.has(r) && r !== 'estimate') p.push({ id: 'C13', msg: `reference to unknown source "${r}"` });
  for (const pr of meta.probes ?? []) if (pr.color !== 'transparent' && !meta.colors?.[pr.color]) p.push({ id: 'C13', msg: `probe point refers to undefined color ${pr.color}` });
  for (const [id, s] of Object.entries(meta.sources ?? {})) {
    if (s.ref) continue;
    if (![1, '1g', 2, 3, 4, 5].includes(s.level)) p.push({ id: 'C13', msg: `source ${id}: level ${s.level}` });
    if (!s.accessed) p.push({ id: 'C13', msg: `source ${id}: no access date` });
  }
  if (!['ok', 'ok-estimate', 'draft'].includes(meta.status?.full)) p.push({ id: 'C13', msg: `status.full "${meta.status?.full}"` });
  if (!['ok', 'draft', 'blocked-review'].includes(meta.status?.mini)) p.push({ id: 'C13', msg: `status.mini "${meta.status?.mini}"` });
  return p;
}

// C15: diff against the baseline (PNGs in baseline/). Returns the number of differing pixels.
export function diffCount(svg, basePng, PNG, pixelmatch, scale) {
  const img = render(svg, scale);
  const b = PNG.sync.read(basePng);
  if (b.width !== img.w || b.height !== img.h) return Infinity;
  return pixelmatch(img.px, b.data, null, img.w, img.h, { threshold: 0.05 });
}

// Path bounds from anchor and control points (a Bézier curve lies within its control points,
// so going off-canvas by them is a reason to look; for straight segments the bound is exact).
export function pathBounds(d) {
  const toks = d.match(/[MmLlHhVvCcSsQqTtAaZz]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g) ?? [];
  let i = 0, cmd = '', x = 0, y = 0, sx = 0, sy = 0;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const add = (px, py) => { minX = Math.min(minX, px); maxX = Math.max(maxX, px); minY = Math.min(minY, py); maxY = Math.max(maxY, py); };
  const num = () => Number(toks[i++]);
  while (i < toks.length) {
    if (/[A-Za-z]/.test(toks[i])) cmd = toks[i++];
    const rel = cmd === cmd.toLowerCase();
    const C = cmd.toUpperCase();
    if (C === 'Z') { x = sx; y = sy; continue; }
    if (C === 'H') { x = (rel ? x : 0) + num(); add(x, y); continue; }
    if (C === 'V') { y = (rel ? y : 0) + num(); add(x, y); continue; }
    const n = { M: 1, L: 1, T: 1, S: 2, Q: 2, C: 3, A: 0 }[C];
    if (C === 'A') { num(); num(); num(); num(); num(); const nx = (rel ? x : 0) + num(); const ny = (rel ? y : 0) + num(); x = nx; y = ny; add(x, y); continue; }
    let lx = x, ly = y;
    for (let k = 0; k < n; k++) { lx = (rel ? x : 0) + num(); ly = (rel ? y : 0) + num(); add(lx, ly); }
    x = lx; y = ly;
    if (C === 'M') { sx = x; sy = y; cmd = rel ? 'l' : 'L'; }
  }
  return { minX, minY, maxX, maxY };
}

export function bounds(svg, size) {
  const p = [];
  const tol = 0.01;
  [...svg.matchAll(/<path\b[^>]*\sd="([^"]+)"/g)].forEach((m, k) => {
    const b = pathBounds(m[1]);
    if (b.minX < -tol || b.minY < -tol || b.maxX > size.W + tol || b.maxY > size.H + tol) {
      p.push({ id: 'C16', msg: `path #${k + 1} extends beyond the canvas: x ${b.minX.toFixed(2)}…${b.maxX.toFixed(2)}, y ${b.minY.toFixed(2)}…${b.maxY.toFixed(2)} on ${size.W}×${size.H}` });
    }
  });
  return p;
}
