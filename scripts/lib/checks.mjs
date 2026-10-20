// Проверки флагов. Каждая проверка — функция, возвращающая список проблем { id, msg }.
// Те же функции вызывают и CI (scripts/check.mjs), и негативные тесты (scripts/negative.mjs).
//
//  C01 inventory   состав: для каждой страны и формата есть файл, лишних файлов нет
//  C02 xml         валидный XML, корень <svg> с xmlns
//  C03 viewbox     viewBox "0 0 W H", width и height совпадают с форматом
//  C04 forbidden   нет text, image, use, clipPath, mask, filter, style, script, foreignObject,
//                  атрибутов stroke*, clip-path, mask, filter, transform, href, opacity
//  C05 paths       у каждого path явные fill (#RRGGBB) и fill-rule, все подпути замкнуты (Z),
//                  путь из нескольких подпутей — только с fill-rule="evenodd"
//  C06 palette     каждый fill — цвет из метаданных флага
//  C07 hidden      каждый path меняет хотя бы один пиксель (нет скрытых заливок)
//  C08 coverage    прямоугольник залит целиком; круг — без рисунка за кругом и без дыр внутри
//  C09 probes      пробные точки из метаданных: цвет в пределах ΔE2000 ≤ 3
//  C11 grid        у прямолинейных флагов на миниатюрах нет смешанных пикселей (сетка)
//  C12 budget      размер файла не больше бюджета
//  C13 meta        метаданные: обязательные поля, ссылки на источники, цвета
//  C14 ratio       пропорция original совпадает с метаданными
//  C15 diff        визуальный дифф с базой прошлого релиза (отчёт, не ошибка)
//  C16 bounds      геометрия не выходит за viewBox (иначе экспорт Figma расширяет рамку)

import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { Resvg } from '@resvg/resvg-js';
import { hexToLab, rgbToLab, deltaE2000 } from '../../src/color.mjs';

export const BUDGET = { mini: 6 * 1024, full: 40 * 1024 };
const FORBIDDEN_TAGS = ['text', 'tspan', 'image', 'use', 'clipPath', 'mask', 'filter', 'style', 'script', 'foreignObject', 'pattern', 'linearGradient', 'radialGradient', 'symbol'];
const FORBIDDEN_ATTRS = /^(stroke.*|clip-path|clip-rule|mask|filter|transform|href|xlink:href|opacity|fill-opacity|style)$/;
const GRID_CLASSES = new Set(['bicolour-h', 'tricolour-v', 'cross']);
const GRID_CODES = new Set(['US']);

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', preserveOrder: true });

export function render(svg, scale = 1) {
  const r = new Resvg(svg, { fitTo: { mode: 'zoom', value: scale }, background: 'rgba(0,0,0,0)', shapeRendering: 2, font: { loadSystemFonts: false } });
  const img = r.render();
  return { w: img.width, h: img.height, px: img.pixels };
}

