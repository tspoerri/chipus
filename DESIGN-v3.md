# chipus v3 design: evidence-weighted ranking (rarity + coverage)

*Status: PROPOSED — not corpus-validated. Drafted 2026-07-19 from rashi-search
calibration round 1 (4/10 exact top-1; all 5 misses are short 2–4-word dibburim
built from common vocabulary). Follow the v2 discipline: corpus experiments
first (`experiments/`), competition ranks (strict rank + tie-group size), no
implementation until a variant wins on the eval set with zero regressions on
the v2 14-query set.*

## Problem

v2 fixed *which word* a token matches (vowel evidence, prefix variants). The
remaining failures are about *which document* wins when many docs contain the
same matched words. Two flatness gaps in scoring:

1. **No term rarity.** Every EXACT-tier token contributes `150 × fieldWeight`
   whether it matched ויאמר (thousands of postings) or פישון (a handful). A
   3-common-word query puts dozens of docs in one tie group; the true short
   dibbur can't out-score longer, likelier false positives.
2. **No doc-side coverage.** `ALL_TOKENS_FACTOR` rewards the *query* being
   fully matched, but nothing rewards the *field* being fully consumed. A doc
   whose dibbur hamaschil IS the query ties with a long comment that merely
   contains those words scattered. Note the asymmetry with the app: Hebrew
   dibbur queries in rashi-search get a 1000/800/600-point exact-dh ladder
   (index.html ~365-370); transliterated queries bypass it entirely and see
   only chipus's flat tier scores. Coverage is the engine-side generalization
   of that ladder — it gives translit queries parity.

App-side, popBoost (≤50) then breaks these ties by popularity — calibration
showed it's roughly symmetric across tied candidates, i.e. noise. The fix is
widening the *evidence* spread, not tuning the boost.

## D1 — term-rarity weighting (IDF)

At `_ensureVocab`, compute `df(key)` = distinct docs in the key's postings.
Rarity factor `r(key) = clamp(log2(1 + N/df) / MEAN_IDF, LO, HI)`; token
contribution becomes `tier × fieldWeight × r`.

- For PREFIX/FUZZY hits, use the **matched vocab key's** df (the vkey), not
  the query key's.
- Variants to test: (a) *tier-safe* — clamp `[LO, HI]` narrow enough that
  rarity reorders within a tier only (analog of the REFINE_WEIGHT bound);
  (b) *tier-crossing* — wider clamp so a rare FUZZY1 match can beat a common
  EXACT match. (b) is heresy against v1's invariant but is plausibly exactly
  what short-query disambiguation needs: the user's one distinctive term
  arriving slightly misspelled should outvote perfectly-matched stopwords.
  Let the corpus decide.
- Caveat: coarse keys conflate surface words (`MT` = 119 words), so coarse df
  under-measures rarity of a specific word. If (a)/(b) underperform, try df
  over refined-key variants instead.

## D2 — field-coverage bonus (doc-side length normalization)

At index time store `fieldTokens(doc, field)`. At scoring, per doc compute
`coverage(f) = distinctMatchedWordPositions(f) / fieldTokens(f)` and add
`COVER_WEIGHT × max_f(coverage × fieldWeightNorm)`.

- Directly targets the dominant miss pattern: Tamar types the *entire*
  dibbur; the true doc has coverage 1.0 on its dh field, false positives have
  0.1–0.3 on a long text field.
- Special case worth its own test: **full-field match** (all query tokens
  matched in field f AND coverage == 1.0) → a decisive bonus, the engine-side
  analog of the app's `n.dh === q.dh` 1000-point rung. Should this cross
  tiers? Probably yes at EXACT, unclear at PREFIX/FUZZY — measure.
- Keep it generic: chipus knows fields and weights, not "dh". rashi-search's
  existing field weights make dh-coverage naturally dominant.
- Interaction: D2 stacks with per-token refinedSim — full coverage at high
  refined similarity ≈ near-certain match; consider gating the decisive bonus
  on mean refinedSim to avoid rewarding full coverage of a 1-word field by a
  FUZZY hit.

