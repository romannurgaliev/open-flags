# 05 — Miniature simplification rules

A miniature is not a scaled-down flag but a separate drawing made for its size. At S and M the goal is to be recognizable and distinguishable, not to reproduce every detail. Each simplification is recorded in the flag's metadata (`simplification.S/M/L`) with its rule; the build (`src/flags.mjs`) implements the rules, and checks C08 and C11 verify the result.

## Thresholds by tier

| | S (16) | M (24) | L (40) |
|---|---|---|---|
| Minimum charge | 2 px; a point charge may be 1 px if its contrast with the field is ΔL\* ≥ 40 | 2 px | 2 px |
| Minimum gap | 1 px | 1 px | 1 px |
| Minimum stripe | 2 px | 2 px | 2 px |
| Step of repeated elements (points, dots) | ≥ 3 px | ≥ 3 px | ≥ 4 px |
| Colors in an emblem | 2 | 3 | 5 |
| Text | none | none | none |
| Fimbriation under 0.5 px | dropped | dropped | dropped |

## Rules

| Rule | Statement | Pilot example |
|---|---|---|
| S-STRIPES | Stripes are whole pixels. The leftover is distributed symmetrically from the center: with an odd leftover the extra pixel goes to the middle stripe, with an even one to pairs from the center outward. If there are more stripes than fit at 2 px each, their number is reduced to the largest that keeps the same colors at the edges | RO at 16 px: 5/6/5. US: 13 stripes → 7 at S (2,2,3,2,3,2,2), 11 at M, 13 at L. MY: 14 → 8 → 12 → 14 |
| S-CANTON | The canton's lower edge sits on the stripe boundary nearest to its fraction in the source | US: 7/13 of the height → the boundary after the 4th stripe at S |
| S-DISC | The disc's diameter is the nearest integer with the same parity as the canvas along the centering axis (no half-pixel center); its bounds sit on integer coordinates | JP: 10 / 14 / 24 px. BD: 10 / 16 / 26 px, offset toward the hoist kept |
| S-RATIO | If whole pixels cannot reproduce the source's proportion, a deviation of up to 20% is allowed and recorded | CH: arm 4 px wide and 4 px long at S (1.0 instead of 7/6, −14%); 4 and 5 at M (+7%); 8 and 9 at L (−4%) |
| S-REPEAT | Identical repeated elements are reduced in number while keeping the pattern type (grid, arc, row); an odd count stays odd | QA: 9 points → 5 at S, 7 at M, 9 at L. US: 50 stars → a checkerboard of 1 px dots. KZ: 32 rays → 8 → 16 → 32 |
| S-POINT | A star or point charge smaller than 4 px is drawn as a pixel dot (a 1×1 or 2×2 square) on the grid, not as a polygon: a 3 px polygon turns into a blurry smudge | The Southern Cross on AU and NZ at S and M |
| S-POINTS | A star with more than 8 points is drawn with 8 at S and M | MY: 14 → 8 |
| S-FIMB | Fimbriation thinner than 0.5 px is dropped; the charge keeps its own color. A 1 px white border around a 2 px red star turned into a white square and recolored the flag | NZ: the stars on miniatures are red, without the white border |
| S-UJ | The Union Jack at S and M has no red saltire (at 8–12 px it is under 1 px); from L on it is 1 px, offset by the "broad white uppermost at the hoist" rule | AU, NZ, FJ |
| S-EMBLEM | A coat of arms or emblem becomes a silhouette of its main figures, within the tier's color limit | MX at S: a brown blot for the eagle and a green line; at M: eagle, cactus, the arc of the wreath |
| S-EMBLEM-DROP | A coat of arms may be dropped at S only if **(a)** the law allows the flag without it **and** **(b)** without it the flag does not match any other flag | ES at S: the Constitution allows the civil flag without the arms; no match |
| S-NODROP | A coat of arms may not be dropped if the flag would then match another one | MX without arms ≈ IT |
| S-TEXT | Inscriptions are not reproduced as letters. A motto on a band is dropped and the band stays. Sacred text is replaced by a schematic of lines only after native speakers decide; until then the miniatures stay out of releases | BR: the band without "ORDEM E PROGRESSO". SA: `blocked-review` |
| S-MAP | A map is a Natural Earth silhouette simplified with Douglas–Peucker (0.45 px at S, 0.35 px at M and L); islands under 0.5 px² are dropped; in the square format the map is enlarged by 25% | CY, XK |
| S-LINE | A 1 px line is allowed if it is an identifying element and without it the flag would match another one | KZ: the hoist ornament tells it apart from PW |
| S-CIRCLE | In a circle, charges near the edge are pulled toward the center to keep ≥ 1 px from the edge; tall elements are not pulled in but shortened to the chord | AU: the Commonwealth Star; KZ: the ornament |
| S-MIN | A shape's border is at least 1 px | NP: the blue border of the pennants |
| U-SHAPE | See [04](04-unified-and-miniature.md) | NP |

## Open questions for the recognition test

- **Stripes in a circle.** In durev-flags the middle stripe of a tricolor is wider in a circle (11/14/11); here the stripes are equal with the leftover in the middle (13/14/13 at 40). Needs an A/B test.
- **US at S.** A checkerboard of dots vs. a solid blue canton.
- **ES at S.** No coat of arms (per the rule) vs. a simplified coat of arms.
- **4:3.** Whether intl-tel-input and flag-icons need that format.
