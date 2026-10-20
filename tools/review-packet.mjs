#!/usr/bin/env node
// Builds the vexillologist review packet from the metadata: for each flag, its sources, construction numbers,
// and the estimates and gaps turned into concrete questions. Prints Markdown.
import { allCodes, loadMeta } from '../src/build.mjs';

const out = [];
out.push('# Vexillologist review packet (generated from data/flags)\n');
out.push('For each flag: what we used as the source, which numbers we built from, and where we are unsure. The contact sheet `preview/contact-sheet.png` and the SVGs in `flags/original/` go with this packet.\n');
for (const c of allCodes()) {
  const m = loadMeta(c);
  out.push(`## ${c} — ${m.names.en}\n`);
  const r = m.ratio.shape ? `shape ${m.ratio.shape}, W/H ${m.ratio.w_over_h}` : `${m.ratio.h}:${m.ratio.w}`;
  out.push(`- Ratio: ${r}. Full-format status: ${m.status.full}.`);
  const srcs = Object.entries(m.sources).filter(([, s]) => !s.ref).map(([id, s]) => `${s.title} (level ${s.level}, read via: ${s.via})`);
  out.push(`- Sources: ${srcs.join('; ')}.`);
  const cons = Object.values(m.construction).find((v) => v && typeof v === 'object' && v.text)?.text ?? m.construction.text;
  if (cons) out.push(`- Construction: ${cons}`);
  const est = m.construction.estimate || m.construction.source === 'estimate' || Object.values(m.construction).some((v) => v?.source === 'estimate');
  const qs = [...m.gaps.map((g) => `Gap: ${g} Do you have the primary document?`), ...(est ? ['Some numbers are estimates from images. Do they match the official drawing?'] : [])];
  for (const [k, col] of Object.entries(m.colors)) if (col.status !== 'ok') qs.push(`Color "${k}" (${col.srgb}, ${col.status}): ${col.note ?? 'no level 1–2 source'}`);
  if (qs.length) {
    out.push('- Questions:');
    for (const q of qs) out.push(`  - ${q}`);
  }
  out.push('');
}
console.log(out.join('\n'));
