#!/usr/bin/env node
// Exports flags from Figma into flags/ through the REST API (GET /v1/images, format=svg) and normalizes
// the export (scripts/normalize.mjs). Geometry is not edited: anything that fails the checks is fixed in Figma.
//
//   FIGMA_TOKEN=<personal access token> node scripts/export-figma.mjs
// Token: Figma → Settings → Security → Personal access tokens, scope File content → Read-only,
// all other scopes: No access.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { normalizeFigmaSvg } from './normalize.mjs';
import { allCodes, loadMeta } from '../src/build.mjs';

const token = process.env.FIGMA_TOKEN;
if (!token) {
  console.error('FIGMA_TOKEN must be set in the environment.');
  process.exit(1);
}
const root = new URL('../', import.meta.url);
const cfg = JSON.parse(readFileSync(new URL('figma.json', root), 'utf8'));
const codes = new Set(allCodes());
const BATCH = 50;

async function api(path) {
  const res = await fetch(`https://api.figma.com/v1${path}`, { headers: { 'X-Figma-Token': token } });
  if (!res.ok) throw new Error(`Figma API ${res.status} on ${path}: ${await res.text()}`);
  return res.json();
}

const ids = Object.values(cfg.sets).join(',');
const { nodes } = await api(`/files/${cfg.fileKey}/nodes?ids=${encodeURIComponent(ids)}&depth=1`);
const jobs = [];
for (const [dir, setId] of Object.entries(cfg.sets)) {
  const set = nodes[setId]?.document;
  if (!set) throw new Error(`Set ${setId} (${dir}) not found in ${cfg.fileKey}`);
  for (const v of set.children ?? []) {
    const m = v.name.match(/^Country=([A-Z]{2})$/);
    if (!m) continue;
    if (!codes.has(m[1])) {
      console.warn(`Figma has ${m[1]} (${dir}) but there is no data/flags/${m[1]}.json; skipping.`);
      continue;
    }
    jobs.push({ id: v.id, code: m[1], dir });
  }
}

let written = 0;
for (let i = 0; i < jobs.length; i += BATCH) {
  const batch = jobs.slice(i, i + BATCH);
  const q = encodeURIComponent(batch.map((j) => j.id).join(','));
  const { images } = await api(`/images/${cfg.fileKey}?ids=${q}&format=svg&svg_include_id=false&svg_outline_text=true`);
  for (const job of batch) {
    const url = images[job.id];
    if (!url) {
      console.warn(`Figma returned no SVG for ${job.dir}/${job.code}`);
      continue;
    }
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`Download failed for ${job.dir}/${job.code}: ${res.status}`);
      continue;
    }
    const svg = normalizeFigmaSvg(await res.text(), loadMeta(job.code).names?.en ?? job.code);
    const out = new URL(`flags/${job.dir}/`, root);
    mkdirSync(out, { recursive: true });
    writeFileSync(new URL(`${job.code}.svg`, out), svg);
    written++;
  }
}
console.log(`Done: ${written} of ${jobs.length} files written to flags/. Next: npm test.`);
