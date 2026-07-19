# HANDOFF — chipus (updated 2026-07-18, evening)

**Next action:** Implement v2 per DESIGN-v2.md — `foldRefined()` in fold.js (guttural split: א/ע→ʔ, non-final ה→h, final ה→a, vowel classes a/i/u, carry s/z query expansion into refined keys), prefix-stripped index variants, and refined-similarity re-ranking in engine.js with costs 0.25/0.75.

## Current state
- Pushed to GitHub (public): https://github.com/tspoerri/chipus — v0.1, 16 tests green, demo, MIT. GitHub-only by decision (no npm).
- DESIGN-v2.md committed (c53c759): vowel-aware refined ranking, fully specced from two corpus experiment rounds (artifacts + prototype refined.js in `experiments/2026-07-18-vowel-refined/`). Evidence: rank-1 hits 4/14 → 11/14 on the rashi corpus, collision-group separation 65.4% → 68.9%, zero regressions.
- Key traps recorded in the design doc: vowel-omission cost must be 0.25 not 0 (0 collapses ranking into giant ties); measure with competition ranks; prefix variants are worthless without the guttural split but rescue ה-prefix queries with it.
- rashi-search vendors v0.1 (`../rashi-search/lib/chipus/`) — re-vendor after v2 lands.
- fold.js contains literal control chars \x01/\x02 as ambiguity placeholders — intentional, do not "fix".

## Open questions
- Should prefix-stripping also feed coarse recall (query-side expansion so "veamar" can surface אמר)? Needs its own experiment — DESIGN-v2.md §Open questions.
- REFINE_WEIGHT calibration: refined similarity should reorder within a tier, never overcome a full tier gap.

## Resume command
```sh
cd ~/Documents/Projects/chipus && claude
# say: "Read HANDOFF.md and DESIGN-v2.md, implement v2"
```
