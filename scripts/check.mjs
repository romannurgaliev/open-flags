#!/usr/bin/env node
// Checks every flag in flags/ (or in --dir) against the metadata in data/.
//   node scripts/check.mjs                 all checks, exit code 1 on failure
//   node scripts/check.mjs --report r.md   plus a Markdown report (for the GitHub step summary)
//   node scripts/check.mjs --dir path      check another flag directory (negative tests)
//   node scripts/check.mjs --no-hidden     skip C07 (the slowest)
// C15 (diff against baseline/) reports changes; it is not a failure.

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { FORMATS, allCodes, loadMeta, originalSize } from '../src/build.mjs';
import { lint, pixels, hidden, probes, ratio, metaCheck, diffCount, expectedSize, bounds } from './lib/checks.mjs';

const arg = (n) => {
  const i = process.argv.indexOf(n);
  return i > -1 ? process.argv[i + 1] : null;
};
const root = new URL('../', import.meta.url);
const dir = arg('--dir') ? new URL(`file://${arg('--dir').replace(/\/?$/, '/')}`) : new URL('flags/', root);
const reportPath = arg('--report');
const withHidden = !process.argv.includes('--no-hidden');
const globalSources = JSON.parse(readFileSync(new URL('data/sources.json', root), 'utf8'));

export function runChecks({ dir, codes = allCodes(), hiddenCheck = true, baseline = new URL('baseline/', root) }) {
  const problems = [];
  const changed = [];
  const add = (where, list) => list.forEach((x) => problems.push({ ...x, where }));
  for (const code of codes) {
    const meta = loadMeta(code);
    add(`data/flags/${code}.json`, metaCheck(meta, globalSources));
    for (const spec of FORMATS) {
      const where = `${spec.dir}/${code}.svg`;
      const file = new URL(where, dir);
      if (!existsSync(file)) {
        add(where, [{ id: 'C01', msg: 'file missing' }]);
        continue;
      }
      const svg = readFileSync(file, 'utf8');
      const size = expectedSize(spec, meta, originalSize);
      const l = lint(svg, spec, meta, size);
      add(where, l);
      if (l.some((x) => x.id === 'C02')) continue;
      add(where, pixels(svg, spec, meta, size));
      add(where, bounds(svg, size));
      if (hiddenCheck) add(where, hidden(svg, spec, size));
      if (spec.fmt === 'original') {
        add(where, probes(svg, meta, size));
        add(where, ratio(svg, meta));
      }
      const base = new URL(`${spec.dir}/${code}.png`, baseline);
      if (existsSync(base)) {
        const n = diffCount(svg, readFileSync(base), PNG, pixelmatch, spec.tier ? 1 : 200 / size.H);
        if (n) changed.push({ where, n });
      }
    }
  }
  // C01: extra files
  for (const spec of FORMATS) {
    const d = new URL(`${spec.dir}/`, dir);
    if (!existsSync(d)) continue;
    for (const f of readdirSync(d)) if (!codes.includes(f.replace(/\.svg$/, ''))) problems.push({ id: 'C01', msg: 'extra file (not in data/flags)', where: `${spec.dir}/${f}` });
  }
  return { problems, changed };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const codes = allCodes();
  const t0 = Date.now();
  const { problems, changed } = runChecks({ dir, codes, hiddenCheck: withHidden });
  const files = codes.length * FORMATS.length;
  const summary = problems.length
    ? `Checks failed: ${problems.length} problems in ${files} files.`
    : `All ${files} files passed (${codes.length} flags × ${FORMATS.length} formats) in ${((Date.now() - t0) / 1000).toFixed(1)} s.`;
  console.log(summary);
  const byId = {};
  for (const p of problems) {
    byId[p.id] = (byId[p.id] ?? 0) + 1;
    console.log(`- [${p.id}] ${p.where}: ${p.msg}`);
  }
  if (changed.length) {
    console.log(`\nC15: ${changed.length} files differ from baseline/:`);
    for (const c of changed) console.log(`  ${c.where}: ${c.n === Infinity ? 'size changed' : `${c.n} px`}`);
  }
  if (reportPath) {
    const lines = [`### ${problems.length ? '⚠️' : '✅'} ${summary}`, ''];
    if (problems.length) lines.push(...problems.map((p) => `- \`${p.id}\` ${p.where}: ${p.msg}`), '');
    lines.push(changed.length ? `**Changes against baseline/** (C15): ${changed.length} files.` : 'No changes against baseline/.', '');
    lines.push(...changed.map((c) => `- ${c.where}: ${c.n === Infinity ? 'size changed' : `${c.n} px`}`));
    writeFileSync(reportPath, lines.join('\n') + '\n');
  }
  process.exit(problems.length ? 1 : 0);
}