## D3 — popBoost as tie-break, not vote (rashi-search side)

Once D1/D2 widen evidence spreads, additive popBoost ≤50 may still outvote
small true gaps. Options, in order of preference:
1. **Quantized two-key sort:** sort by `round(score / BIN)` then popBoost
   (+ weekBoost) within a bin. Popularity decides only genuine near-ties.
2. Shrink the cap (50 → below the post-D1/D2 minimum meaningful gap).
3. Multiplicative epsilon: `score × (1 + ε·pop)`.
Calibration said popBoost is symmetric across current tie groups, so this is
secondary — do it after D1/D2 land, sized to their observed gaps.

## D4 — query-side prefix expansion (recall; v2 open question 1)

The one pure-recall gap left: "veamar" (key `BMR`) can never surface אמר
(`MR`). Design: if a query token's coarse key starts with a prefix-class
consonant and the remainder is ≥2 chars, ALSO match the stripped key at a new
penalized tier (`TIER.PREFIX_STRIP ≈ 45`, between PREFIX and FUZZY1). Index
side stays untouched (Tamar's standing instruction: prefix logic must never
widen index-side recall). Needs its own recall-cost experiment — count new
false-positive candidates admitted per query on the corpus before accepting.

## D5 — script-conditional refined weight

Latin-script query tokens carry *deliberate* vowels (typing "ei" is a choice;
an unvocalized Hebrew query simply has none). Test raising REFINE_WEIGHT for
Latin tokens only (10 → 12–14, still under the 15 tier gap; optionally a
tier-crossing variant in the same grid as D1b). Cheap — same harness.

## Plan

- **Step 0 — persist the eval set** (prereq, currently transcript-only):
  `rashi-search/eval/queries.json` — round-1's 10 queries {query, expectedRef,
  note} + rounds 2–3 (`node scripts/sample-rashis.mjs 10 --seed 2 --spread`,
  Tamar transliterates) → ~30 queries. Also fold in the v2 experiment's 14
  single-token queries as a no-regression gate.
- **Step 1 — eval harness:** `rashi-search/scripts/eval.mjs` using the
  documented harness pattern (extract inline module from index.html, stub DOM,
  real data/rashi.json); prints competition-rank table per config.
- **Step 2 — experiment grid** in `chipus/experiments/2026-07-XX-rarity-coverage/`:
  D1a/D1b × D2 (weight sweep + full-field-bonus on/off) × D5, then D3 sized to
  the winner, D4 as a separate recall experiment.
- **Step 3 — implement the winning combo** as chipus v3 (df + coverage are
  both O(1) additions to existing index structures; no latency concern), bump
  the rashi-search submodule, regression suite + live browser check.
- Delegation: steps 1–2 are Sonnet-able against this doc; judgment on the
  grid results stays with Opus/Fable.

Priority (Tamar, 2026-07-19): **D2 > D5 > D3 first** — the corpus-generic
levers, since chipus should work for any corpus. D1 (rarity) and D4 (prefix
expansion) deferred, revisit only if D2/D5/D3 leave misses on the table.

## Synthetic eval (2026-07-19)

Instead of hand-transliterated calibration rounds, eval queries are generated
by the hebrew-toolkit transliteration engine (vendored into
`rashi-search/scripts/translit-vendor/`): stratified sample of 60 dibburim
(by dh word count × popularity), vocalized-dh recovered by aligning dh tokens
to vt/t, rendered in Sefardi + Ashkenazi styles × clean/sloppy variants →
195 queries in `rashi-search/eval/queries.json` (+ a partial-dibbur regression
set). Harness: `rashi-search/scripts/eval.mjs` (competition ranks over the
real page pipeline). Real human queries can be appended with style:"human".

Baseline (chipus v2 + current app blend): overall top-1 74.4%, top-3 87.2%,
MRR 0.824 — but the 1–2-word dibbur bucket is 29.1% top-1 / 54.5% top-3 vs
92%+ for 3+ words. The whole problem lives in short queries, as calibration
round 1 said.
