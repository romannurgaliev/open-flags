// Shared building blocks for flags: geometry on paper.js (curves survive boolean
// operations), pixel-grid snapping, Union Jack, stars, map silhouettes.

import paper from 'paper-jsdom';
import { readFileSync } from 'node:fs';
import { feature } from 'topojson-client';

paper.setup(new paper.Size(1000, 1000));
const P = paper;
const opt = { insert: false };

export const rect = (x, y, w, h) => new P.Path.Rectangle({ from: [x, y], to: [x + w, y + h], ...opt });
export const circle = (cx, cy, r) => new P.Path.Circle({ center: [cx, cy], radius: r, ...opt });
export const poly = (pts) => new P.Path({ segments: pts.map((p) => (Array.isArray(p) ? p : [p.x, p.y])), closed: true, ...opt });
export const ellipse = (cx, cy, rx, ry) => new P.Path.Ellipse({ center: [cx, cy], radius: [rx, ry], ...opt });
export const unite = (a, b) => (a ? a.unite(b, opt) : b);
export const sub = (a, b) => a.subtract(b, opt);
export const inter = (a, b) => a.intersect(b, opt);
export const isEmpty = (item) => !item || !item.pathData || Math.abs(item.area) < 1e-6;

// Star: n points, outer radius R, inner radius r, first point up (rot in degrees).
export function star(cx, cy, R, r, n = 5, rot = 0) {
  const pts = [];
  for (let i = 0; i < 2 * n; i++) {
    const a = ((-90 + rot + (i * 180) / n) * Math.PI) / 180;
    const rr = i % 2 === 0 ? R : r;
    pts.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]);
  }
  return poly(pts);
}
// Regular five-pointed star: r/R = 0.381966.
export const star5 = (cx, cy, R, rot = 0) => star(cx, cy, R, R * 0.381966, 5, rot);

// A band along segment p→q, offset from the center line along the normal: from off0 to off1.
export function band(p, q, off0, off1, ext = 0) {
  const dx = q[0] - p[0];
  const dy = q[1] - p[1];
  const len = Math.hypot(dx, dy);
  const ux = dx / len;
  const uy = dy / len;
  const nx = -uy;
  const ny = ux;
  const a = [p[0] - ux * ext, p[1] - uy * ext];
  const b = [q[0] + ux * ext, q[1] + uy * ext];
  return poly([
    [a[0] + nx * off0, a[1] + ny * off0],
    [b[0] + nx * off0, b[1] + ny * off0],
    [b[0] + nx * off1, b[1] + ny * off1],
    [a[0] + nx * off1, a[1] + ny * off1],
  ]);
}

// ---------------------------------------------------------------------------------------------
// Pixel grid

// Splits N whole pixels by weight. The remainder is handed out symmetrically from the center: with an odd
// remainder the extra pixel goes to the central stripe, with an even one to the pairs nearest the center.
export function distribute(N, weights) {
  const n = weights.length;
  const sum = weights.reduce((a, b) => a + b, 0);
  const ideal = weights.map((w) => (N * w) / sum);
  const out = ideal.map(Math.floor);
  let rest = N - out.reduce((a, b) => a + b, 0);
  const symmetric = weights.every((w, i) => Math.abs(w - weights[n - 1 - i]) < 1e-9);
  if (symmetric) {
    const mid = (n - 1) / 2;
    const order = [...Array(n).keys()].sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid) || a - b);
    if (rest % 2 === 1 && n % 2 === 1) {
      out[mid]++;
      rest--;
    }
    // Pairs (i, n-1-i) from the center outward
    const pairs = [];
    for (const i of order) if (i < n - 1 - i) pairs.push([i, n - 1 - i]);
    let k = 0;
    while (rest >= 2 && pairs.length) {
      const [a, b] = pairs[k % pairs.length];
      out[a]++;
      out[b]++;
      rest -= 2;
      k++;
    }
    let j = 0;
    while (rest > 0) {
      out[order[j % n]]++;
      rest--;
      j++;
    }
    return out;
  }
  const byFrac = ideal.map((v, i) => [v - Math.floor(v), i]).sort((a, b) => b[0] - a[0]);
  for (let i = 0; i < rest; i++) out[byFrac[i % n][1]]++;
  return out;
}

// Nearest integer with the same parity as `parityOf` (so the shape centers without a half pixel).
export function sameParity(v, parityOf) {
  const p = Math.round(parityOf) % 2;
  const lo = Math.floor(v);
  const cands = [lo - 1, lo, lo + 1, lo + 2].filter((c) => c > 0 && ((c % 2) + 2) % 2 === p);
  return cands.sort((a, b) => Math.abs(a - v) - Math.abs(b - v))[0];
}

