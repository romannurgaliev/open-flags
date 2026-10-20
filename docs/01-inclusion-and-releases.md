# 01 — Inclusion, change tracking and releases

## Inclusion

Whether a flag is included is decided by rule, not by request. Names come from Unicode CLDR.

| Rule | What is included |
|---|---|
| I-1 | Every officially assigned ISO 3166-1 alpha-2 code (249). If a territory has no official flag of its own (BV and SJ use the flag of Norway), its file is a copy of the sovereign's flag with an `alias_of` field and is not drawn separately |
| I-2 | Codes outside I-1 only if CLDR gives them a territory name **and** libphonenumber uses them. Currently XK (Kosovo), AC (Ascension) and TA (Tristan da Cunha). EU, which CLDR lists as an exceptionally reserved code |
| I-3 | Subdivisions only if they have a Unicode RGI emoji sequence: GB-ENG, GB-SCT, GB-WLS |
| I-4 | Not included: historical flags, flags of organizations (other than EU), and flags of regions, autonomies and unrecognized states that do not qualify under I-2 |

Why: catamphetamine added Abkhazia, South Ossetia and Northern Cyprus at users' request. Each such decision is political, and a library that makes them one at a time becomes a party to the dispute. Rule I-2 hands the decision to CLDR and libphonenumber, widely used external references, and makes it checkable.

XK is a user-assigned code, not an ISO code; the metadata records it as `iso.status: "user-assigned"`. The alpha-3 code XKK and numeric 983 are CLDR private-use codes.

## Tracking changes

Flags change: Syria's new flag is set by Article 6 of the interim constitution of March 13, 2025. Where the signals come from:

| What | Where | How often |
|---|---|---|
| A new flag or a change to the design | FOTW (changes page), news, user issues | Monthly, by hand |
| New and removed codes | ISO 3166 MA newsletters, new CLDR versions (`npm view cldr-core version`) | With each CLDR release (twice a year) |
| Color and drawing corrections | New editions of the Album des pavillons | On publication |

No signal changes a flag on its own. A change is accepted only with a primary source (level 1 or 2); see [08](08-contributing.md).

## Asset versions (semver)

People use the flags through npm, a CDN or Figma Community, so the version number has to say whether an update will break their interface.

| Change | Version |
|---|---|
| A file or format removed or renamed; a format's canvas size changed; the naming scheme changed | **major** |
| A new flag; a new format or tier; a country officially changed its flag | **minor** |
| Geometry or color corrected to match a source; a miniature's simplification refined | **patch** |

A country changing its flag is minor, not major: the file name and canvas stay the same, and users need the current flag.

## Release process

1. All checks pass (`npm test`). Drafts (`status: draft`, `blocked-review`) are left out of the release. The packaging script that excludes them has not been written yet; it is the first task before 1.0.
2. `npm run baseline`: the snapshot for C15, so the next PR is compared with this release.
3. CHANGELOG: for each changed flag, what changed and on which source.
4. One version number everywhere: git tag, GitHub Release, npm, and the Figma Community description.
5. In Figma Community, Publish update with the same number and a link to the CHANGELOG.
