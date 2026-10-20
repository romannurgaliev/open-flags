// Построение 25 пилотных флагов. Все числа построения берутся из data/flags/<CODE>.json
// (поле construction), здесь — только правила их применения в каждом формате и ступени.
//
// ctx: { fmt: 'original'|'3x2'|'1x1'|'square'|'circle'|'rect', tier: null|'S'|'M'|'L',
//        W, H, px: boolean (true для миниатюр), circle: boolean, k: meta.construction, c: цвета }
//
// Правила унификации (docs/04-unified-and-miniature.md):
//  U1. Деления поля вдоль длины масштабируются с длиной, вдоль высоты — с высотой.
//  U2. Заряды (диски, звёзды, гербы, ширина плеч крестов) масштабируются с высотой и не растягиваются.
//  U3. Центр заряда по горизонтали — доля длины, по вертикали — доля высоты, как в источнике.
//  U4. Кантон, заданный как «четверть у древка», в 1:1 и миниатюрах становится квадратом.

import {
  rect, circle, poly, ellipse, unite, sub, inter, star, star5, band, distribute, sameParity,
  reduceStripes, stripes, unionJack, mapShape, shield, crescent, roundedBar, pullInside, paper,
} from './kit.mjs';
import { nepalFrame } from './np.mjs';

const L = (fill, item) => ({ fill, item });
const field = (ctx, fill) => L(fill, rect(0, 0, ctx.W, ctx.H));

// Диск: на сетке — целый диаметр той же чётности, что и холст по оси центрирования.
function disc(ctx, cxFrac, cyFrac, dH) {
  if (!ctx.px) return circle(cxFrac * ctx.W, cyFrac * ctx.H, (dH * ctx.H) / 2);
  const d = sameParity(dH * ctx.H, ctx.H);
  const left = Math.round(cxFrac * ctx.W - d / 2);
  const top = Math.round(cyFrac * ctx.H - d / 2);
  return circle(left + d / 2, top + d / 2, d / 2);
}

// Точечный заряд меньше 4 px рисуется пиксельной точкой (правило S-POINT).
function dot(x, y, size = 1) {
  const s = Math.max(1, Math.round(size));
  const left = Math.round(x - s / 2);
  const top = Math.round(y - s / 2);
  return rect(left, top, s, s);
}

function inCircle(ctx, item, margin = 1) {
  if (ctx.circle) pullInside(item, ctx.W / 2, ctx.H / 2, ctx.W / 2, margin);
  return item;
}

// ---------------------------------------------------------------------------------------------