// Stripe reduction at small tiers: the largest n' ≤ n with the same colors at the edges
// for which every stripe is at least minPx thick.
export function reduceStripes(n, N, minPx, sameEnds) {
  for (let k = n; k >= 2; k--) {
    if (sameEnds !== (k % 2 === 1)) continue;
    if (N / k >= minPx) return k;
  }
  return sameEnds ? 3 : 2;
}

// Stripes: base is the first stripe over the whole field, the rest go on top (no seams at the joins).
export function stripes(ctx, box, dir, items) {
  const { x, y, w, h } = box;
  const len = dir === 'h' ? h : w;
  const weights = items.map((s) => s.w ?? 1);
  let sizes;
  if (ctx.px) sizes = distribute(Math.round(len), weights);
  else {
    const sum = weights.reduce((a, b) => a + b, 0);
    sizes = weights.map((v) => (len * v) / sum);
  }
  const layers = [];
  let pos = 0;
  items.forEach((s, i) => {
    const size = sizes[i];
    const shape = i === 0 ? rect(x, y, w, h) : dir === 'h' ? rect(x, y + pos, w, len - pos) : rect(x + pos, y, len - pos, h);
    layers.push({ fill: s.c, item: shape });
    pos += size;
  });
  return { layers, sizes };
}

// ---------------------------------------------------------------------------------------------
// Union Jack in a frame (x, y, w, h) of any ratio: the diagonals always run corner to corner.
// Flag Institute specification, in units of a 30-unit height: cross 6, cross fimbriation 2, saltire 6
// (broad white 3 + red 2 + narrow white 1), broad white uppermost at the hoist.
export function unionJack(ctx, box, colors, tier = null, { field = true } = {}) {
  const { x, y, w, h } = box;
  const u = h / 30;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const L = [];
  // The canton blue is drawn only if it differs from the flag's field (otherwise it is a hidden fill, C07).
  if (field) L.push({ fill: colors.blue, item: rect(x, y, w, h) });
  const clip = rect(x, y, w, h);
  const corners = [
    { p: [x, y], side: +1 }, // hoist, top: red below the center line
    { p: [x, y + h], side: +1 }, // hoist, bottom: red below the center line
    { p: [x + w, y], side: -1 }, // fly, top: red above the center line
    { p: [x + w, y + h], side: -1 },
  ];
  // Widths by tier: at small sizes the red saltire disappears (under 1 px).
  let wSalt = 6 * u;
  let wRed = 2 * u;
  let wCross = 10 * u;
  let wRedCross = 6 * u;
  let redSaltire = true;
  if (ctx.px) {
    wRedCross = Math.max(2, sameParity(6 * u, h));
    wCross = Math.max(wRedCross + 2, sameParity(10 * u, h));
    wSalt = Math.max(1.5, Math.round(6 * u));
    wRed = Math.max(1, Math.round(2 * u));
    redSaltire = tier === 'L';
  }
  const white = [];
  for (const c of corners) white.push(band(c.p, [cx, cy], -wSalt / 2, wSalt / 2, 2 * h));
  let sal = white.reduce((a, b) => unite(a, b));
  L.push({ fill: colors.white, item: inter(sal, clip) });
  if (redSaltire) {
    for (const c of corners) {
      // band()'s normal is the direction rotated by +90°. For arms running from the left corners to the center (+x)
      // the normal points down (+y); for the right ones, up. side=+1: red on the +y side.
      const goesRight = c.p[0] < cx;
      const normalDown = goesRight; // for arms going right, the normal (−uy, ux) points down
      const wantDown = c.side === +1;
      const sgn = normalDown === wantDown ? 1 : -1;
      const arm = band(c.p, [cx, cy], 0, sgn * wRed, 0);
      const quad = rect(Math.min(c.p[0], cx), Math.min(c.p[1], cy), w / 2, h / 2);
      L.push({ fill: colors.red, item: inter(inter(arm, quad), clip) });
    }
  }
  const crossW = unite(rect(cx - wCross / 2, y, wCross, h), rect(x, cy - wCross / 2, w, wCross));
  L.push({ fill: colors.white, item: crossW });
  const crossR = unite(rect(cx - wRedCross / 2, y, wRedCross, h), rect(x, cy - wRedCross / 2, w, wRedCross));
  L.push({ fill: colors.red, item: crossR });
  return L;
}

// ---------------------------------------------------------------------------------------------
// Map silhouettes from Natural Earth 1:50m (public domain) via world-atlas.

const atlas = JSON.parse(readFileSync(new URL('../node_modules/world-atlas/countries-50m.json', import.meta.url), 'utf8'));
const countries = feature(atlas, atlas.objects.countries);

