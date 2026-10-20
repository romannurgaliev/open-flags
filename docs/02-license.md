# 02 — License and provenance

## Decision for the pilot

| What | License | Why |
|---|---|---|
| Flag artwork (`flags/`, `overlays/`, the Figma file) | CC0 1.0 | Unclear rights are designers' main problem with existing sets. CC0 removes the question: commercial use, no attribution |
| Code (`src/`, `scripts/`, `tools/`) | MIT | The usual choice for tooling |
| Metadata (`data/`) | CC0 1.0 | Facts and references; the freer they are, the more likely people are to correct them |

The decision can change before the first public release. CC-BY 4.0 would also suit an open library if attribution is wanted; the cost is that every user has to display it somewhere.

## Why we draw our own instead of reusing a set

- **hampusborgos/country-flags.** The sources come from Wikimedia Commons; the repository has no LICENSE file, and the README only states that flags are in the public domain. Individual SVGs on Commons, especially those with coats of arms, carry their artist's license. Taking that geometry would carry the uncertainty over.
- **catamphetamine/country-flag-icons.** MIT, but by the author's own account the references were found through image search, and some simple striped flags were partly copied from Wikipedia and other sets.

Hence the rule: geometry comes only from construction numbers (levels 1–4) or is drawn from scratch. Level 5 sets are used for comparison in the recognition test.

## Provenance of each flag

The metadata answers "where did this come from": the ratio, the construction and every color link to a source with its level, how it was read and when (`sources`, `colors.*.specs`). For the CY and XK maps the source is Natural Earth (public domain).

## Limits users should know about

The license covers the rights to our drawings. Some countries restrict how their state symbols may be used (coats of arms and inscriptions especially), and CC0 does not change that. The README says so.