// Обход дерева preserveOrder: возвращает [{ tag, attrs }]
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
  if (v !== true) return [{ id: 'C02', msg: `невалидный XML: ${v.err.msg}` }];
  const els = walk(parser.parse(svg));
  const root = els[0];
  if (!root || root.tag !== 'svg') return [{ id: 'C02', msg: 'корень не <svg>' }];
  if (root.attrs.xmlns !== 'http://www.w3.org/2000/svg') p.push({ id: 'C02', msg: 'нет xmlns' });
  const vb = (root.attrs.viewBox ?? '').trim().split(/[\s,]+/).map(Number);
  const close = (a, b) => Math.abs(a - b) < 0.011;
  if (vb.length !== 4 || vb[0] !== 0 || vb[1] !== 0 || !close(vb[2], size.W) || !close(vb[3], size.H)) {
    p.push({ id: 'C03', msg: `viewBox "${root.attrs.viewBox}", ожидается "0 0 ${size.W} ${size.H}"` });
  }
  if (!close(Number(root.attrs.width), size.W) || !close(Number(root.attrs.height), size.H)) {
    p.push({ id: 'C03', msg: `width×height ${root.attrs.width}×${root.attrs.height}, ожидается ${size.W}×${size.H}` });
  }
  const palette = new Set(Object.values(meta.colors).map((c) => c.srgb.toUpperCase()));
  let paths = 0;
  for (const el of els) {
    if (FORBIDDEN_TAGS.includes(el.tag)) p.push({ id: 'C04', msg: `запрещённый элемент <${el.tag}>` });
    for (const a of Object.keys(el.attrs)) if (FORBIDDEN_ATTRS.test(a)) p.push({ id: 'C04', msg: `запрещённый атрибут ${a} у <${el.tag}>` });
    if (el.tag === 'path') {
      paths++;
      const fill = el.attrs.fill;
      if (!/^#[0-9A-Fa-f]{6}$/.test(fill ?? '')) p.push({ id: 'C05', msg: `path без явного fill #RRGGBB (fill="${fill}")` });
      else if (!palette.has(fill.toUpperCase())) p.push({ id: 'C06', msg: `цвет ${fill} не из палитры флага` });
      const rule = el.attrs['fill-rule'];
      if (!rule) p.push({ id: 'C05', msg: 'path без явного fill-rule' });
      const d = el.attrs.d ?? '';
      const subs = d.split(/(?=[Mm])/).filter((s) => s.trim());
      if (!subs.length) p.push({ id: 'C05', msg: 'пустой path' });
      for (const s of subs) if (!/[Zz]\s*$/.test(s)) p.push({ id: 'C05', msg: `незамкнутый подпуть: ${s.slice(0, 40)}…` });
      if (subs.length > 1 && rule !== 'evenodd') p.push({ id: 'C05', msg: `путь из ${subs.length} подпутей с fill-rule="${rule ?? 'по умолчанию'}": кольца станут дисками` });
    } else if (!['svg', 'title', 'desc', 'g'].includes(el.tag) && !FORBIDDEN_TAGS.includes(el.tag)) {
      p.push({ id: 'C04', msg: `неожиданный элемент <${el.tag}> (разрешены svg, title, desc, g, path)` });
    }
  }
  if (!paths) p.push({ id: 'C05', msg: 'нет ни одного path' });
  const budget = spec.tier ? BUDGET.mini : (meta.budget ?? BUDGET.full);
  const bytes = Buffer.byteLength(svg);
  if (bytes > budget) p.push({ id: 'C12', msg: `размер ${bytes} Б больше бюджета ${budget} Б` });
  return p;
}

// Пиксельные проверки
export function pixels(svg, spec, meta, size) {
  const p = [];
  const scale = spec.tier ? 1 : Math.min(1, 300 / size.H);
  let img;
  try {
    img = render(svg, scale);
  } catch (e) {
    return [{ id: 'C02', msg: `не рендерится: ${e.message}` }];
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
    if (outside) p.push({ id: 'C08', msg: `${outside} px рисунка за пределами круга (флаг выгружен квадратом?)` });
    if (holes) p.push({ id: 'C08', msg: `${holes} px прозрачных или полупрозрачных внутри формы` });
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
    if (mixed) p.push({ id: 'C11', msg: `${mixed} смешанных пикселей: границы не на пиксельной сетке` });
  }
  return p;
}

// C07: путь, без которого картинка не меняется, — скрытая заливка.
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
    if (!diff) p.push({ id: 'C07', msg: `path №${i + 1} (${(m[0].match(/fill="([^"]+)"/) ?? [])[1]}) ничего не меняет на рендере — скрытая заливка` });
  });
  return p;
}

// C09: пробные точки в формате original
export function probes(svg, meta, size) {
  const p = [];
  if (!meta.probes?.length) return [{ id: 'C09', msg: 'нет пробных точек в метаданных' }];
  const img = render(svg, 1);
  for (const pr of meta.probes) {
    const x = Math.min(img.w - 1, Math.floor(pr.at[0] * img.w));
    const y = Math.min(img.h - 1, Math.floor(pr.at[1] * img.h));
    const i = (y * img.w + x) * 4;
    const a = img.px[i + 3];
    if (pr.color === 'transparent') {
      if (a > 5) p.push({ id: 'C09', msg: `точка ${pr.at} (${pr.why}): ожидалась прозрачность` });
      continue;
    }
    const want = meta.colors[pr.color]?.srgb;
    if (!want) {
      p.push({ id: 'C09', msg: `точка ${pr.at}: цвет ${pr.color} не описан` });
      continue;
    }
    if (a < 250) {
      p.push({ id: 'C09', msg: `точка ${pr.at} (${pr.why}): прозрачно, ожидался ${pr.color}` });
      continue;
    }
    const got = [img.px[i], img.px[i + 1], img.px[i + 2]];
    const d = deltaE2000(rgbToLab(got), hexToLab(want));
    if (d > 3) p.push({ id: 'C09', msg: `точка ${pr.at} (${pr.why}): ΔE2000 ${d.toFixed(1)} к ${pr.color} ${want}, получено rgb(${got.join(',')})` });
  }
  return p;
}

