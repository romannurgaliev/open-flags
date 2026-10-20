# 08 — Contributing

## Who edits what, where

| What | Where | Who |
|---|---|---|
| Flag artwork (geometry, emblems, miniatures) | The Figma file, `Flag / …` sets | Maintainer |
| Construction numbers, colors, sources, probe points | `data/flags/*.json` | Maintainer, or a contributor through a PR |
| SVGs in `flags/` | Only the Figma export (`export-figma.yml`) or the generator (`npm run build`) for geometry defined by law | Nobody, by hand |
| Simplification rules | `docs/05`, `src/flags.mjs` | Maintainer |

Figma Community does not accept pull requests, and an SVG fixed by hand drifts away from the master. So outside contributors send an **issue with a primary source**, not an SVG. The template is `.github/ISSUE_TEMPLATE/flag-change.yml`: country, what is wrong, a link to the law or the Album, with the page or section.

## Generator and Figma: which comes first

In the pilot, geometry defined by the law's numbers (stripes, discs, crosses, stars, Nepal's construction) is built by the generator `src/flags.mjs` from the metadata and loaded into Figma. Emblems, coats of arms, inscriptions and maps from official artwork are drawn by hand in Figma. After that, Figma is the master for everything: the next export comes from Figma, and the checks compare it with the metadata (C09) and with the previous release (C15).

Rules for editing in Figma:

- Do not make the circle shape by clipping the frame; use geometry only (Boolean → Intersect). Otherwise the export either adds a clip-path (C04) or drops it, and the circle becomes a square (C08).
- Do not fill the component frame: a frame fill is a hidden fill, or a white square around the circle.
- Keep everything inside the component frame (C16).
- After any geometry change, export one SVG of each shape type as a test before doing bulk work.

## Pull requests

1. Metadata changes come with a source in `sources`, including its level.
2. Run `npm test` locally or let CI run it.
3. If artwork changed, include the contact sheet from the CI artifacts in the PR description.
4. A color change of more than ΔE2000 2, or a geometry change of more than 1%, needs a level 1 or 2 source.