function ringsOf(names) {
  const rings = [];
  for (const f of countries.features) {
    if (!names.includes(f.properties.name)) continue;
    const g = f.geometry;
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
    for (const p of polys) rings.push(p[0]);
  }
  return rings;
}

// Douglas–Peucker simplification.
function dp(pts, eps) {
  if (pts.length < 3) return pts;
  let max = 0;
  let idx = 0;
  const [a, b] = [pts[0], pts[pts.length - 1]];
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i];
    const num = Math.abs((b[1] - a[1]) * p[0] - (b[0] - a[0]) * p[1] + b[0] * a[1] - b[1] * a[0]);
    const d = num / (Math.hypot(b[1] - a[1], b[0] - a[0]) || 1);
    if (d > max) {
      max = d;
      idx = i;
    }
  }
  if (max > eps) return [...dp(pts.slice(0, idx + 1), eps).slice(0, -1), ...dp(pts.slice(idx), eps)];
  return [a, b];
}

// Map fitted to the width or height of a frame; eps is the simplification tolerance in frame units;
// islands smaller than minArea (in square frame units) are dropped.
export function mapShape(names, box, { eps = 0, minArea = 0, fit = 'contain' } = {}) {
  const rings = ringsOf(names);
  const lat0 = rings.flat().reduce((s, p) => s + p[1], 0) / rings.flat().length;
  const k = Math.cos((lat0 * Math.PI) / 180);
  const proj = rings.map((r) => r.map(([lon, lat]) => [lon * k, -lat]));
  const all = proj.flat();
  const minX = Math.min(...all.map((p) => p[0]));
  const maxX = Math.max(...all.map((p) => p[0]));
  const minY = Math.min(...all.map((p) => p[1]));
  const maxY = Math.max(...all.map((p) => p[1]));
  const s = fit === 'width' ? box.w / (maxX - minX) : Math.min(box.w / (maxX - minX), box.h / (maxY - minY));
  const ox = box.x + (box.w - (maxX - minX) * s) / 2;
  const oy = box.y + (box.h - (maxY - minY) * s) / 2;
  let shape = null;
  for (const r of proj) {
    let pts = r.map(([px, py]) => [ox + (px - minX) * s, oy + (py - minY) * s]);
    if (eps) {
      // The ring is closed (first point = last): split it at the farthest point into two
      // polylines and simplify each; otherwise Douglas–Peucker has no baseline.
      const a = pts[0];
      let far = 1;
      let fd = 0;
      pts.forEach((p, i) => {
        const d = Math.hypot(p[0] - a[0], p[1] - a[1]);
        if (d > fd) {
          fd = d;
          far = i;
        }
      });
      pts = [...dp(pts.slice(0, far + 1), eps).slice(0, -1), ...dp(pts.slice(far), eps)];
    }
    if (pts.length < 3) continue;
    const p = poly(pts);
    if (Math.abs(p.area) < minArea) continue;
    shape = shape ? unite(shape, p) : p;
  }
  return shape;
}

// ---------------------------------------------------------------------------------------------
// Shields, crescent, "lines of text"

export function shield(x, y, w, h) {
  const top = y;
  const mid = y + h * 0.55;
  const bot = y + h;
  const p = new P.Path({ ...opt });
  p.moveTo([x, top]);
  p.lineTo([x + w, top]);
  p.lineTo([x + w, mid]);
  p.cubicCurveTo([x + w, y + h * 0.82], [x + w * 0.62, y + h * 0.95], [x + w / 2, bot]);
  p.cubicCurveTo([x + w * 0.38, y + h * 0.95], [x, y + h * 0.82], [x, mid]);
  p.closePath();
  return p;
}

export function crescent(cx, cy, R, r, dx, dy = 0) {
  return sub(circle(cx, cy, R), circle(cx + dx, cy + dy, r));
}

export function roundedBar(x, y, w, h) {
  return new P.Path.Rectangle({ rectangle: new P.Rectangle(x, y, w, h), radius: Math.min(w, h) / 2, ...opt });
}

// Pulls a point shape inside the circle (cx, cy, R) so that its bounds stay at least margin
// away from the edge. Used for circles: charges near the flag's edge must not be cut.
export function pullInside(item, cx, cy, R, margin) {
  const b = item.bounds;
  const r = Math.max(b.width, b.height) / 2;
  const c = b.center;
  const d = Math.hypot(c.x - cx, c.y - cy);
  const lim = R - r - margin;
  if (d <= lim || d === 0) return item;
  const k = lim / d;
  item.translate([(cx + (c.x - cx) * k) - c.x, (cy + (c.y - cy) * k) - c.y]);
  return item;
}

export { P as paper };
