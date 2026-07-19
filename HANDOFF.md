# HANDOFF — chipus (updated 2026-07-18)

**Next action:** Create the GitHub repo and push (`gh repo create chipus --public --source . --push`), then decide on npm publish.

## Current state
- v0.1 complete and committed on `main` (2 commits): fold.js (phonetic key folding, Hebrew/Latin/Yiddish), engine.js (ChipusIndex: exact/prefix/fuzzy tiers, adjacency + coverage bonuses), gematria.js, 16 tests green (`npm test`), README design doc, MIT license, demo/index.html.
- No remote yet — never pushed anywhere.
- Proof-of-concept integration shipped: rashi-search v2 vendors this library (see ../rashi-search/HANDOFF.md). Benchmark on its 7,816-doc corpus: ~1 s index build, 8,499 unique keys, 2–25 ms/query.
- fold.js contains literal control chars \x01/\x02 as ambiguity placeholders — intentional, do not "fix".
- Known accepted collisions (documented in README): short keys (LK: לך/אלהיך), shabbos↔שבעת (ע drops).

## Open questions
- Publish to npm, or GitHub-only + vendoring?
- Alias fast-path helper (`Map<key,name>` for closed vocabularies) — worth adding to the library itself vs. leaving as a README tip?

## Resume command
```sh
cd ~/Documents/Projects/chipus && claude
# say: "Read HANDOFF.md and continue"
```
