# open-flags — notes for agents

Country flag library: full formats from each country's law, plus 3:2 and circular miniatures with written simplification rules. Six formats: `original`, `3x2`, `rect-24x16`, `rect-36x24`, `circle-24`, `circle-40` (`docs/04`). Adding a format is a minor version, removing one is major, so don't add formats without a concrete use. Pilot of 25 flags. The spec is in `docs/` (start with `docs/README.md`); read the relevant doc before changing rules, metadata or checks.

## Language

- Everything public is in English, American spelling: docs, code comments, script output, commit messages, PR titles and bodies, issue templates, Figma descriptions.
- The one exception is `names.ru` in `data/flags/*.json`: CLDR data, keep it.
- Spelling changes must not touch identifiers. Class names (`bicolor-h`, `tricolor-v`, …), metadata keys and rule IDs are code; renaming one means updating every use (see `GRID_CLASSES` in `scripts/lib/checks.mjs`).
- Write plainly: no inflated wording, no marketing tone.

## Where things come from

- `flags/` is generated, never edited by hand. Two sources: the Figma export (`npm run export:figma`, or the "Export flags from Figma" workflow) and the generator (`npm run build`) for geometry defined by law.
- Figma is the master once artwork is there. `flags/` on main currently comes from the Figma export. `npm run build` rewrites every SVG in the generator's own formatting (attribute order, `L` instead of `H`/`V`), so a build produces format-only diffs. Do not commit those unless geometry actually changed, and then load the result into Figma too.
- Every number in `data/flags/*.json` needs a source with a level (1, 1g, 2–5; see `docs/00`). Level 5 (Wikipedia, other flag sets) is for comparison only. A number not taken from a document goes in `construction.estimate`, and the flag's `gaps` says what is missing.
- Colors follow the C-* rules in `docs/00`. Never adjust a flag's colors to make it easier to tell apart from another flag (`docs/06`).
- Do not edit `iso` and `names` by hand: `npm run sync:cldr`.

## Checks

- Run `npm test` after any change: checks C01–C16 plus negative tests N01–N22. Both must pass.
- Every check has a negative test that breaks a real file and requires that check to fail. A new check needs a new N test. Write mutations that don't depend on attribute order: Figma and the generator order attributes differently (N09 broke on this once).
- When a negative test stops catching its breakage, the mutation is usually the problem, not the check. Look at the broken copy in `tests/broken/`.
- C15 (diff against `baseline/`) reports changes and does not fail. `npm run baseline` is only for releases.

## Figma

- File key `WfVWKCZNF2MyqZw7FishR2`; set IDs are in `figma.json`. Variants are named `Country=<alpha-2>`.
- Circles are real geometry (Boolean → Intersect), never a clipping frame or mask. No fill on component frames. Nothing outside the frame (C16).
- The export adds `fill="none"` to the root, `clip-rule` to paths and writes `white`; `scripts/normalize.mjs` removes these. Anything else Figma adds (clipPath, mask, transform, g) must be fixed in Figma, not in the repo.
- `original` sizes are integers because Figma rounds the viewBox (`src/build.mjs`, `originalSize`).

## Git and GitHub

- Work on a branch and open a PR. Do not push to main or merge without the maintainer's explicit go-ahead.
- PRs opened by the export workflow (GitHub Actions bot) don't run CI until approved; run `npm test` on the branch yourself before merging.
- Changes to colors above ΔE2000 2 or geometry above 1% need a level 1 or 2 source (`docs/08`).
