# SPEC: Hebrew-ify selection (auto-untransliterate)

## What it does
Select text in any Mac app and press a shortcut. Every Latin-letter word in the selection is treated as transliterated Hebrew and replaced with Hebrew script. Punctuation, digits and spacing are kept as they are.
`ani holech la beit knesset be Shabbat` → `אני הולך לה בית כנסת בה שבת`

## How it works
| Piece | Detail |
|---|---|
| Trigger | A macOS Quick Action in `~/Library/Services`, the same kind as the existing "Claude - ask" workflows. Its input is the selected text, and its output replaces the selection. It runs `node` (v22, /usr/local/bin/node). |
| Converter | `untranslit/convert.js`. For each Latin token: (1) fold it with chipus `foldToken` and look up the key in the lexicon; if found, use the most frequent Hebrew word. (2) Otherwise, guess the spelling (next row). |
| Lexicon | `untranslit/lexicon.json`: chipus fold key → Hebrew words ranked by frequency. `untranslit/build-lexicon.js` builds it offline from the most common Hebrew words. |
| Guesser | `untranslit/guess.js` is a rule-based letter map: sh→ש, ch/kh→ח (k→כ/ק by position), tz/ts→צ, v→ב, f→פ. A word-initial vowel →א, a final -a/-ah →ה, an internal o/u →ו, an internal i/ee →י, an internal a/e is dropped. Final forms ך ם ן ף ץ are applied. Ashkenazi s-for-t (Shabbos) maps to ת only through the lexicon, never by guessing. |
| Word sources | 1. `he_50k.txt` (FrequencyWords project, OpenSubtitles counts, modern Hebrew). 2. Optionally, word counts from the Sefaria siddur and Tanakh, so liturgical words also rank. Both are cached under `untranslit/data/`. |
| Ties | When two Hebrew words share a fold key (e.g. שבת / שבט), the higher frequency wins. `untranslit/overrides.tsv` holds hand fixes. |
| Undo | One Cmd-Z in the app restores the original text. |

## Not in scope (v1)
Yiddish words or spellings, English detection (all Latin text is converted), live as-you-type replacement or a candidate popup, iOS, nikud.

## Wave plan
| Wave | Work | Model | Done when |
|---|---|---|---|
| 0 | Snapshot commit in chipus; download word lists (approved) | top | Clean tree; data cached |
| 1a | `build-lexicon.js` + `lexicon.json` + collision report | Sonnet | The lexicon is built, and the top collisions are listed in `untranslit/collisions.md` |
| 1b | `guess.js` + tests on 50 words | Sonnet | `node --test untranslit/` passes |
| 2 | `convert.js` + tests on 30 sample sentences | Sonnet | Tests pass; accuracy on the sample set is reported |
| 3 | Quick Action + `Install Hebrew-ify.command` | Sonnet | It converts a selection in TextEdit, Mail and Chrome |
| 4 | Verify + HANDOFF | top | Tamar picks the shortcut once (System Settings → Keyboard → Keyboard Shortcuts → Services) |

Waves 1a and 1b run in parallel. At most 2 agents run at once, and each runs only its own tests.

## Constraints
- No changes to chipus `src/` (rashi-search depends on it).
- Local commits only. The chipus repo has a GitHub remote, and nothing is pushed without Tamar's OK.
- No network access at run time.
