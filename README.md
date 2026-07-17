# chipus · חיפוש

Fast, typo-tolerant search for Hebrew text and English transliteration.
One phonetic key space for Hebrew, Aramaic, Yiddish, and Latin-script
queries — so **שבת**, **shabbat**, **Shabbos**, and **shabes** all find the
same documents, and so do their typos.

Zero dependencies. Runs in the browser or Node. ~600 lines total.

```js
import { ChipusIndex } from "chipus";

const idx = new ChipusIndex({
  fields: [
    { name: "title", weight: 3 },
    { name: "body", weight: 1 },
  ],
});

idx.add([
  { id: 1, title: "בְּרֵאשִׁית", body: "אין המקרא הזה אומר אלא דרשני" },
  { id: 2, title: "לֶךְ לְךָ", body: "להנאתך ולטובתך" },
]);

idx.search("Bereishis");   // → doc 1
idx.search("lech lecha");  // → doc 2 (phrase adjacency boosted)
idx.search("berelshit");   // → doc 1 (typo, caught by key-space edit distance)
idx.search("לך lecha");    // → doc 2 (scripts mix freely, token by token)
```

## How it works

Every token — from the corpus at index time and from the query at search
time — is **folded** to a short consonant-class key:

| key | Hebrew | Latin |
|-----|--------|-------|
| `B` | ב פ, consonantal ו | b p f v w ph |
| `G` | ג | g |
| `D` | ד | d |
| `Z` | ז | z |
| `C` | צ | tz ts |
| `T` | ת ט | t th |
| `S` | ס שׂ | s |
| `$` | שׁ | sh sch |
| `K` | ק כ ח | k q c ck ch kh |
| `L M N R` | ל מ נ ר | l m n r |
| *dropped* | א ע ה י, nikud, teamim | h j y, vowels, apostrophes, diacritics |

Vowels carry no signal across transliteration conventions, so they're
dropped on both sides — which also makes ktiv male vs. chaser a non-issue.
Doubled letters and dagesh-chazak gemination collapse to one class
character.

Three design decisions do the heavy lifting:

1. **The index key is canonical; the query expands.** If you index
   *vocalized* Hebrew, nikud resolves the two genuinely ambiguous letters —
   shin vs. sin (שׁ/שׂ) and consonant-vav vs. mater-vav — so each indexed
   word gets one true key. Sloppy queries expand instead: Latin `s` tries
   both `S` (samekh/sin) and `T` (Ashkenazi sav — "Shabbos"), `z` tries both
   `Z` and `C`, bare unvocalized ש tries `$` and `S`. Expanding a few query
   candidates against a precise index beats merging everything into mush.
2. **Typo tolerance runs on keys, not text.** After folding has absorbed the
   whole spelling-variant space, remaining typos are caught by bounded edit
   distance (≤1 for short keys, ≤2 for longer) over the index's *vocabulary
   of unique keys* — a few thousand strings, not the corpus — so fuzzy
   search stays effectively free.
3. **Tiered scoring keeps precision.** Exact key ≫ key prefix ≫ fuzzy, times
   per-field weights, plus bonuses for phrase adjacency and full query
   coverage. A real exact match always outranks a fuzzy guess.

### Yiddish and Aramaic

Aramaic is Hebrew-script and phonologically Hebrew-adjacent — it just works.
Yiddish orthography is handled in the fold rules: ע (a vowel in Yiddish) is
dropped anyway, double-vav וו/װ folds to the consonant `B`, the diphthong
ligatures ױ/ײ fold as vowels, and YIVO romanizations ("shabes", "mentsh",
"vos") land on the same keys as their Hebrew-script spellings.

### English

Latin-script corpus fields are folded through the same rules, so plain
English content gets phonetic typo tolerance too ("Jerusalem" ≈
"Yerushalayim" even shares a key). It's a phonetic matcher, not a stemmer —
don't expect linguistic English search — but for names and titles it works
well.

## API

```js
new ChipusIndex({ fields: [{ name, weight = 1 }, …] })
idx.add(docOrDocs)                    // index doc fields by name
idx.search(query, { limit = 20, fuzzy = true })
// → [{ doc, score, matches: [{ token, key, field, wordIndex, tier }] }]
```

`matches` gives you what matched where (field + word position), which is
what you need for highlighting.

Folding and utility functions are exported for building your own layers
(alias tables, address parsers):

```js
foldToken(t)  foldHebrew(t)  foldLatin(t)   // → candidate keys, best first
tokenize(text)  stripNikud(s)  isHebrewText(s)
gematriaToNumber("יב")  // 12 — never fold gematria addresses; parse them
isValidGematriaOrder("כא")
```

## Tips

- **Index vocalized text when you have it.** It's what makes index keys
  canonical. Unvocalized corpora still work — ambiguous letters just index
  under a couple of keys each.
- **Closed vocabularies deserve an alias fast-path.** For a fixed set of
  proper nouns (books of Tanach, the 54 parshiyot), fold the known names
  once into a `Map<key, name>` with `foldToken` and check it before falling
  through to full search — highest-leverage precision win there is.
- **Don't fold numbers.** Chapter/verse/daf addresses (Arabic digits or
  gematria) should be parsed out of the query before the rest goes to
  `search()`.

## Prior art

The fold rules descend from the production-tested Latin phonetic fold in
the author's sefaria-era-fonts project, extended with Hebrew-script folding
and nikud-aware disambiguation. The query-expansion-vs-canonical-index design follows the
same conclusion the genealogy world reached with [Daitch–Mokotoff soundex]
and [Beider–Morse phonetic matching]: handle dialect ambiguity by branching,
not by collapsing.

[Daitch–Mokotoff soundex]: https://en.wikipedia.org/wiki/Daitch%E2%80%93Mokotoff_Soundex
[Beider–Morse phonetic matching]: https://stevemorse.org/phonetics/bmpm.htm

## License

MIT