const builders = {
  JP(ctx) {
    const k = ctx.k.disc;
    return [field(ctx, 'white'), L('red', disc(ctx, k.cx_l, k.cy_h, k.d_h))];
  },

  BD(ctx) {
    const k = ctx.k.disc;
    return [field(ctx, 'green'), L('red', disc(ctx, k.cx_l, k.cy_h, k.d_h))];
  },

  PW(ctx) {
    const k = ctx.k.disc;
    return [field(ctx, 'blue'), L('yellow', disc(ctx, k.cx_l, k.cy_h, k.d_h))];
  },

  CH(ctx) {
    const k = ctx.k.cross;
    const u = ctx.H / k.grid;
    let bar = k.arm_w * u;
    let arm = k.arm_l * u;
    if (ctx.px) {
      // Подбор целых: ширина плеча той же чётности, что и холст; длина плеча — ближе к 7/6.
      const best = { cost: Infinity };
      for (let b = 2; b <= ctx.H / 2; b++) {
        if (b % 2 !== ctx.H % 2) continue;
        for (let a = 2; a <= ctx.H / 2; a++) {
          const span = b + 2 * a;
          const margin = (ctx.H - span) / 2;
          if (margin < 1 || margin % 1) continue;
          const cost = Math.abs(b - bar) / bar + Math.abs(a / b - k.arm_l / k.arm_w) + Math.abs(span - (k.arm_w + 2 * k.arm_l) * u) / ctx.H;
          if (cost < best.cost) Object.assign(best, { cost, b, a });
        }
      }
      bar = best.b;
      arm = best.a;
    }
    const cx = ctx.W / 2;
    const cy = ctx.H / 2;
    const span = bar + 2 * arm;
    const cross = unite(rect(cx - bar / 2, cy - span / 2, bar, span), rect(cx - span / 2, cy - bar / 2, span, bar));
    return [field(ctx, 'red'), L('white', cross)];
  },

  PL: (ctx) => stripes(ctx, { x: 0, y: 0, w: ctx.W, h: ctx.H }, 'h', ctx.k.bands).layers,
  ID: (ctx) => stripes(ctx, { x: 0, y: 0, w: ctx.W, h: ctx.H }, 'h', ctx.k.bands).layers,
  MC: (ctx) => stripes(ctx, { x: 0, y: 0, w: ctx.W, h: ctx.H }, 'h', ctx.k.bands).layers,
  TD: (ctx) => stripes(ctx, { x: 0, y: 0, w: ctx.W, h: ctx.H }, 'v', ctx.k.bands).layers,
  RO: (ctx) => stripes(ctx, { x: 0, y: 0, w: ctx.W, h: ctx.H }, 'v', ctx.k.bands).layers,

  QA(ctx) {
    const k = ctx.k.serration;
    let bandW = k.band_l * ctx.W;
    let depth = k.depth_l * ctx.W;
    let n = k.points;
    if (ctx.px) {
      // S-REPEAT: зубцов столько, чтобы шаг был не меньше 3 px; число нечётное, как в оригинале.
      n = Math.min(k.points, Math.floor(ctx.H / 3));
      if (n % 2 === 0) n--;
      depth = Math.max(2, Math.round(depth));
      bandW = Math.round(bandW);
    }
    const pts = [[0, 0], [bandW, 0]];
    for (let i = 0; i < n; i++) {
      pts.push([bandW + depth, ((i + 0.5) * ctx.H) / n]);
      pts.push([bandW, ((i + 1) * ctx.H) / n]);
    }
    pts.push([0, ctx.H]);
    return [field(ctx, 'maroon'), L('white', poly(pts))];
  },

  US(ctx) {
    const e = ctx.k.eo10834;
    const H = ctx.H;
    const layers = [];
    if (!ctx.px) {
      layers.push(...stripes(ctx, { x: 0, y: 0, w: ctx.W, h: H }, 'h', Array.from({ length: 13 }, (_, i) => ({ c: i % 2 ? 'white' : 'red' }))).layers);
      const cw = e.D * H;
      const ch = e.C * H;
      layers.push(L('blue', rect(0, 0, cw, ch)));
      let stars = null;
      for (let row = 0; row < 9; row++) {
        for (let col = 0; col < 11; col++) {
          if ((row + col) % 2) continue;
          const s = star5(e.G * H + col * e.H * H, e.E * H + row * e.F * H, (e.K * H) / 2);
          stars = stars ? unite(stars, s) : s;
        }
      }
      layers.push(L('white', stars));
      return layers;
    }
    // Миниатюры: S-STRIPES сокращает 13 полос; кантон ложится на ближайшую границу полос;
    // звёзды — шахматное поле точек 1 px с шагом 2 px (S-POINT, S-REPEAT).
    const n = reduceStripes(13, H, 2, true);
    const st = stripes(ctx, { x: 0, y: 0, w: ctx.W, h: H }, 'h', Array.from({ length: n }, (_, i) => ({ c: i % 2 ? 'white' : 'red' })));
    layers.push(...st.layers);
    let acc = 0;
    let ch = 0;
    let best = Infinity;
    for (const s of st.sizes) {
      acc += s;
      if (Math.abs(acc - e.C * H) < best) {
        best = Math.abs(acc - e.C * H);
        ch = acc;
      }
    }
    const cw = Math.round(e.D * H);
    layers.push(L('blue', rect(0, 0, cw, ch)));
    let dots = null;
    for (let y = 1; y < ch - 1; y += 2) {
      for (let x = 1; x < cw - 1; x += 2) {
        if (((x - 1) / 2 + (y - 1) / 2) % 2) continue;
        const d = rect(x, y, 1, 1);
        dots = dots ? unite(dots, d) : d;
      }
    }
    if (dots) layers.push(L('white', dots));
    return layers;
  },

  MY(ctx) {
    const k = ctx.k;
    const H = ctx.H;
    const layers = [];
    const total = k.stripes;
    const n = ctx.px ? reduceStripes(total, H, 2, false) : total;
    const st = stripes(ctx, { x: 0, y: 0, w: ctx.W, h: H }, 'h', Array.from({ length: n }, (_, i) => ({ c: i % 2 ? 'white' : 'red' })));
    layers.push(...st.layers);
    let ch = (k.canton.h_stripes / total) * H;
    if (ctx.px) {
      let acc = 0;
      let best = Infinity;
      let pick = 0;
      for (const s of st.sizes) {
        acc += s;
        if (Math.abs(acc - ch) < best) {
          best = Math.abs(acc - ch);
          pick = acc;
        }
      }
      ch = pick;
    }
    const cw = ctx.px ? Math.round(k.canton.w_l * ctx.W) : k.canton.w_l * ctx.W;
    layers.push(L('blue', rect(0, 0, cw, ch)));
    // Символы в единицах кантона: кантон = 8 × 14 единиц (оценка, см. gaps).
    const u = ch / k.canton.units_h;
    const groupCx = (k.symbol.group_cx_u / k.canton.units_w) * cw;
    const off = groupCx - (k.symbol.group_cx_u * u);
    const X = (v) => off + v * u;
    const Y = (v) => v * u;
    const cr = k.symbol.crescent;
    const sr = k.symbol.star;
    if (!ctx.px || ctx.tier === 'L') {
      layers.push(L('yellow', crescent(X(cr.outer_cx_u), Y(cr.cy_u), (cr.outer_d_u / 2) * u, (cr.inner_d_u / 2) * u, (cr.inner_cx_u - cr.outer_cx_u) * u)));
      layers.push(L('yellow', star(X(sr.cx_u), Y(sr.cy_u), (sr.d_u / 2) * u, (sr.d_u / 2) * u * sr.inner_ratio, 14)));
    } else {
      // S/M: полумесяц не тоньше 1.5 px, звезда 8 лучей (S-POINTS).
      const R = (cr.outer_d_u / 2) * u;
      const thick = Math.max(1.5, R - (cr.inner_d_u / 2) * u + (cr.inner_cx_u - cr.outer_cx_u) * u);
      layers.push(L('yellow', crescent(X(cr.outer_cx_u), Y(cr.cy_u), R, R * 0.92, thick)));
      const sR = Math.max(1.6, (sr.d_u / 2) * u);
      layers.push(L('yellow', star(X(sr.cx_u) + 0.3, Y(sr.cy_u), sR, sR * 0.5, 8)));
    }
    return layers;
  },

  AU(ctx) {
    const k = ctx.k;
    const H = ctx.H;
    const W = ctx.W;
    const layers = [field(ctx, 'blue')];
    const square = ctx.fmt === '1x1' || ctx.fmt === 'square' || ctx.fmt === 'circle';
    const cbox = { x: 0, y: 0, w: square ? W / 2 : W / 2, h: H / 2 };
    layers.push(...unionJack(ctx, cbox, { blue: 'blue', red: 'red', white: 'white' }, ctx.tier, { field: false }));
    // Звезда Содружества: центр нижней четверти у древка.
    const cs = k.commonwealth;
    const csR = (cs.d_h * H) / 2;
    let comm = ctx.px && csR * 2 < 4 ? dot(cs.cx_l * W, cs.cy_h * H, 2) : star(cs.cx_l * W, cs.cy_h * H, csR, csR * k.inner_ratio, cs.points);
    if (ctx.px) comm = snapCenter(comm);
    layers.push(L('white', inCircle(ctx, comm)));
    // Южный Крест: смещения в долях высоты от центра вольной половины, сжатие f для узких форматов.
    const flyW = W / 2;
    const f = Math.min(1, flyW / H) * (ctx.px ? k.mini_spread[ctx.tier] ?? 1 : 1);
    const ccx = k.cross_center.cx_l * W;
    const ccy = k.cross_center.cy_h * H;
    for (const s of k.southern_cross) {
      const x = ccx + s.dx_h * H * f;
      const y = ccy + s.dy_h * H * f;
      const R = (s.d_h * H) / 2;
      let it;
      if (ctx.px && R * 2 < 4) it = dot(x, y, s.points === 5 ? 1 : 2);
      else it = star(x, y, R, R * k.inner_ratio, s.points);
      layers.push(L('white', inCircle(ctx, it)));
    }
    return layers;
  },

  NZ(ctx) {
    const k = ctx.k;
    const H = ctx.H;
    const W = ctx.W;
    const layers = [field(ctx, 'blue')];
    layers.push(...unionJack(ctx, { x: 0, y: 0, w: W / 2, h: H / 2 }, { blue: 'blue', red: 'red', white: 'white' }, ctx.tier, { field: false }));
    const f = Math.min(1, (W / 2) / H) * (ctx.px ? k.mini_spread[ctx.tier] ?? 1 : 1);
    const ccx = k.cross_center.cx_l * W;
    const ccy = k.cross_center.cy_h * H;
    for (const s of k.stars) {
      const x = ccx + s.dx_h * H * f;
      const y = ccy + s.dy_h * H * f;
      const R = (s.d_h * H) / 2;
      const b = k.border_h * H;
      if (ctx.px) {
        // S-FIMB: кайма тоньше 0.5 px на ступени снимается, звезда остаётся красной.
        // S-POINT: звезда меньше 4 px — пиксельная точка 2 px.
        if (R * 2 < 4) layers.push(L('red', inCircle(ctx, dot(x, y, 2))));
        else layers.push(L('red', inCircle(ctx, star(x, y, R, R * k.inner_ratio, 5))));
      } else {
        layers.push(L('white', star(x, y, R + b * 2.2, (R + b * 2.2) * k.inner_ratio, 5)));
        layers.push(L('red', star(x, y, R, R * k.inner_ratio, 5)));
      }
    }
    return layers;
  },

  FJ(ctx) {
    const k = ctx.k;
    const H = ctx.H;
    const W = ctx.W;
    const layers = [field(ctx, 'lightblue')];
    layers.push(...unionJack(ctx, { x: 0, y: 0, w: W / 2, h: H / 2 }, { blue: 'darkblue', red: 'red', white: 'white' }, ctx.tier));
    if (!ctx.px) return layers; // щит в полном формате — пробел (gaps)
    const sh = k.shield;
    let h = Math.round(sh.h_h * H);
    let w = Math.round(h * sh.aspect);
    const cx = sh.cx_l * W;
    const cy = sh.cy_h * H;
    const x = Math.round(cx - w / 2);
    const y = Math.round(cy - h / 2);
    const s = inCircle(ctx, shield(x, y, w, h));
    const b = s.bounds;
    layers.push(L('white', s));
    const chief = Math.max(1, Math.round(h * 0.22));
    const cross = Math.max(1, Math.round(w * 0.16));
    const mx = Math.round(b.x + b.width / 2 - cross / 2);
    layers.push(L('red', inter(unite(rect(mx, b.y + chief, cross, b.height), rect(b.x, Math.round(b.y + chief + (b.height - chief) * 0.42), b.width, cross)), s.clone({ insert: false }))));
    layers.push(L('red', rect(b.x, b.y, b.width, chief)));
    if (ctx.tier !== 'S') layers.push(L('yellow', rect(Math.round(b.x + b.width / 2 - 1), b.y, 2, Math.max(1, chief - 1))));
    return layers;
  },

  MX(ctx) {
    const k = ctx.k;
    const st = stripes(ctx, { x: 0, y: 0, w: ctx.W, h: ctx.H }, 'v', k.bands);
    const layers = [...st.layers];
    if (!ctx.px) return layers; // герб в полном формате — пробел
    const white = st.sizes[1];
    const x0 = st.sizes[0];
    const d = sameParity(k.emblem.d_of_white * white, white);
    const cx = x0 + white / 2;
    const cy = ctx.H / 2;
    const top = Math.round(cy - d / 2);
    const left = Math.round(cx - d / 2);
    if (ctx.tier === 'S') {
      layers.push(L('brown', ellipse(cx, top + d * 0.4, d * 0.42, d * 0.36)));
      layers.push(L('green', rect(left, top + d - 1, d, 1)));
    } else {
      // M/L: орёл (тело, крыло), кактус, венок.
      const body = ellipse(cx + d * 0.06, top + d * 0.42, d * 0.24, d * 0.27);
      const wing = poly([[cx - d * 0.05, top + d * 0.42], [cx - d * 0.46, top + d * 0.08], [cx - d * 0.16, top + d * 0.58]]);
      const head = circle(cx + d * 0.2, top + d * 0.16, d * 0.11);
      layers.push(L('brown', unite(unite(body, wing), head)));
      layers.push(L('green', rect(Math.round(cx - d * 0.22), Math.round(top + d * 0.66), Math.max(2, Math.round(d * 0.44)), Math.max(1, Math.round(d * 0.12)))));
      const wreath = sub(ellipse(cx, top + d * 0.62, d * 0.5, d * 0.38), ellipse(cx, top + d * 0.52, d * 0.4, d * 0.36));
      layers.push(L('green', inter(wreath, rect(left - 1, top + d * 0.7, d + 2, d * 0.4))));
      if (ctx.tier === 'L') layers.push(L('blue', rect(Math.round(cx - d * 0.3), Math.round(top + d * 0.8), Math.round(d * 0.6), 1)));
    }
    return layers;
  },

  ES(ctx) {
    const k = ctx.k;
    const st = stripes(ctx, { x: 0, y: 0, w: ctx.W, h: ctx.H }, 'h', k.bands);
    const layers = [...st.layers];
    if (!ctx.px || ctx.tier === 'S') return layers; // S: герб снят (правило S-EMBLEM-DROP)
    const square = ctx.fmt === 'square' || ctx.fmt === 'circle';
    const h = Math.round(k.arms.h_h * ctx.H);
    const cx = square ? ctx.W / 2 : k.arms.cx_h * ctx.H;
    const cy = st.sizes[0] + st.sizes[1] / 2;
    const crownH = Math.max(2, Math.round(h * 0.25));
    const sw = Math.round(h * 0.62);
    const x = Math.round(cx - sw / 2);
    const y = Math.round(cy - h / 2) + crownH;
    const sh = shield(x, y, sw, h - crownH);
    layers.push(L('red', sh));
    layers.push(L('white', inter(rect(x + sw / 2, y, sw / 2, (h - crownH) * 0.5), sh)));
    layers.push(L('yellow', inter(rect(x, y + (h - crownH) * 0.5, sw / 2, h), sh)));
    layers.push(L('red', rect(Math.round(cx - sw / 2), y - crownH, sw, crownH)));
    if (ctx.tier === 'L') {
      layers.push(L('white', rect(x - 3, y, 2, h - crownH)));
      layers.push(L('white', rect(x + sw + 1, y, 2, h - crownH)));
    }
    return layers;
  },

  SA(ctx) {
    const layers = [field(ctx, 'green')];
    if (!ctx.px) return layers; // шахада и меч в полном формате — пробел
    const W = ctx.W;
    const H = ctx.H;
    const cx = W / 2;
    const u = H / 16;
    // Схематичная надпись: строки разной длины (ритм письма справа налево), меч под ней.
    const rows = ctx.tier === 'S' ? [[0.62, 2]] : ctx.tier === 'M' ? [[0.5, 1], [0.6, 1]] : [[0.36, 1], [0.6, 1.4], [0.54, 1]];
    let y = Math.round(H * (ctx.tier === 'L' ? 0.28 : 0.3));
    for (const [wFrac, hh] of rows) {
      const w = Math.round(W * wFrac * (ctx.fmt === 'rect' ? 0.8 : 1));
      const h = Math.max(1, Math.round(hh * u * (ctx.tier === 'S' ? 1 : 0.9)));
      if (ctx.tier === 'L') {
        let xx = Math.round(cx + w / 2);
        const segs = [0.3, 0.12, 0.22, 0.08, 0.28];
        for (const sgm of segs) {
          const sw = Math.max(1, Math.round(w * sgm));
          layers.push(L('white', roundedBar(xx - sw, y, sw, h)));
          xx -= sw + 1;
        }
      } else layers.push(L('white', roundedBar(Math.round(cx - w / 2), y, w, h)));
      y += h + (ctx.tier === 'S' ? 1 : 2);
    }
    if (ctx.tier === 'S') layers.push(L('white', rect(Math.round(cx - W * 0.22), y, Math.round(W * 0.38), 1)));
    // Меч: клинок к древку (влево), рукоять справа.
    const sy = Math.round(H * 0.7);
    const blade = Math.round(W * 0.62 * (ctx.fmt === 'rect' ? 0.8 : 1));
    const bx = Math.round(cx - blade / 2);
    layers.push(L('white', rect(bx, sy, blade, 1)));
    const hilt = ctx.tier === 'S' ? 1 : 2;
    layers.push(L('white', rect(bx + blade - Math.round(blade * 0.2), sy - hilt, 1, 2 * hilt + 1)));
    return layers;
  },

  BR(ctx) {
    const k = ctx.k;
    const W = ctx.W;
    const H = ctx.H;
    const M = H / k.module;
    let ins = k.rhombus_inset_m * M;
    if (ctx.px) ins = Math.max(1, Math.round(ins));
    const layers = [field(ctx, 'green')];
    layers.push(L('yellow', poly([[ins, H / 2], [W / 2, ins], [W - ins, H / 2], [W / 2, H - ins]])));
    let r = k.circle_r_m * M;
    if (ctx.px) r = sameParity(2 * r, H) / 2;
    const cx = W / 2;
    const cy = H / 2;
    const globe = circle(cx, cy, r);
    layers.push(L('blue', globe));
    const bcx = cx + k.band.center_dx_m * M;
    const bcy = H;
    let r1 = k.band.r_inner_m * M;
    let r2 = k.band.r_outer_m * M;
    if (ctx.px) r2 = r1 + (ctx.tier === 'L' ? 1.6 : 1.1);
    const bandShape = inter(sub(circle(bcx, bcy, r2), circle(bcx, bcy, r1)), globe.clone({ insert: false }));
    layers.push(L('white', bandShape));
    if (ctx.px && ctx.tier !== 'S') {
      // Звёзды на миниатюрах: несколько белых точек ниже ленты (S-REPEAT), не позиции закона.
      const pts = ctx.tier === 'M' ? [[0, 0.45], [-0.35, 0.2], [0.35, 0.28]] : [[0, 0.5], [-0.38, 0.22], [0.36, 0.3], [0.1, 0.18], [-0.12, 0.72], [0.5, 0.6]];
      let d = null;
      for (const [dx, dy] of pts) {
        const p = dot(cx + dx * r, cy + dy * r, 1);
        d = d ? unite(d, p) : p;
      }
      layers.push(L('white', inter(d, globe.clone({ insert: false }))));
    }
    return layers;
  },

  KZ(ctx) {
    const k = ctx.k.estimate;
    const W = ctx.W;
    const H = ctx.H;
    const layers = [field(ctx, 'blue')];
    if (!ctx.px) return layers; // солнце, орёл, орнамент — пробел (ST RK 988-2007 не прочитан)
    const cx = W * k.sun_cx_l;
    const cy = Math.round(H * k.sun_cy_h);
    const tier = ctx.tier;
    const discD = sameParity(H * k.sun_disc_d_h * (tier === 'S' ? 1.15 : 1), W);
    const discR = discD / 2;
    const raysR = H * k.sun_rays_r_h;
    const nRays = tier === 'S' ? 8 : tier === 'M' ? 16 : 32;
    let rays = null;
    for (let i = 0; i < nRays; i++) {
      const a = (i * 2 * Math.PI) / nRays - Math.PI / 2;
      const half = Math.PI / nRays * 0.55;
      const p = poly([
        [cx + (discR + 0.6) * Math.cos(a - half), cy + (discR + 0.6) * Math.sin(a - half)],
        [cx + raysR * Math.cos(a), cy + raysR * Math.sin(a)],
        [cx + (discR + 0.6) * Math.cos(a + half), cy + (discR + 0.6) * Math.sin(a + half)],
      ]);
      rays = rays ? unite(rays, p) : p;
    }
    layers.push(L('yellow', unite(circle(cx, cy, discR), rays)));
    // Орёл: крылья дугой под солнцем.
    const ey = H * k.eagle_cy_h;
    const span = H * k.eagle_span_h * (ctx.fmt === 'rect' ? 1 : 0.9);
    const thick = tier === 'S' ? 1.2 : tier === 'M' ? 1.8 : 2.4;
    const wing = sub(ellipse(cx, ey + span * 0.18, span / 2, span * 0.3), ellipse(cx, ey + span * 0.18 + thick, span / 2 - thick * 0.6, span * 0.3));
    const wings = inter(wing, rect(cx - span / 2, ey + span * 0.18 - span * 0.3 - 1, span, span * 0.24));
    layers.push(L('yellow', wings));
    if (tier !== 'S') layers.push(L('yellow', ellipse(cx, ey + (tier === 'L' ? 2 : 1.2), tier === 'L' ? 1.6 : 1.1, tier === 'L' ? 2.6 : 1.8)));
    // Орнамент у древка: столбец с зубцами (S-LINE: 1 px допустим для опознавательного элемента).
    const ow = tier === 'S' ? 1 : tier === 'M' ? 2 : 3;
    const pitch = tier === 'S' ? 3 : tier === 'M' ? 4 : 5;
    // В круге столбец не притягивается к центру, а укорачивается до хорды (S-CIRCLE).
    const ox = ctx.circle ? Math.round(W * 0.17) : Math.max(1, Math.round(W * k.ornament_x_l));
    let y0 = 1;
    let y1 = H - 1;
    if (ctx.circle) {
      const R = W / 2;
      const half = Math.sqrt(R * R - (ox + ow / 2 - R) ** 2) - 1.5;
      y0 = Math.ceil(R - half);
      y1 = Math.floor(R + half);
    }
    let orn = rect(ox, y0, ow, y1 - y0);
    for (let y = y0 + 1; y < y1 - 1; y += pitch) orn = unite(orn, rect(ox + ow, y, 1, 1));
    layers.push(L('yellow', orn));
    return layers;
  },

  TM(ctx) {
    const k = ctx.k;
    const W = ctx.W;
    const H = ctx.H;
    const layers = [field(ctx, 'green')];
    let bx = k.carpet.x_l * W;
    let bw = k.carpet.w_l * W;
    if (ctx.px) {
      bx = Math.max(1, Math.round(bx));
      bw = Math.max(3, Math.round(bw));
    }
    if (!ctx.px) {
      layers.push(L('red', rect(bx, 0, bw, H)));
      return layers; // гёли, ветви, полумесяц и звёзды — пробел
    }
    layers.push(L('red', rect(bx, 0, bw, H)));
    const n = 5;
    const pitch = H / n;
    for (let i = 0; i < n; i++) {
      const gy = pitch * (i + 0.5);
      const gx = bx + bw / 2;
      if (ctx.tier === 'S') layers.push(L('yellow', dot(gx, gy, 1)));
      else {
        const g = ctx.tier === 'M' ? 1.4 : 2.2;
        layers.push(L('orange', poly([[gx, gy - g], [gx + g * 0.9, gy], [gx, gy + g], [gx - g * 0.9, gy]])));
        layers.push(L('white', dot(gx, gy, 1)));
      }
    }
    // Полумесяц и пять звёзд справа от ковра, вверху.
    const e = k.estimate;
    const ccx = bx + bw + W * e.crescent_dx_l;
    const ccy = H * e.crescent_cy_h;
    const R = Math.max(2.2, H * e.crescent_r_h);
    layers.push(L('white', crescent(ccx, ccy, R, R * 0.82, R * 0.42, -R * 0.05)));
    const starsPos = ctx.tier === 'S' ? [[1.7, -0.6], [1.9, 0.6]] : [[1.5, -1.2], [2.1, -0.55], [2.3, 0.2], [2.05, 0.95], [1.45, 1.4]];
    for (const [sx, sy] of starsPos) {
      const x = ccx + sx * R;
      const y = ccy + sy * R;
      layers.push(L('white', ctx.tier === 'L' ? star5(x, y, 1.3) : dot(x, y, 1)));
    }
    return layers;
  },

  CY(ctx) {
    const k = ctx.k.estimate;
    const W = ctx.W;
    const H = ctx.H;
    const layers = [field(ctx, 'white')];
    const scaleW = ctx.fmt === 'original' || ctx.fmt === '3x2' || ctx.fmt === 'rect' ? 1 : 1.25;
    const mw = H * k.map_w_h * scaleW;
    const mh = H * k.map_h_h * scaleW;
    const box = { x: W / 2 - mw / 2, y: H * k.map_cy_h - mh / 2, w: mw, h: mh };
    const eps = ctx.px ? (ctx.tier === 'S' ? 0.45 : 0.35) : 0;
    const map = mapShape(['Cyprus', 'N. Cyprus'], box, { eps, minArea: ctx.px ? 0.5 : 0 });
    layers.push(L('copper', map));
    if (!ctx.px) return layers; // ветви — пробел
    const by = box.y + mh + (ctx.tier === 'S' ? 1.2 : 1.6);
    const half = mw * 0.32;
    const t = ctx.tier === 'S' ? 1 : 1.4;
    layers.push(L('olive', band([W / 2 - half, by - 0.5], [W / 2 - 0.6, by + half * 0.28], 0, t)));
    layers.push(L('olive', band([W / 2 + 0.6, by + half * 0.28], [W / 2 + half, by - 0.5], 0, t)));
    return layers;
  },

  XK(ctx) {
    const k = ctx.k.estimate;
    const W = ctx.W;
    const H = ctx.H;
    const layers = [field(ctx, 'blue')];
    const mh = H * k.map_h_h;
    const box = { x: W / 2 - mh, y: H * k.map_cy_h - mh / 2, w: mh * 2, h: mh };
    const eps = ctx.px ? (ctx.tier === 'S' ? 0.45 : 0.35) : 0;
    layers.push(L('gold', mapShape(['Kosovo'], box, { eps })));
    if (!ctx.px) return layers; // звёзды — пробел
    const n = 6;
    const arcR = H * k.stars_arc_r_h;
    const acx = W / 2;
    const acy = H * k.stars_arc_cy_h;
    for (let i = 0; i < n; i++) {
      const a = (-90 - k.stars_arc_deg / 2 + (i * k.stars_arc_deg) / (n - 1)) * (Math.PI / 180);
      const x = acx + arcR * Math.cos(a);
      const y = acy + arcR * Math.sin(a);
      layers.push(L('white', ctx.tier === 'L' ? star5(x, y, 1.6) : dot(x, y, ctx.tier === 'M' ? 2 : 1)));
    }
    return layers;
  },

  VA(ctx) {
    const W = ctx.W;
    const H = ctx.H;
    const half = ctx.px ? Math.round(W / 2) : W / 2;
    const layers = [field(ctx, 'white'), L('yellow', rect(0, 0, half, H))];
    if (!ctx.px) return layers; // ключи и тиара — пробел
    const cx = half + (W - half) / 2;
    const cy = H * 0.56;
    const s = H * (ctx.tier === 'S' ? 0.3 : 0.32);
    const t = ctx.tier === 'S' ? 1 : ctx.tier === 'M' ? 1.4 : 2;
    layers.push(L('gold', band([cx - s, cy + s], [cx + s, cy - s], -t / 2, t / 2)));
    layers.push(L('silver', band([cx - s, cy - s], [cx + s, cy + s], -t / 2, t / 2)));
    const ty = cy - s - (ctx.tier === 'S' ? 1.6 : 2.2);
    const tw = ctx.tier === 'S' ? 1.6 : ctx.tier === 'M' ? 2.2 : 3.2;
    layers.push(L('gold', ellipse(cx, ty, tw, tw * 1.15)));
    if (ctx.tier === 'L') layers.push(L('white', rect(cx - tw, ty - 0.5, tw * 2, 1)));
    return layers;
  },

  NP(ctx) {
    const f = nepalFrame();
    const W = ctx.W;
    const H = ctx.H;
    // Непал не растягиваем: форма вписывается в холст, фон прозрачный (правило U-SHAPE).
    let s = H;
    let ox = (W - f.w * s) / 2;
    let oy = 0;
    if (ctx.circle) {
      // Вписать все вершины каймы в круг с полем 0.5 px.
      const R = W / 2 - 0.5;
      let best = 0;
      for (let k = 1; k > 0.3; k -= 0.005) {
        const ss = H * k;
        const oxx = (W - f.w * ss) / 2;
        const oyy = (H - ss) / 2;
        const ok = f.outer.every((p) => {
          const q = f.to(p);
          return Math.hypot(oxx + q.x * ss - W / 2, oyy + q.y * ss - H / 2) <= R;
        });
        if (ok) {
          best = k;
          break;
        }
      }
      s = H * best;
      ox = (W - f.w * s) / 2;
      oy = (H - s) / 2;
    }
    const T = (p) => {
      const q = f.to(p);
      return [ox + q.x * s, oy + q.y * s];
    };
    const c = f.c;
    const layers = [];
    layers.push(L('blue', poly(f.outer.map(T))));
    let inner = c.outline;
    if (ctx.px) {
      // Кайма не тоньше 1 px (S-MIN).
      const bpx = c.border * f.scale * s;
      if (bpx < 1) {
        const k = 1 / (f.scale * s);
        inner = innerOffset(c.outline, k - c.border);
      }
    }
    layers.push(L('crimson', poly(inner.map(T))));
    const u = f.scale * s; // единица AB в пикселях холста
    const pt = (p) => T(p);
    if (!ctx.px || ctx.tier === 'L') {
      // Луна: чаша (шаги 13–14), полукруг с 8 лучами (шаги 16–18).
      const m = c.moon;
      const [Lx, Ly] = pt(m.L);
      const [Mx, My] = pt(m.M);
      const [Tx, Ty] = pt(m.T);
      const below = rect(Mx - 2 * u, My, 4 * u, 2 * u);
      const bowl = inter(sub(circle(Mx, My, m.rMQ * u), circle(Lx, Ly, m.rLN * u)), below);
      layers.push(L('white', bowl));
      const above = rect(Tx - u, Ty - u, 2 * u, u);
      let moon = inter(circle(Tx, Ty, m.rTM * u), above);
      for (let i = 0; i < 8; i++) {
        const a0 = Math.PI + (i * Math.PI) / 8;
        const a1 = a0 + Math.PI / 8;
        const am = (a0 + a1) / 2;
        const tri = poly([
          [Tx + m.rTM * u * Math.cos(a0), Ty + m.rTM * u * Math.sin(a0)],
          [Tx + m.rTS * u * Math.cos(am), Ty + m.rTS * u * Math.sin(am)],
          [Tx + m.rTM * u * Math.cos(a1), Ty + m.rTM * u * Math.sin(a1)],
        ]);
        moon = unite(moon, tri);
      }
      layers.push(L('white', inter(moon, above.clone({ insert: false }).scale(1, 1.6, [Tx, Ty]))));
      // Солнце: диск радиуса MN и 12 лучей до радиуса LN, два луча касаются HI.
      const [Wx, Wy] = pt(c.sun.W);
      let sun = circle(Wx, Wy, c.sun.inner * u);
      for (let i = 0; i < 12; i++) {
        const am = (-Math.PI / 2) + (i * Math.PI) / 6;
        const half = Math.PI / 12;
        sun = unite(sun, poly([
          [Wx + c.sun.inner * u * Math.cos(am - half), Wy + c.sun.inner * u * Math.sin(am - half)],
          [Wx + c.sun.outer * u * Math.cos(am), Wy + c.sun.outer * u * Math.sin(am)],
          [Wx + c.sun.inner * u * Math.cos(am + half), Wy + c.sun.inner * u * Math.sin(am + half)],
        ]));
      }
      layers.push(L('white', sun));
    } else {
      // S/M: луна — чаша + полудиск, солнце — диск; лучи сняты (S-POINT).
      const [Mx, My] = pt(c.moon.M);
      const [Tx, Ty] = pt(c.moon.T);
      const r = Math.max(1.6, c.moon.rTS * u);
      layers.push(L('white', inter(circle(Mx, My - 0.4, r * 1.25), rect(Mx - 3 * r, My - 0.4, 6 * r, 3 * r))));
      layers.push(L('white', inter(circle(Tx, Ty - 0.6, r * 0.95), rect(Tx - 3 * r, Ty - 3 * r - 0.6, 6 * r, 3 * r))));
      const [Wx, Wy] = pt(c.sun.W);
      layers.push(L('white', circle(Wx, Wy, Math.max(1.6, c.sun.outer * u * 0.8))));
    }
    return layers;
  },
};

