# Phase 2 — Recognition test (plan, not run yet)

## Question

Are our miniatures at 16 and 24 px recognized better than the alternatives, and do the simplification rules help on the hard classes? If not, the rules get revised before the remaining 225 flags are drawn.

## Stimuli

| Group (between participants) | What is shown |
|---|---|
| A: ours | `mini/rect-24x16` and `mini/rect-36x24` |
| B: catamphetamine 1.6.20 | 3:2 at 16 and 24 high |
| C: hampusborgos | original ratios, scaled to 16 and 24 high |
| D: Noto Color Emoji | flag glyphs at 16 and 24 high (open license; system emoji depend on the OS, and Windows shows letters instead of flags) |

All 25 pilot flags. The rectangle is used because that is how pickers show flags (see [04](../04-unified-and-miniature.md)). Circles at 16 and 24 get a separate short block for group A only: an A/B of equal stripes vs. a wider middle stripe.

## Participant task

1. A flag on a gray background at actual size (SVG in CSS pixels; devicePixelRatio is recorded).
2. Four options: the correct one, one chosen distractor (a pair from [06](../06-confusable-pairs.md) or a regional neighbor) and two random ones, plus "don't know".
3. First all 25 flags small (16 or 24, randomly split evenly), then the same 25 large (64 px). The large block measures whether the person knows the flag at all.
4. Two attention checks (JP and CH at 64 px) screen out careless participants.

About 52 cards, 5–6 minutes.

## Metrics

- **Accuracy at 16 and 24 px** by group.
- **Retention** = accuracy at the small size / accuracy at 64 px, for the same flags and the same people. It separates "badly drawn" from "this person doesn't know the flag".
- **Confusion matrix**: which flag is mistaken for which. Separate rows for TD/RO, ID/MC, AU/NZ, PW/KZ.
- Analysis: mixed-effects logistic regression, `correct ~ group × size + (1 | participant) + (1 | flag)`.

## Sample

60 people per group, 240 in total: 1,500 answers per group and size, a standard error of about 1 percentage point on overall accuracy, enough to detect a 5-point difference between groups. The per-flag sample is small, so per-flag results are descriptive only, with intervals.

Recruitment: a paid panel (Prolific: several countries, about £1–2 per participant, roughly £400 in total) plus our own channels. Our own channels alone would bring mostly designers; that bias has to be stated in the report.

## Pilot success threshold

The pilot succeeds if all of the following hold:

1. At 16 px, group A is no worse than the best of B–D: the lower bound of the 95% interval of the difference is above −2 points.
2. On the hard classes (MX, ES, BR, KZ, TM, CY, XK, AU, NZ, FJ, US, MY, VA, SA), group A beats the best of B–D by at least 5 points.
3. In group A, retention is ≥ 0.8 for every flag except the TD/RO and ID/MC pairs, which are indistinguishable by construction.

If condition 2 fails, the simplification rules give no advantage and must change before scaling up.

## Tooling

Off-the-shelf services (Lyssna, Maze) are built for interface tests and fit poorly with 50 randomized four-option cards. A static page is simpler: randomization, SVGs inline, answers sent to simple storage (GitHub Pages plus a form, or a published page with a shared database). The protocol and the page's code are published with the results.

## To decide before running

- Budget and panel.
- Interface languages for the test (country names from CLDR: en, ru, plus the panel's languages).
- Whether group D should include a second emoji set (Twemoji, CC-BY 4.0).
