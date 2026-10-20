# 03 — Flag metadata

One file per flag: `data/flags/<ISO alpha-2>.json`. Shared sources live in `data/sources.json`. C13 checks the structure.

## Fields

| Field | What | Written by |
|---|---|---|
| `code` | ISO 3166-1 alpha-2 | a person |
| `iso` | alpha-3, numeric, code status (`official` / `user-assigned`), CLDR version | `npm run sync:cldr` |
| `names` | en and ru from CLDR | `npm run sync:cldr` |
| `classes` | Hard classes: `disc`, `offset-disc`, `cross`, `square`, `bicolor-h`, `tricolor-v`, `fine-stripes`, `canton`, `union-jack`, `arms`, `emblem`, `text`, `sacred-text`, `map`, `ornament`, `crescent-star`, `repeated-charges`, `serrated`, `extreme-ratio`, `non-rectangular`, `geometric`, `white-edge`. Some checks depend on the class: for example, C11 enforces the pixel grid for `bicolor-h`, `tricolor-v` and `cross` | a person |
| `ratio` | `{h, w, source}`; for non-rectangular flags, `{shape, w_over_h}` | a person |
| `adopted` | Adoption date of the current design, with its source | a person |
| `sources` | The flag's sources: `level`, `title`, `url`, `via`, `accessed`, `note` | a person |
| `colors.<key>` | `srgb` (the chosen value), `status` (`ok` / `provisional` / `conflict`), `rule` (C-*), `specs` (every value from every source), `computed` (if converted from colorimetry), `note` | a person; `computed` by `src/color.mjs` |
| `construction` | Numbers from the construction drawing as fractions of the height (`_h`) or length (`_l`), `source`, and `text`, a paraphrase of the source. Estimates go in `construction.estimate` and are marked `source: "estimate"` | a person |
| `probes` | Probe points for C09: `at` is a fraction of the original format's width and height, `color` is a color key or `transparent`, `why` says where the number comes from | a person, from the source's numbers |
| `simplification` | Per tier S, M, L: which rule was applied and what changed | a person; numbers are checked against the build output |
| `confusable` | Codes of flags this one is mistaken for | a person; see [06](06-confusable-pairs.md) |
| `gaps` | What the sources lack or what has not been drawn | a person |
| `review` | What an external reviewer needs to decide | a person |
| `status` | `full`: `ok` / `ok-estimate` / `draft`; `mini`: `ok` / `draft` / `blocked-review` | a person |

## How to fill them in

- Construction numbers are written as the source gives them, not converted "for convenience". For example, Palau's law puts the disc's hoist-side tangent at 1/4 of the length and its diameter at 0.6 of the height; the metadata stores the center at 0.4375 of the length, with a note on how it was derived.
- A probe point is placed from a number in the source, 1–2% inside and outside the edge of the shape. A point exactly on the edge catches antialiasing, not errors. Two probes were fixed this way in the pilot: the JP "inside" and "outside" points were swapped, and an NP point sat on the edge of the half-disc. C09 caught both.
- An estimate is not a source. A number that does not come from a document goes in `construction.estimate`, the flag gets status `ok-estimate` or `draft`, and `gaps` says what needs to be found.
- Do not edit `iso` and `names` by hand.
