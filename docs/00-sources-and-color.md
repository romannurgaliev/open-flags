# 00 — Sources and color

## Source priority

| Level | Source | How it is used |
|---|---|---|
| 1 | Law, decree, constitution, official standard | Ratio, construction, color. Always wins |
| 1g | Government document without the force of law (style guide, ASEAN specification) | Same as level 1, but marked separately |
| 2 | Album des pavillons (SHOM), 2023 edition, 2025 when available | Pantone/CMYK/RGB colors; the drawing when the law is silent |
| 3 | Flags and Anthems Manual, London 2012 | Pantone values recommended by national Olympic committees, not governments |
| 4 | FOTW, Flag Institute, Natural Earth | History of changes, comparison of sources, transcriptions of laws |
| 5 | Wikipedia, Wikimedia Commons, hampusborgos, catamphetamine, flagcolorcodes | Comparison only. No geometry is taken from them; a color only as `provisional` |

When sources conflict, every value is recorded (`colors.<key>.specs`), the chosen one goes in `srgb`, and the rule that chose it in `rule`.

A source's `via` field says how it was read: `direct` (the document itself), `fotw` (a transcription on FOTW), `wikipedia` (a quotation citing the document), `transcription` (another reprint). A transcription does not raise the level: a law read through FOTW stays level 1, marked `via: fotw`; it does not become a "law we have read".

## What the pilot has read

Network access from the build environment: the shell reaches npm, PyPI, `api.figma.com` and `www.figma.com`; FOTW, ISO, Natural Earth, SHOM and unicode.org are blocked from the shell, so FOTW pages were read through a web fetch tool.

| Source | Status |
|---|---|
| Laws | Read directly only for Japan (Cabinet Office website). The rest through FOTW transcriptions, Wikipedia and ushistory.org. This is the pilot's main gap |
| Album des pavillons 2023 | Paid; values taken from quotations on FOTW. The 2025 edition has not been read |
| London 2012 | The PDF is available; values taken through FOTW |
| ASEAN flag specification (MY) | Read directly |
| Flag Institute: Union Flag | Read directly |
| Natural Earth 1:50m | Through the npm package `world-atlas` 2.0.2 |
| Unicode CLDR 45 | Through the npm packages `cldr-core` and `cldr-localenames-modern` |

Coverage by flag (from `node tools/coverage.mjs`):

| Flag | Ratio | Construction | Colors ok / provisional / conflict | Full formats | Miniatures |
|---|---|---|---|---|---|
| AU | 1g | 4 | 3 / 0 / 0 | ok | ok |
| BD | 1 | 1 | 2 / 0 / 0 | ok | ok |
| BR | 1 | 1 | 3 / 0 / 1 | draft | ok |
| CH | 1 | 1 | 2 / 0 / 0 | ok | ok |
| CY | 1 | 4 | 3 / 0 / 0 | draft | draft |
| ES | 1 | 1 | 3 / 0 / 0 | draft | draft |
| FJ | 4 | estimate | 4 / 1 / 0 | draft | draft |
| ID | 1 | 1 | 2 / 0 / 0 | ok | ok |
| JP | 1 | 1 | 1 / 1 / 0 | ok | ok |
| KZ | 1 | estimate | 0 / 2 / 0 | draft | draft |
| MC | 1 | 1 | 2 / 0 / 0 | ok | ok |
| MX | 1 | 1 | 3 / 2 / 0 | draft | draft |
| MY | 1g | estimate | 1 / 3 / 0 | ok-estimate | ok |
| NP | 1 | 1 | 2 / 1 / 0 | ok | ok |
| NZ | 1 | 4 | 3 / 0 / 0 | ok-estimate | ok |
| PL | 1 | 1 | 2 / 0 / 0 | ok | ok |
| PW | 1 | 1 | 2 / 0 / 0 | ok | ok |
| QA | 1 | 2 | 1 / 1 / 0 | ok | ok |
| RO | 1 | 1 | 3 / 0 / 0 | ok | ok |
| SA | 1 | 1 | 2 / 0 / 0 | draft | blocked-review |
| TD | 4 | 1 | 1 / 2 / 0 | ok | ok |
| TM | 4 | 4 | 4 / 1 / 0 | draft | draft |
| US | 1 | 1 | 3 / 0 / 0 | ok | ok |
| VA | 1 | 1 | 2 / 2 / 0 | draft | draft |
| XK | 4 | 4 | 1 / 2 / 0 | draft | draft |

