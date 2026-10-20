#!/usr/bin/env node
// Собирает пакет для вексиллологов из метаданных: по каждому флагу — источники, числа построения,
// оценки и пробелы, превращённые в конкретные вопросы. Печатает Markdown.
import { allCodes, loadMeta } from '../src/build.mjs';

const out = [];
out.push('# Пакет для ревью вексиллологами (сгенерирован из data/flags)\n');
out.push('Для каждого флага: что мы взяли за источник, какие числа построили и где сомневаемся. К пакету прикладывается контактный лист `preview/contact-sheet.png` и SVG из `flags/original/`.\n');
for (const c of allCodes()) {
  const m = loadMeta(c);
  out.push(`## ${c} — ${m.names.en} (${m.names.ru})\n`);
  const r = m.ratio.shape ? `форма ${m.ratio.shape}, W/H ${m.ratio.w_over_h}` : `${m.ratio.h}:${m.ratio.w}`;
  out.push(`- Пропорция: ${r}. Статус полного формата: ${m.status.full}.`);
  const srcs = Object.entries(m.sources).filter(([, s]) => !s.ref).map(([id, s]) => `${s.title} (уровень ${s.level}, прочитано: ${s.via})`);
  out.push(`- Источники: ${srcs.join('; ')}.`);
  const cons = Object.values(m.construction).find((v) => v && typeof v === 'object' && v.text)?.text ?? m.construction.text;
  if (cons) out.push(`- Построение: ${cons}`);
  const est = m.construction.estimate || m.construction.source === 'estimate' || Object.values(m.construction).some((v) => v?.source === 'estimate');
  const qs = [...m.gaps.map((g) => `Пробел: ${g} Есть ли у вас первичный документ?`), ...(est ? ['Часть чисел — оценка по изображениям. Совпадает ли с официальным чертежом?'] : [])];
  for (const [k, col] of Object.entries(m.colors)) if (col.status !== 'ok') qs.push(`Цвет «${k}» (${col.srgb}, ${col.status}): ${col.note ?? 'источника уровня 1–2 нет'}`);
  if (qs.length) {
    out.push('- Вопросы:');
    for (const q of qs) out.push(`  - ${q}`);
  }
  out.push('');
}
console.log(out.join('\n'));
