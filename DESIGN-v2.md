# chipus v2 design: vowel-aware refined ranking

*Status: design approved by corpus experiments, not yet implemented. Evidence in
`experiments/2026-07-18-vowel-refined/` (run against rashi-search's 7,816-doc corpus,
280k tokens).*

## Problem

v1's consonant-skeleton fold buys enormous recall — שבת/shabbat/Shabbos/typos all
land on one key — but discards letters that carry real signal: matres lectionis
(א ע ה י ו), all Latin vowels, and every guttural. The cost is precision:
46% of corpus keys are collision groups (`MT` holds 119 distinct words; אמת, מת,
המת, מעט are indistinguishable), and a user who *does* type vowels ("emet",
"olam") gets nothing for the extra information.

**Principle for v2: extra information in the user's input must never hurt recall,
only sharpen ranking.** Recall stays on the v1 coarse key (typo tolerance intact);
a second, richer *refined key* re-ranks the recalled candidates.

## The refined key

Same consonant classes as v1, uppercase, with lowercase weak-signal characters
interleaved in position:

| char | Hebrew | Latin | class |
|---|---|---|---|
| `a` | word-final ה, nikud a/e-vowels | a e | vowel |
| `i` | mater י, chirik | i, vocalic y | vowel |
| `u` | mater ו, holam/shuruk | o u | vowel |
| `ʔ` | א ע | *(word-initial vowel emits `ʔ` before its vowel char)* | weak consonant |
| `h` | non-final ה | — | weak consonant |

The guttural split is the load-bearing decision. Iteration 1 mapped א/ע/ה and all
vowels to one generic `a`, and ranking barely improved (2/9 rank-1): the definite
article (המת), guttural root consonants (מעט), and true vowels all looked alike.
Splitting them (iteration 2, "Variant A") separates אמת→`ʔMT`, האמת→`hʔMT`,
המת→`hMT`, מעט→`MʔT` — and "emet" folds to `ʔaMaT`, which prefers `ʔMT` exactly
as it should.

## Asymmetric alignment scoring

Refined similarity = 1 − alignedDistance / max(len), with costs:

| aligned pair | cost | rationale |
|---|---|---|
| identical | 0 | |
| consonant ↔ consonant / gap | 1.0 | consonants are hard evidence |
| vowel ↔ gap | **0.25** | omitting vowels is normal — weak evidence of absence |
| vowel ↔ different vowel | 0.75 | contradiction is informative |
| `ʔ`/`h` ↔ vowel or gap | 0.25 | gutturals usually carry a vowel |
| `ʔ`/`h` ↔ true consonant | 1.0 | |

**Do not set vowel-omission cost to 0** (tempting, and it briefly "won" in
iteration 1): free omission makes every skeleton-mate tie at similarity 1.0 in
groups of 30–100+, so ranking within them is arbitrary. 0.25 keeps ties small
and ranks meaningful. Measure ranking experiments with competition ranks
(strict rank + tie-group size), never array order.

## Prefix-stripped index variants

Hebrew's attached prefixes (ה ו ב ל כ מ ש, and stacks like וה) are the other
half of the precision problem. At index time, tokens starting with a prefix
letter ALSO index their stripped form(s) as extra refined-key variants
(unstripped kept; candidate scores = best over the variant set). Worthless
alone, but composes with the guttural split: it rescues "haemet"→האמת and
"ha'aretz"→הארץ (the stripped variant removes the `h`-penalty on the prefixed
surface form).

## Evidence (iteration 2, costs as above)

| variant | rank-1 (of 14 answerable queries) | collision groups fully separated |
|---|---|---|
| v1 coarse only | — (baseline refined: 4) | 65.4% |
| A: guttural split | 9 | 68.9% |
| B: prefix variants only | 4 | — |
| **A+B (build this)** | **11** | — |

No regressions: torah/adam stayed rank 1 in every variant (and became
*uniquely* rank 1 under A). Only pathological case: אלהיך ("elohecha") — one
true consonant class among weak letters; no variant helps.

## Scoring integration (implementation sketch)

- `fold.js`: add `foldRefined(token)` alongside the coarse fold (shares
  consonant logic; emits weak chars instead of dropping). Carry the coarse
  folder's s→{S,T} / z→{Z,C} query expansion into refined keys too — the one
  unexplained failure ("shabbos"→שבת) traces to the refined key pinning s→S
  while שבת needs T.
- `engine.js`: store refined key variants per posting token (or per vocab key →
  set of refined forms). After tier matching, re-rank within/across tiers as
  `score = tierScore × fieldWeight + REFINE_WEIGHT × refinedSimilarity`;
  calibrate REFINE_WEIGHT so refined similarity reorders *within* a tier but a
  full tier gap (EXACT vs PREFIX) is never overcome by vowels alone.
- Memory cost: one extra short string per unique (surfaceForm) — measure, but
  the vocab is ~8.5k keys; expect negligible.

## Open questions for v2

1. Should prefix-stripping also feed **coarse recall**? As designed, "veamar"
   (key `BMR`) can never surface אמר (`MR`) at all — the stripped form isn't in
   the candidate set. Query-side prefix expansion (try stripping a leading
   ו/ב/ה from the *query* too) is probably the symmetric answer; needs its own
   experiment (recall cost vs. win).
2. Refined re-ranking interaction with the fuzzy tier — typo'd queries get
   coarse-fuzzy recall; their refined similarity will be low across the board.
   Likely fine (uniformly low ⇒ tier order preserved), verify.
3. Expose refined similarity in `matches` for apps that want to explain ranking.