// C14: пропорция original
export function ratio(svg, meta) {
  const m = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
  if (!m) return [{ id: 'C14', msg: 'нет viewBox' }];
  const r = Number(m[1]) / Number(m[2]);
  const want = meta.ratio.shape ? meta.ratio.w_over_h : meta.ratio.w / meta.ratio.h;
  return Math.abs(r - want) / want > 0.001 ? [{ id: 'C14', msg: `пропорция ${r.toFixed(4)}, по метаданным ${want.toFixed(4)}` }] : [];
}

// C13: метаданные
export function metaCheck(meta, globalSources) {
  const p = [];
  const need = ['code', 'iso', 'names', 'classes', 'ratio', 'adopted', 'sources', 'colors', 'construction', 'probes', 'simplification', 'confusable', 'gaps', 'review', 'status'];
  for (const k of need) if (!(k in meta)) p.push({ id: 'C13', msg: `нет поля ${k}` });
  const known = new Set([...Object.keys(meta.sources ?? {}), ...Object.keys(globalSources)]);
  const refs = [];
  for (const [k, c] of Object.entries(meta.colors ?? {})) {
    if (!/^#[0-9A-F]{6}$/.test(c.srgb ?? '')) p.push({ id: 'C13', msg: `цвет ${k}: srgb не в формате #RRGGBB` });
    if (!['ok', 'provisional', 'conflict'].includes(c.status)) p.push({ id: 'C13', msg: `цвет ${k}: status "${c.status}"` });
    if (!/^C-[A-Z0-9-]+$/.test(c.rule ?? '')) p.push({ id: 'C13', msg: `цвет ${k}: нет правила выбора (rule)` });
    for (const s of c.specs ?? []) refs.push(s.src);
  }
  refs.push(meta.ratio?.source, meta.adopted?.source);
  for (const r of refs.filter(Boolean)) if (!known.has(r) && r !== 'estimate') p.push({ id: 'C13', msg: `ссылка на неизвестный источник "${r}"` });
  for (const pr of meta.probes ?? []) if (pr.color !== 'transparent' && !meta.colors?.[pr.color]) p.push({ id: 'C13', msg: `пробная точка ссылается на цвет ${pr.color}` });
  for (const [id, s] of Object.entries(meta.sources ?? {})) {
    if (s.ref) continue;
    if (![1, '1g', 2, 3, 4, 5].includes(s.level)) p.push({ id: 'C13', msg: `источник ${id}: уровень ${s.level}` });
    if (!s.accessed) p.push({ id: 'C13', msg: `источник ${id}: нет даты чтения` });
  }
  if (!['ok', 'ok-estimate', 'draft'].includes(meta.status?.full)) p.push({ id: 'C13', msg: `status.full "${meta.status?.full}"` });
  if (!['ok', 'draft', 'blocked-review'].includes(meta.status?.mini)) p.push({ id: 'C13', msg: `status.mini "${meta.status?.mini}"` });
  return p;
}

// C15: дифф с базой (PNG в baseline/). Возвращает число отличающихся пикселей.
export function diffCount(svg, basePng, PNG, pixelmatch, scale) {
  const img = render(svg, scale);
  const b = PNG.sync.read(basePng);
  if (b.width !== img.w || b.height !== img.h) return Infinity;
  return pixelmatch(img.px, b.data, null, img.w, img.h, { threshold: 0.05 });
}

// Габарит пути по опорным и контрольным точкам (контрольные точки кривой Безье ограничивают
// её сверху, поэтому выход за холст по ним — повод посмотреть, а для прямых — точный).
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
      p.push({ id: 'C16', msg: `path №${k + 1} выходит за холст: x ${b.minX.toFixed(2)}…${b.maxX.toFixed(2)}, y ${b.minY.toFixed(2)}…${b.maxY.toFixed(2)} при ${size.W}×${size.H}` });
    }
  });
  return p;
}
