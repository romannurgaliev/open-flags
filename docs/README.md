# open-flags specification (pilot 0.1)

The pilot tests the approach on 25 flags rather than drawing all 250. The specification exists so that "better than the alternatives" can be checked, and so that someone else can pick up the work.

| Document | What it settles |
|---|---|
| [00 — Sources and color](00-sources-and-color.md) | Source priority, what has and has not been read, rules for choosing sRGB |
| [01 — Inclusion and releases](01-inclusion-and-releases.md) | Which flags are included, how changes are tracked, semver for assets |
| [02 — License](02-license.md) | Separate terms for artwork and code, provenance of each flag |
| [03 — Metadata](03-metadata.md) | The `data/flags/<CODE>.json` schema |
| [04 — Formats and tiers](04-unified-and-miniature.md) | Which formats exist and why, unification rules U1–U4 |
| [05 — Simplification rules](05-simplification-rules.md) | Per-tier S rules: minimum sizes, leftover pixels, text, coats of arms, cantons |
| [06 — Confusable pairs](06-confusable-pairs.md) | Registry with measurements, and the policy of never distorting a flag |
| [07 — CI checks](07-ci-checks.md) | C01–C16, negative tests, Figma comparison |
| [08 — Contributing](08-contributing.md) | Figma as the master, the repository for releases, changes through issues |
| [Phase 2](phase2/) | External review plan: recognition test, vexillologists, native speakers |

## Pilot status

- 25 flags × 6 formats = 150 SVGs in `flags/`, all passing C01–C16.
- 22 negative tests: every check fails on a broken copy.
- Figma file: [Open Flags — pilot 0.1](https://www.figma.com/design/WfVWKCZNF2MyqZw7FishR2), 6 component sets with a Country property. Pixel comparison between Figma and the repository (run while there were 12 formats): 0 mismatches across 2.2 million interior pixels.
- The full formats of ten flags are drafts: emblems, coats of arms, inscriptions and maps have not been drawn from the official artwork (BR, CY, ES, FJ, KZ, MX, SA, TM, VA, XK). Each flag's `gaps` field lists what is missing.

## Terms

- **Tier**: the size class of a miniature, by its short side. S = 16 px, M = 24 px, L = 40 px.
- **Full formats**: `original` (the ratio set by law) and `3x2`. Unsimplified artwork for sizes from about 48 px up.
- **Miniatures**: `rect-24x16` (tier S), `rect-36x24` (M), `circle-24` (M), `circle-40` (L). Geometry on the pixel grid, simplified under the S rules.
- **Source level**: 1 law or government document (1g: a guideline without the force of law), 2 Album des pavillons, 3 London 2012, 4 FOTW and other secondary sources, 5 Wikipedia and other flag sets (comparison only).