// Сдвиг контура внутрь (для утолщения каймы на миниатюрах).
function innerOffset(outline, d) {
  const n = outline.length;
  const crossL = (p1, p2, p3, p4) => {
    const dd = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);
    const a = p1.x * p2.y - p1.y * p2.x;
    const b = p3.x * p4.y - p3.y * p4.x;
    return { x: (a * (p3.x - p4.x) - (p1.x - p2.x) * b) / dd, y: (a * (p3.y - p4.y) - (p1.y - p2.y) * b) / dd };
  };
  const lines = outline.map((p, i) => {
    const q = outline[(i + 1) % n];
    const len = Math.hypot(q.x - p.x, q.y - p.y);
    const nx = -(q.y - p.y) / len;
    const ny = (q.x - p.x) / len;
    return [{ x: p.x + nx * d, y: p.y + ny * d }, { x: q.x + nx * d, y: q.y + ny * d }];
  });
  return outline.map((_, i) => {
    const prev = lines[(i - 1 + n) % n];
    const cur = lines[i];
    return crossL(prev[0], prev[1], cur[0], cur[1]);
  });
}

function snapCenter(item) {
  const c = item.bounds.center;
  item.translate([Math.round(c.x * 2) / 2 - c.x, Math.round(c.y * 2) / 2 - c.y]);
  return item;
}

export function build(code, ctx) {
  const b = builders[code];
  if (!b) throw new Error(`Нет построителя для ${code}`);
  return b(ctx);
}

export const codes = Object.keys(builders);
