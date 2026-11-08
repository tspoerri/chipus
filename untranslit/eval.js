// node untranslit/eval.js [-v]  : accuracy by source over EVAL
import { EVAL } from './eval-set.js';
import { convertText, convertWord } from './convert.js';
const stats = {}; const wrong = [];
for (const [lat, want] of EVAL) {
  const src = lat.split(/\s+/).map((w) => convertWord(w).source).join('+');
  const got = convertText(lat);
  const key = src.includes('guess') ? 'guess' : src.includes('lexicon') ? 'lexicon' : 'exact';
  const s = (stats[key] ||= { n: 0, ok: 0 }); s.n++;
  if (want.split('|').includes(got)) s.ok++; else wrong.push(`${lat}\t${got}\t(want ${want}) [${src}]`);
}
let n = 0, ok = 0;
for (const [k, s] of Object.entries(stats)) { console.log(k, `${s.ok}/${s.n}`, (100 * s.ok / s.n).toFixed(0) + '%'); n += s.n; ok += s.ok; }
console.log('TOTAL', `${ok}/${n}`, (100 * ok / n).toFixed(1) + '%');
console.log(wrong.join('\n'));
