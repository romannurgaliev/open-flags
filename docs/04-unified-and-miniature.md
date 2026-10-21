# 04 — Formats, tiers and unification rules

## Formats

| Directory | Canvas | Tier | Purpose |
|---|---|---|---|
| `flags/original/` | height near 600, ratio set by law; integer width and height | — | The accurate flag |
| `flags/3x2/` | 900×600 | — | One size for tables and grids; the source for any size above about 48 px |
| `flags/mini/rect-24x16/` | 24×16 | S | A line of text, phone-code pickers |
| `flags/mini/rect-36x24/` | 36×24 | M | List items, pickers with larger flags |
| `flags/mini/circle-24/` | 24×24 | M | Round icons in lists |
| `flags/mini/circle-40/` | 40×40 | L | Avatars in lists |
| `overlays/` | same as the miniatures | | 1 px outline (black, 12%) for flags with white edges: laid on top of the flag, not baked in |

### Why only six

The pilot started with 12 formats: 1:1 at full size, and square, circle and 3:2 miniatures at all three tiers. Six were dropped:

- **Square miniatures and the full 1:1.** A square and a 3:2 rectangle of the same tier follow the same simplification rules, so the square added files without adding a design decision. No picker in the survey below needs a square except emoji slots.
- **Circle 16.** A 16 px circle is too small for most flags; inline use is covered by the 24×16 rectangle.
- **Rectangle 60×40.** The L tier is barely simplified: at 40 px high the 3:2 artwork reads on its own.

The main cost of a format is hand drawing: every flag with a coat of arms or emblem needs each miniature drawn separately in Figma. Under semver (`docs/01`), adding a format later is a minor version and removing one is major, so the set starts small. A square or another size can come back when someone needs it.

Circles stay as their own format because they are not a square with `border-radius`: charges near the edge are moved inward or shortened (S-CIRCLE), which a CSS mask cannot do.

## Where 16 / 24 / 40 come from

The tiers come from the sizes at which flags are actually shown in country and phone-code pickers. The values are taken from the CSS of published packages (npm, versions as of October 21, 2026) and from Durev VPN in production.

| Where | Default flag size | Shape |
|---|---|---|
| intl-tel-input 29.5.6 | 20 px wide, 15 high (4:3) | rectangle |
| react-phone-number-input 3.4.18 | height 1em, ratio 1.5 → 24×16 at a 16 px font; 1 px rgba(0,0,0,.5) frame | 3:2 |
| react-international-phone 4.8.0 | 24×24 | square (emoji) |
| flag-icons 7.6.0 | 1.333em × 1em or 1em × 1em | 4:3, 1:1 |
| country-flag-icons 1.6.20 | height 1em | 3:2 |
| durev-flags (production) | circle 40 (36 artwork + 2 border), rectangle 21×14 | circle, 3:2 |

Conclusion: in interfaces the short side of a flag is 14–16 px (a line of text), 24 px (a list icon, emoji) or 40 px (a list avatar). Hence S = 16, M = 24, L = 40. The S rectangle, 24×16, matches react-phone-number-input; the L circle is close to the one in durev-flags.

Not done yet: native iOS and Android pickers have not been measured (no device was available), and the Material and HIG specifications have not been read. 4:3 (intl-tel-input, flag-icons) is not part of the pilot; it is an open question.

## Integer sizes

The width and height of `original` are integers. The reason is practical: the Figma export rounds the viewBox to integers, and a fractional width (Brazil's was 857.14) shifts the content. So the height is the number nearest 600 that gives an integer width (BR 860×602, QA 1540×605). Nepal's ratio is irrational: the width is 492, an error of 0.04%.

## Unification rules

| Rule | Statement | Example |
|---|---|---|
| U1 | Field divisions along the length scale with the length; along the height, with the height | Qatar's white band is 8/28 of the length in every format |
| U2 | Charges (discs, stars, coats of arms, cross arm widths) scale with the height and are not stretched | Japan's disc is 0.6 of the height in both the original and 3:2 |
| U3 | A charge's center is a fraction of the length horizontally and of the height vertically, as in the source | Bangladesh's disc sits at 9/20 of the length in every format, keeping its offset toward the hoist |
| U4 | A canton defined as "the upper hoist quarter" becomes a square in the circular miniatures; the Union Jack runs corner to corner of the canton's frame | AU, NZ, FJ |
| U-SHAPE | A non-rectangular flag is not stretched: the shape is fitted into the canvas on a transparent background | Nepal in every format |
| U-LAW | If the law itself sets a rule for another format, that rule is used | Spain: on square and small flags the coat of arms is centered (RD 2964/1981) |

A canton defined as a fraction of the height (US: 0.76 of the height) stays a fraction of the height, so in a circle's square frame it takes 76% of the width. This is the hoist-side crop other sets use, derived from the rule instead of chosen by eye.

In the circular miniatures the Southern Cross stars are compressed by f = (width of the fly half) / height; otherwise Beta runs into the canton. For miniatures, f is multiplied by `mini_spread` from the metadata.
