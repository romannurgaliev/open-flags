#!/usr/bin/env node
// Adds ISO codes (alpha-3, numeric) and names (en, ru) from Unicode CLDR to data/flags/*.json.
// The iso and names fields are generated; do not edit them by hand.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';

const req = (p) => JSON.parse(readFileSync(new URL(`../node_modules/${p}`, import.meta.url), 'utf8'));
const maps = req('cldr-core/supplemental/codeMappings.json').supplemental.codeMappings;
const names = Object.fromEntries(['en', 'ru'].map((l) => [l, req(`cldr-localenames-modern/main/${l}/territories.json`).main[l].localeDisplayNames.territories]));
const cldrVersion = req('cldr-core/package.json').version;
const USER_ASSIGNED = new Set(['XK']);

const dir = new URL('../data/flags/', import.meta.url);
for (const f of readdirSync(dir).filter((x) => x.endsWith('.json'))) {
  const url = new URL(f, dir);
  const d = JSON.parse(readFileSync(url, 'utf8'));
  const m = maps[d.code] ?? {};
  const iso = {
    alpha2: d.code,
    alpha3: m._alpha3 ?? null,
    numeric: m._numeric ?? null,
    status: USER_ASSIGNED.has(d.code) ? 'user-assigned' : 'official',
    source: `cldr ${cldrVersion}`,
  };
  const nm = { en: names.en[`${d.code}-alt-short`] ?? names.en[d.code], ru: names.ru[`${d.code}-alt-short`] ?? names.ru[d.code] };
  const { code, ...rest } = d;
  delete rest.iso;
  delete rest.names;
  writeFileSync(url, JSON.stringify({ code, iso, names: nm, ...rest }, null, 2) + '\n');
}
console.log('CLDR', cldrVersion, '→ data/flags');
