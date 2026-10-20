# 06 — Confusable pairs

Some flags become nearly identical in the unified formats and in miniatures. Distorting a flag to make it distinguishable is not allowed: a "bluer" Chad is no longer the flag of Chad. The policy:

1. Each flag's colors follow its own sources, with no adjustment toward its neighbor.
2. The pair is recorded in `confusable` on both flags.
3. The README and the Figma component descriptions recommend showing the country name or code next to the flag. A phone-code picker already shows the code.
4. Each pair gets its own row in the confusion matrix of the recognition test ([phase 2](phase2/recognition-test.md)).

## Measurements (pilot)

`node tools/confusable.mjs`. Each cell: share of pixels differing by more than ΔE2000 10 / mean ΔE2000 over the frame.

| Pair | square-16 | circle-16 | rect-24x16 | square-24 | square-40 | 1x1 (40 px) |
|---|---|---|---|---|---|---|
| TD — RO | 0% / 4.3 | 0% / 3.6 | 0% / 4.3 | 0% / 4.3 | 0% / 4.3 | 0% / 4.3 |
| ID — MC | 50% / 7.0 | 38% / 5.9 | 50% / 7.0 | 50% / 7.0 | 50% / 7.0 | 50% / 7.0 |
| AU — NZ | 22% / 12.5 | 23% / 11.3 | 18% / 11.6 | 19% / 11.5 | 19% / 11.6 | 22% / 11.3 |
| PW — KZ | 91% / 22.9 | 63% / 15.6 | 93% / 20.3 | 92% / 22.7 | 91% / 22.9 | 99% / 23.1 |
| CY — XK | 99% / 52.8 | 80% / 39.7 | 99% / 54.7 | 97% / 51.8 | 100% / 53.7 | 100% / 54.8 |
| PL — ID | 100% / 47.1 | 83% / 36.7 | 100% / 47.1 | 100% / 47.1 | 100% / 47.1 | 100% / 47.1 |

How to read it:

- **TD and RO** are indistinguishable in every format: the mean difference is 4.3 (shades of blue, yellow and red per Album 2023). This is the limit; without a label, users cannot tell them apart.
- **ID and MC** differ only in ratio (2:3 and 4:5) in the original format; in 3:2, 1:1 and the miniatures, only in the shade of red: #FF0000 for Indonesia, per the explanatory note to the law, and #D21034 for Monaco, per the Album. A difference of 14 in ΔE2000 is visible side by side, but not from memory.
- **AU and NZ** differ in the color of the stars (white vs. red) and in the Commonwealth Star. A mean of 11–12 is noticeable, but at 16 px the stars cover only a few pixels. Needs testing.
- **PW and KZ** are different pixel by pixel (different blue fields; KZ has a rayed sun, an eagle and an ornament), but the impression "light blue field with a yellow circle" needs testing. This is why KZ keeps its ornament at S (S-LINE).
- **CY and XK**, **PL and ID** are far apart pixel by pixel. They are in the registry as a control for the method: the test should show they are not confused.

## Pairs outside the pilot to add

| Pair | How they differ |
|---|---|
| NL — LU | Shade of blue and ratio |
| IE — CI | Stripe order (mirrored) |
| CO — EC | Ratio and Ecuador's coat of arms (S-NODROP) |
| SN — ML | Senegal's star |
| MX — IT | Mexico's coat of arms (S-NODROP) |
| QA — BH | Field color and number of points |
| HT — LI | Coats of arms |
| AU — NZ — TV — FJ | Blue fields with a Union Jack |
