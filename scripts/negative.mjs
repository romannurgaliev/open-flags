#!/usr/bin/env node
// Negative tests: each check runs on a deliberately broken copy of a real file
// and must fail. Control: the unmodified files pass the same checks.
// The broken copies are written to tests/broken/ so they can be opened and inspected.
//   node scripts/negative.mjs

import { readFileSync, writeFileSync, mkdirSync, cpSync, rmSync, unlinkSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { FORMATS, loadMeta, originalSize, renderFlag } from '../src/build.mjs';
import { lint, pixels, hidden, probes, ratio, metaCheck, diffCount, render, expectedSize, bounds } from './lib/checks.mjs';
import { runChecks } from './check.mjs';

const root = new URL('../', import.meta.url);
const globalSources = JSON.parse(readFileSync(new URL('data/sources.json', root), 'utf8'));
const spec = (dir) => FORMATS.find((f) => f.dir === dir);
const read = (dir, code) => readFileSync(new URL(`flags/${dir}/${code}.svg`, root), 'utf8');
const brokenDir = new URL('tests/broken/', root);
rmSync(brokenDir, { recursive: true, force: true });
mkdirSync(brokenDir, { recursive: true });

function fileChecks(svg, dir, code, meta = loadMeta(code)) {
  const sp = spec(dir);
  const size = expectedSize(sp, meta, originalSize);
  const out = lint(svg, sp, meta, size);
  if (out.some((x) => x.id === 'C02')) return out;
  out.push(...pixels(svg, sp, meta, size), ...bounds(svg, size), ...hidden(svg, sp, size));
  if (sp.fmt === 'original') out.push(...probes(svg, meta, size), ...ratio(svg, meta));
  return out;
}

const cases = [
  { n: 'N03', id: 'C02', code: 'JP', dir: 'original', what: 'closing tag cut off', mut: (s) => s.replace('</svg>', '') },
  { n: 'N04', id: 'C03', code: 'JP', dir: 'mini/circle-16', what: 'viewBox 17×16 instead of 16×16', mut: (s) => s.replace('viewBox="0 0 16 16"', 'viewBox="0 0 17 16"') },
  { n: 'N05', id: 'C04', code: 'JP', dir: 'original', what: 'text in the SVG', mut: (s) => s.replace('</svg>', '<text x="10" y="20">JP</text></svg>') },
  { n: 'N06', id: 'C04', code: 'JP', dir: 'original', what: 'raster image', mut: (s) => s.replace('</svg>', '<image href="flag.png" width="10" height="10"/></svg>') },
  { n: 'N07', id: 'C04', code: 'JP', dir: 'mini/circle-16', what: 'circle relies on clip-path (like a Figma export with frame clipping)', mut: () => read('mini/square-16', 'JP').replace('<path', '<clipPath id="c"><circle cx="8" cy="8" r="8"/></clipPath><g clip-path="url(#c)"><path').replace('</svg>', '</g></svg>') },
  { n: 'N08', id: 'C08', code: 'JP', dir: 'mini/circle-16', what: 'Figma dropped the clip-path: circle exported as a square (a durev-flags bug)', mut: () => read('mini/square-16', 'JP') },
  { n: 'N09', id: 'C05', code: 'JP', dir: 'original', what: 'unclosed subpath (no Z)', mut: (s) => s.replace(/Z"\/>/, '"/>') },
  { n: 'N10', id: 'C05', code: 'JP', dir: 'original', what: 'no fill-rule', mut: (s) => s.replace(/ fill-rule="evenodd"/g, '') },
  { n: 'N11', id: 'C05', code: 'US', dir: 'original', what: 'fill-rule="nonzero" on a multi-subpath path (durev-flags normalization c5525e5)', mut: (s) => s.replace(/fill-rule="evenodd"/g, 'fill-rule="nonzero"') },
  { n: 'N12', id: 'C06', code: 'JP', dir: 'original', what: 'color not in the palette', mut: (s) => s.replace('#D21034', '#D21035') },
  { n: 'N13', id: 'C07', code: 'JP', dir: 'original', what: 'hidden fill under the field', mut: (s) => s.replace('</title>\n', '</title>\n<path fill="#D21034" fill-rule="evenodd" d="M10 10L100 10L100 100L10 100Z"/>\n') },
  { n: 'N14', id: 'C04', code: 'JP', dir: 'original', what: 'invisible fill via fill-opacity="0"', mut: (s) => s.replace('</svg>', '<path fill="#D21034" fill-opacity="0" fill-rule="evenodd" d="M0 0L5 0L5 5Z"/></svg>') },
  { n: 'N15', id: 'C08', code: 'RO', dir: 'mini/square-16', what: 'hole: the field base layer is missing', mut: (s) => s.replace(/<path[^>]*\/>\n/, '') },
  { n: 'N16', id: 'C09', code: 'JP', dir: 'original', what: 'disc 10% larger than the law', mut: () => { const m = loadMeta('JP'); m.construction.disc.d_h = 0.66; return renderFlag('JP', spec('original'), m); } },
  { n: 'N17', id: 'C11', code: 'RO', dir: 'mini/square-16', what: 'stripes off the pixel grid', mut: () => renderFlag('RO', { ...spec('mini/square-16'), tier: undefined }, loadMeta('RO')).replace('<svg', '<svg').trim() + '\n' },
  { n: 'N18', id: 'C12', code: 'JP', dir: 'mini/square-16', what: 'file over budget', mut: (s) => s.replace('</title>', `</title><desc>${'x'.repeat(7000)}</desc>`) },
  { n: 'N22', id: 'C16', code: 'VA', dir: 'mini/square-16', what: 'key extends beyond the canvas (VA before the fix; Figma grew the export to 18×16)', mut: (s) => s.replace('</svg>', '<path fill="#C8A040" fill-rule="evenodd" d="M12 4L17.2 4L17.2 5L12 5Z"/>\n</svg>') },
  { n: 'N19', id: 'C14', code: 'PL', dir: 'original', what: 'ratio 2:3 instead of 5:8', mut: (s) => s.replace(/width="960" height="600" viewBox="0 0 960 600"/, 'width="900" height="600" viewBox="0 0 900 600"') },
];

const rows = [];
let missed = 0;

// Control: the same files without breakage must have zero problems
for (const c of [...new Map(cases.map((c) => [`${c.code}|${c.dir}`, c])).values()]) {
  const got = fileChecks(read(c.dir, c.code), c.dir, c.code);
  if (got.length) {
    missed++;
    rows.push(['control', '—', `${c.dir}/${c.code}`, 'unmodified file', `✗ ${got.map((x) => x.id).join(', ')}`]);
  }
}

for (const c of cases) {
  const broken = c.mut(read(c.dir, c.code));
  const name = `${c.n}-${c.code}-${c.dir.replace(/\//g, '_')}.svg`;
  writeFileSync(new URL(name, brokenDir), broken);
  // N17: file built without grid snapping but with miniature dimensions
  const got = fileChecks(broken, c.dir, c.code);
  const hit = got.some((x) => x.id === c.id);
  if (!hit) missed++;
  rows.push([c.n, c.id, `${c.dir}/${c.code}`, c.what, hit ? `✓ ${got.filter((x) => x.id === c.id)[0].msg}` : `✗ not caught (${got.map((x) => x.id).join(', ') || 'nothing'})`]);
}

// C13: metadata
{
  const m = loadMeta('JP');
  delete m.colors.red.srgb;
  const got = metaCheck(m, globalSources);
  const hit = got.some((x) => x.id === 'C13');
  if (!hit) missed++;
  rows.push(['N20', 'C13', 'data/flags/JP.json', 'color has no srgb', hit ? `✓ ${got[0].msg}` : '✗ not caught']);
}

// C15: diff against the baseline
{
  const m = loadMeta('CH');
  m.construction.cross.arm_w = 8;
  m.construction.cross.arm_l = 9;
  const sp = spec('mini/square-24');
  const svg = renderFlag('CH', sp, m);
  writeFileSync(new URL('N21-CH-mini_square-24.svg', brokenDir), svg);
  const base = render(read(sp.dir, 'CH'), 1);
  const png = new PNG({ width: base.w, height: base.h });
  base.px.copy(png.data);
  const n = diffCount(svg, PNG.sync.write(png), PNG, pixelmatch, 1);
  if (!n) missed++;
  rows.push(['N21', 'C15', `${sp.dir}/CH`, 'cross wider and longer (arm 8 instead of 6 units)', n ? `✓ differs by ${n} px` : '✗ not caught']);
}

// C01: inventory on a copy of the directory
{
  const tmp = mkdtempSync(join(tmpdir(), 'flags-'));
  cpSync(new URL('flags/', root), tmp, { recursive: true });
  unlinkSync(join(tmp, 'mini/circle-16/JP.svg'));
  writeFileSync(join(tmp, 'mini/circle-16/ZZ.svg'), read('mini/circle-16', 'JP'));
  const { problems } = runChecks({ dir: new URL(`file://${tmp}/`), codes: ['JP'], hiddenCheck: false, baseline: new URL('file:///nonexistent/') });
  const miss = problems.some((p) => p.id === 'C01' && p.where.endsWith('JP.svg'));
  const extra = problems.some((p) => p.id === 'C01' && p.where.endsWith('ZZ.svg'));
  if (!miss) missed++;
  if (!extra) missed++;
  rows.push(['N01', 'C01', 'mini/circle-16/JP', 'file deleted', miss ? '✓ file missing' : '✗ not caught']);
  rows.push(['N02', 'C01', 'mini/circle-16/ZZ', 'extra file', extra ? '✓ extra file' : '✗ not caught']);
  rmSync(tmp, { recursive: true, force: true });
}

rows.sort((a, b) => a[0].localeCompare(b[0]));
console.log('| Test | Check | File | Breakage | Result |\n|---|---|---|---|---|');
for (const r of rows) console.log(`| ${r.join(' | ')} |`);
console.log(missed ? `\n${missed} breakages not caught.` : `\nAll ${rows.length} breakages caught; control files clean.`);
process.exit(missed ? 1 : 0);
