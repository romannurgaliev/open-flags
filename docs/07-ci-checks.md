# 07 — CI checks

`npm test` runs `scripts/check.mjs` (all checks) and `scripts/negative.mjs` (each check against a broken copy). In GitHub Actions, `.github/workflows/ci.yml` runs on every PR and push to main; the report goes to the run's Summary, and the contact sheet and broken copies to its artifacts.

## Checks

| ID | What | Where it comes from |
|---|---|---|
| C01 | A file exists for every country and format, and there are no extra files | durev-flags |
| C02 | Valid XML, root `<svg>` with xmlns | durev-flags |
| C03 | viewBox `0 0 W H`; width and height match the format | durev-flags |
| C04 | No text, image, use, clipPath, mask, filter, style, script, gradient or pattern; no stroke, clip-path, clip-rule, transform, href, opacity or fill-opacity | durev-flags: circles relied on clip-path, Figma dropped it, and 13 circles were exported as squares |
| C05 | Every path has an explicit `#RRGGBB` fill and fill-rule; all subpaths are closed; a path with several subpaths must be evenodd | durev-flags: open subpaths; normalization commit c5525e5 removed evenodd from 13 flags, so rings risked turning into discs |
| C06 | Every fill is a color from the flag's metadata | durev-flags: the palette was checked by hand |
| C07 | Every path changes at least one pixel | durev-flags: hidden fills. In the pilot it immediately found the AU and NZ canton blue, which matched the field |
| C08 | A rectangle is fully covered; a circle has nothing outside it and no holes inside | durev-flags: square circles, gaps |
| C09 | Probe points from the metadata match their color (ΔE2000 ≤ 3) | New: comparison with the law's numbers. In the pilot it found two errors in the metadata itself (JP, NP) |
| C11 | Rectilinear flags (`bicolor-h`, `tricolor-v`, `cross`, US) have no mixed pixels in miniatures | durev-flags: whole-pixel stripes and crosses were checked by eye |
| C12 | File size within budget: 6 KB for miniatures, 40 KB for full formats (`meta.budget` overrides) | New |
| C13 | Metadata: required fields, source references, color format, color selection rule | New |
| C14 | The original aspect ratio matches the metadata (0.1% tolerance) | New |
| C15 | Visual diff against `baseline/` (the previous release snapshot): a report of changed files, not a failure | durev-flags: a before/after contact sheet in the PR |
| C16 | Geometry stays inside the viewBox | Found during the Figma comparison: the VA keys stuck out of the canvas, and Figma grew the export to 18×16 |

C10 is reserved for checking construction numbers against outlines (probe points do this for now).

## Negative tests

`node scripts/negative.mjs` takes real files, breaks them one at a time and requires the matching check to fail. The broken copies are written to `tests/broken/`. Control: the same files without breakage pass every check.

| Test | Check | Breakage |
|---|---|---|
| N01 | C01 | file deleted |
| N02 | C01 | extra file |
| N03 | C02 | closing tag cut off |
| N04 | C03 | viewBox 17×16 instead of 16×16 |
| N05 | C04 | text in the SVG |
| N06 | C04 | raster image |
| N07 | C04 | circle relies on clip-path |
| N08 | C08 | clip-path dropped: circle exported as a square |
| N09 | C05 | unclosed subpath |
| N10 | C05 | no fill-rule |
| N11 | C05 | nonzero on a path of 50 subpaths |
| N12 | C06 | color not in the palette |
| N13 | C07 | hidden fill under the field |
| N14 | C04 | invisible fill via fill-opacity |
| N15 | C08 | hole: the base layer is missing |
| N16 | C09 | Japan's disc 10% larger than the law |
| N17 | C11 | stripes off the pixel grid |
| N18 | C12 | file over budget |
| N19 | C14 | ratio 2:3 instead of 5:8 |
| N20 | C13 | color has no srgb |
| N21 | C15 | Swiss cross wider and longer |
| N22 | C16 | Vatican key outside the canvas |

All 22 breakages are caught.

## Figma comparison

Figma is the master ([08](08-contributing.md)), so the pilot checked that Figma does not alter the artwork:

1. **Plugin export.** All 300 variants were exported from Figma as SVG and checked: no clipPath, mask, g or transform; evenodd on every path; all subpaths closed; viewBox matches the size. Two findings were fixed in the generator: the fractional original width (Figma rounds the viewBox) and the VA geometry outside the canvas.
2. **Normalization.** The Figma export always adds `fill="none"` to the root and `clip-rule` to paths, and writes white as `white`. `scripts/normalize.mjs` removes this without touching geometry. On two real Figma exports (`tests/figma-export/`) the normalized file passes every check and the raw one does not (C04, C05).
3. **Pixels.** `tools/figma-roundtrip.mjs` compared the Figma render of each of the 300 variants with the render of the repository SVG, interior pixels only: 0 mismatches across 2.2 million pixels. Control: swapping the sets produces thousands of mismatches.
4. **REST export.** The first run of `export-figma.yml` (GET `/v1/images`, format=svg) exported all 300 files; after normalization they pass C01–C16. The differences from the generator's files are formatting only: attribute order, and `H`/`V` path commands instead of `L`. The rendered pixels are unchanged.
