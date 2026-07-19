# HANDOFF — chipus (updated 2026-07-18, night)

**Next action:** v2 is vendored into rashi-search (as a submodule) and latency-fixed. Next up: **DESIGN-v3.md** (drafted 2026-07-19, proposed/not-validated) — evidence-weighted ranking: field-coverage bonus (D2), term-rarity/IDF (D1), popBoost tie-break (D3, app-side), query-side prefix expansion (D4, absorbs old open question 1), script-conditional refined weight (D5). Prereq lives in rashi-search: persist the calibration eval set. See rashi-search/HANDOFF.md.

## Current state
- v2 (vowel-aware refined ranking) implemented, tested, committed, pushed to https://github.com/tspoerri/chipus.
  - `src/fold.js`: `foldHebrewRefined`, `foldLatinRefined`, `foldTokenRefined`, `hebrewPrefixVariants` — guttural split (א/ע→ʔ, non-final ה→h, final ה→a), vowel classes a/i/u, s/z query-ambiguity carried into refined keys, prefix-stripped variants for Hebrew tokens.
  - `src/engine.js`: postings now store `{doc, field, word, refined}` (refined = array of refined-key variants for that occurrence, not a flat int array). `refinedDistance`/`refinedSimilarity` (asymmetric alignment, costs 1.0/0.25/0.75 exactly per DESIGN-v2.md). `REFINE_WEIGHT = 10`, added on top of `tier * fieldWeight` — stays under the smallest tier gap (15, PREFIX↔FUZZY1) so vowel evidence reorders within a tier only, never crosses one.
  - 10 new tests in `test/refined.test.js` (26 total, all green): guttural-split worked example matches DESIGN-v2.md exactly (אמת→ʔMT, האמת→hʔMT, המת→hMT, מעט→MʔT), Latin refined folding + s/z carry-through, prefix variants, alignment-cost ordering, and an engine-level test confirming re-ranking stays within a tier.
  - Verified against the corpus experiment script (`experiments/2026-07-18-vowel-refined/exp5_iter2.mjs`) — the refined keys my implementation produces match the experiment's own "MT-group sample" output exactly.
- Deliberately did NOT implement query-side prefix expansion for coarse recall (open question 1) — Tamar's instruction this session was explicit: prefix-stripping must only widen refined-key ranking evidence, never the coarse recall candidate set. "veamar"→אמר still only works via v1's existing fuzzy-edit-distance tolerance (BMR~MR), not via any new prefix logic.
- rashi-search vendors v0.1 (`../rashi-search/lib/chipus/`) — still needs re-vendoring to pick up v2.
- fold.js contains literal control chars \x01/\x02 (`S_AMBIG`/`Z_AMBIG`) as ambiguity placeholders — intentional, do not "fix"; same placeholders reused in `foldLatinRefined`.

## Open questions (from DESIGN-v2.md, still open)
- Query-side prefix expansion for coarse recall: declined for now (see above) — would need its own recall-cost-vs-win experiment if revisited.
- Refined re-ranking × fuzzy tier interaction: expected fine (typo'd queries get uniformly low refined similarity, so tier order is preserved) but not separately verified against the corpus.

## Resume command
```sh
cd ~/Documents/Projects/chipus && claude
# say: "Re-vendor chipus v2 into rashi-search"
```