74 colors in total: 55 ok, 18 provisional, 1 conflict. The provisional ones include design colors for miniature details that have no source at all (the MX eagle, the VA keys).

## Rules for choosing sRGB

| Rule | When | What is used |
|---|---|---|
| C-L1-RGB | Level 1 gives RGB or hex | That value |
| C-L1-CIE | Level 1 gives colorimetry (PL: CIE xyY, ES: CIELAB) | Converted to sRGB by `src/color.mjs`: xyY or L\*C\*h → XYZ → Bradford adaptation to D65 → sRGB. A value outside the sRGB gamut is clipped and flagged |
| C-PANTONE-MAP | Level 1 gives only Pantone | The RGB that the Album 2023 table gives for that Pantone (`data/sources.json → album2023-pantone-map`) |
| C-ALBUM-FLAG | Level 1 gives no numbers | The Album 2023 entry for this flag |
| C-CONFLICT | The C-PANTONE-MAP result differs from the Album entry for the flag by more than ΔE2000 10 | The Album entry for the flag, status `conflict`, a maintainer decides. Usually this means level 1 named a generic Pantone ("PMS Yellow" for Brazil) |
| C-PROVISIONAL | None of the above, or the Pantone is missing from the Album table | A value from a lower level that claims the same Pantone; status `provisional` |
| C-WHITE | White field | `#FFFFFF`. If the law defines white colorimetrically (PL: Y = 82, which describes fabric), the computed value is kept in `computed`, but the screen gets white; otherwise the field looks gray |
| C-DESIGN | Color of a miniature detail that has no source | A design choice, always `provisional` |

The threshold of 10 marks the line between "different colors" and "shades of one color": ΔE2000 around 2 is visible side by side; 10 is a clearly different color.

Conflicts found, ΔE2000:

| Flag | What against what | ΔE2000 | Decision |
|---|---|---|---|
| BR yellow | PMS Yellow from the Album table (#FFFF00) vs. the Album entry for Brazil, 7408c (#F8C100) | 17.9 | C-CONFLICT, #F8C100 used |
| KZ yellow | 102U per Ellis (#FFF203) vs. golden (#FEC50C) | 14.1 | Provisional #FFF203 until ST RK 988-2007 is read |
| TM red | 1795c from the table (#D51F2A) vs. the Album entry for TM (#B31B34) | 9.0 | Below the threshold, table value used |
| NZ blue | 280c from the table vs. 287c from the Album entry for NZ | 5.2 | Below the threshold, table value used |
| PL red | Computed from the law's CIE values vs. Album 1795c | 5.1 | The law |
| JP red | Album 186C vs. London 2012 032 | 8.5 | Album; the law only says 紅色 (crimson) |

The Album 2023 table contradicts itself: 287c has two RGB values (for NZ and for BR), and so does 186c (FJ and the rest). This is recorded in `data/sources.json`.

## Before release 1.0

1. Read the laws directly. Priority: flags with estimates (MY, NZ, FJ, KZ, TM, XK) and flags whose level 1 source only names the color (JP, BD, PW, NP, TD).
2. Buy the Album des pavillons 2025 or find it in a library: it is the only reference with drawings and three color systems for every flag.
3. Get sRGB for each Pantone from the primary source (Pantone Connect) instead of the Album table, where the Album gives different RGB values for the same Pantone.
