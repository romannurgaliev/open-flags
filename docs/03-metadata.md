# 03 — Метаданные флага

Один файл на флаг: `data/flags/<ISO alpha-2>.json`. Общие источники — `data/sources.json`. Проверка структуры — C13.

## Поля

| Поле | Что | Кто пишет |
|---|---|---|
| `code` | ISO 3166-1 alpha-2 | человек |
| `iso` | alpha-3, numeric, статус кода (`official` / `user-assigned`), версия CLDR | `npm run sync:cldr` |
| `names` | en, ru из CLDR | `npm run sync:cldr` |
| `classes` | Трудные классы: `disc`, `offset-disc`, `cross`, `square`, `bicolour-h`, `tricolour-v`, `fine-stripes`, `canton`, `union-jack`, `arms`, `emblem`, `text`, `sacred-text`, `map`, `ornament`, `crescent-star`, `repeated-charges`, `serrated`, `extreme-ratio`, `non-rectangular`, `geometric`, `white-edge`. От класса зависят проверки: например, C11 строга к сетке у `bicolour-h`, `tricolour-v`, `cross` | человек |
| `ratio` | `{h, w, source}`; для непрямоугольных — `{shape, w_over_h}` | человек |
| `adopted` | Дата принятия действующего рисунка и источник | человек |
| `sources` | Источники флага: `level`, `title`, `url`, `via`, `accessed`, `note` | человек |
| `colors.<key>` | `srgb` (выбранный), `status` (`ok` / `provisional` / `conflict`), `rule` (C-*), `specs` (все значения по источникам), `computed` (если пересчитан из колориметрии), `note` | человек; `computed` — по `src/color.mjs` |
| `construction` | Числа из чертежа построения в долях высоты (`_h`) или длины (`_l`), `source`, `text` — пересказ источника. Оценки лежат в `construction.estimate` и помечены `source: "estimate"` | человек |
| `probes` | Пробные точки для C09: `at` — доли ширины и высоты формата original, `color` — ключ цвета или `transparent`, `why` — откуда число | человек, по числам источника |
| `simplification` | По ступеням S, M, L: какое правило применено и что изменилось | человек; числа сверяются с выводом сборки |
| `confusable` | Коды флагов, с которыми этот путают | человек; см. [06](06-confusable-pairs.md) |
| `gaps` | Чего нет в источниках или не нарисовано | человек |
| `review` | Что нужно решить внешнему ревьюеру | человек |
| `status` | `full`: `ok` / `ok-estimate` / `draft`; `mini`: `ok` / `draft` / `blocked-review` | человек |

## Правила заполнения

- Числа построения пишутся так, как их даёт источник, без пересчёта «для удобства». Например, у Палау закон задаёт касательную на 1/4 длины и диаметр 0.6 высоты; в метаданных — центр 0.4375 длины с пояснением, как он получен.
- Пробная точка ставится по числу из источника с отступом 1–2% от края фигуры внутрь и наружу. Точка ровно на крае ловит сглаживание, а не ошибку. Так в пилоте исправлены две пробы: у JP точки «внутри» и «снаружи» были перепутаны, у NP точка стояла на краю полудиска — обе ошибки поймала C09.
- Оценка — не источник. Если число не из документа, оно идёт в `construction.estimate`, флаг получает статус `ok-estimate` или `draft`, а в `gaps` — что нужно найти.
- Поля `iso` и `names` руками не правятся.
