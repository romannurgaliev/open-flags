#!/usr/bin/env node
// Таблица покрытия источниками по метаданным: уровень источника пропорции и построения,
// статусы цветов, статус форматов. Печатает Markdown.
import { readFileSync } from 'node:fs';
import { allCodes, loadMeta } from '../src/build.mjs';

const global = JSON.parse(readFileSync(new URL('../data/sources.json', import.meta.url), 'utf8'));
const lvl = (m, id) => (id === 'estimate' ? 'оценка' : (m.sources[id]?.level ?? global[id]?.level ?? '?'));
console.log('| Флаг | Пропорция | Построение | Цвета ok / provisional / conflict | Полные форматы | Миниатюры | Пробелов |');
console.log('|---|---|---|---|---|---|---|');
const tot = { ok: 0, provisional: 0, conflict: 0 };
for (const c of allCodes()) {
  const m = loadMeta(c);
  const cons = m.construction?.source ?? Object.values(m.construction ?? {}).find((v) => v?.source)?.source;
  const st = { ok: 0, provisional: 0, conflict: 0 };
  for (const v of Object.values(m.colors)) st[v.status]++;
  for (const k in st) tot[k] += st[k];
  console.log(`| ${c} | ${lvl(m, m.ratio.source)} | ${cons ? lvl(m, cons) : '—'} | ${st.ok} / ${st.provisional} / ${st.conflict} | ${m.status.full} | ${m.status.mini} | ${m.gaps.length} |`);
}
console.log(`\nЦвета всего: ok ${tot.ok}, provisional ${tot.provisional}, conflict ${tot.conflict}.`);
