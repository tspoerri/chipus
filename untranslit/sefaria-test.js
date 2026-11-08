#!/usr/bin/env node
/* sefaria-test.js - score the converter on 988 Sefaria words it was never tuned on.
 *   node untranslit/sefaria-test.js [--misses]
 * Data: test-data/sefaria-pairs.json (topic names and book titles, word-aligned English/Hebrew,
 * English words, words in the eval set or overrides.tsv, and pairs whose consonants don't match removed).
 * Rebuild it: fetch sefaria.org/api/topics?limit=0 and /api/index to topics.json / index.json, then run
 * test-data/sefaria-pairs.py and test-data/sefaria-clean.mjs in that folder.
 * Sefaria spells differently from Tamar (h for ח, kh for כ), so this measures generality, not her style.
 * Do not hand-fix misses from here, or it stops being a held-out test. */
import fs from 'node:fs';
import { convertText } from './convert.js';

const data = JSON.parse(fs.readFileSync(new URL('./test-data/sefaria-pairs.json', import.meta.url), 'utf8'));
const F = { 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' };
const n = (s) => s.replace(/[ךםןףץ]/g, (c) => F[c]);
for (const [name, pairs] of Object.entries(data)) {
  const miss = pairs.filter(([w, h]) => n(convertText(w)) !== n(h));
  const ok = pairs.length - miss.length;
  console.log(`${name}: ${ok}/${pairs.length} = ${(100 * ok / pairs.length).toFixed(1)}%`);
  if (process.argv.includes('--misses')) console.log('  ' + miss.map(([w, h]) => `${w} ${convertText(w)} (want ${h})`).join('; '));
}
