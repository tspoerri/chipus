# Untransliterate prior art (2026-11-07)

Verified = read this session. Unverified = from memory or snippets; check before relying on it.

## 1. Existing tools
| Tool | Platform | System-wide? | Word dict or letter map | Maintained | License | URL |
|---|---|---|---|---|---|---|
| Translit (gershnik) | macOS input source (+Windows) | Yes | Letter map ("hi" -> הי); no dictionary | 129 commits; last date unverified | GPL-3.0, free | github.com/gershnik/translit |
| Google Input Tools / Transliterate API | Web, old Chrome ext | No | Dictionary-backed suggestions | Dead (API deprecated 2011; desktop/Chrome tools removed ~2018, partly unverified) | n/a | developers.google.com/transliterate |
| Apple Hebrew layouts | macOS/iOS | Yes | Positional, not phonetic | Yes | Built in | n/a |
| Keyman Hebrew keyboards, Lexilogos, Typeit | Various | Keyman yes; web tools no | Letter maps (unverified) | Unverified | Unverified | not checked |
| Dicta Nakdan | Web/API | No | Adds vowels to Hebrew; does not untransliterate | Yes | Free/open per Dicta (terms unverified) | nakdan.dicta.org.il |
| Sefaria | Web/API | No | No transliteration input found | Yes | Mostly CC | sefaria.org |

Finding: no tool found that does word-level dictionary untransliteration (shabbos -> שבת) system-wide. Translit is the closest and is letter-only.

## 2. Delivery surfaces on macOS
| Surface | Runs JS? | Difficulty | Tradeoffs |
|---|---|---|---|
| (a) InputMethodKit IME + candidate window | Not natively (Swift/ObjC; embed JavaScriptCore to reuse chipus) | Hard | Best UX (type, pick candidate). Needs a signed app, log-out/in install (as Translit does), per-keystroke composition quirks. |
| (b) Hotkey converts selection: Hammerspoon (Lua, hs.osascript can call JS for Automation), Services/Shortcuts "Run JavaScript for Automation" or shell + node, Raycast (TypeScript) / Alfred (script filter) extension | Yes: Shortcuts/Services (JXA or node), Raycast (Node), Alfred (node script) | Easy to medium | Two steps (select, hotkey), works nearly everywhere via copy/paste. Services needs a one-time enable. Hammerspoon needs Accessibility permission. |
| (c) Live auto-replace: Espanso (YAML, can call a script via shell/script var), Keyboard Maestro (JS actions), macOS Text Replacements | Espanso and KM yes via script; macOS replacements no | Medium | Espanso: triggers on a word boundary, so only exact trigger words get replaced, no fuzzy folding unless it shells out to chipus. Static generated list is easy but cannot cover variants. |
| (d) Browser extension | Yes | Easy | Browser fields only; does not meet "anywhere on Mac". |

## 3. Lexicon sources (key -> Hebrew spellings with frequency)
| Source | Gives | License |
|---|---|---|
| Frequency Dictionary of Spoken Hebrew (Pinto 2018, Zenodo 10.5281/zenodo.1239886) | Modern Hebrew frequency | Open source (per search result) |
| MILA stopword/frequency list (via NLPH resources, github.com/NLPH) | 23,327 tokens by frequency | Not stated |
| hspell (hspell.ivrix.org.il) | Modern Hebrew spelling word list, no frequency | Open license, believed AGPL (unverified; site fetch failed) |
| Hebrew Wikipedia dump | Build own counts | CC BY-SA |
| Sefaria texts (Tanakh, Talmud, siddur) | Build own counts weighted toward Jewish vocabulary, which is best for this use | Per text, mostly CC (verify per source) |
| Jewish English Lexicon (jewish-english-lexicon.org) | Shabbos, kiddush type loanwords with spellings | Unverified; site would not load |
| chipus' own folded-key index | Already maps key -> words | Yours |
| hermitdave/FrequencyWords (he) | OpenSubtitles frequency | Unverified |

Gap: modern lists underweight liturgical and Yiddish words (kiddush, bentsh, shabbos). Build the dictionary from Sefaria siddur/Talmud counts plus a hand-curated seed list.

## 4. Recommendation
- Start with surface (b): a Raycast or Alfred script filter, plus an optional Shortcuts/Service for hotkey convert-selection. Reuse chipus as-is in Node/JXA; no IME work.
- Build a static key -> ranked Hebrew candidates JSON offline from Sefaria counts plus a curated seed list, fold keys with chipus, and ship it beside the code.
- Multi-word phrases (Rosh Hashana -> ראש השנה): try the longest phrase match first, then word by word.
- Upgrade path: an Espanso package generated from the same JSON for live replacement of unambiguous words. An IME is only worth it if the hotkey feels slow; Translit shows the install friction (log-out, GPL).
- Do not rely on any Google tool; it is dead.
