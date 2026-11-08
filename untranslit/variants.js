/* Latin spelling variants worth guessing from (Ashkenazi -os/-us/-is endings = -ot). */
export function latinVariants(w) {
  const v = [w];
  if (/[aeiou]s$/.test(w)) v.push(w.replace(/([aeiou])s$/, '$1t'));
  if (/os$/.test(w) || /us$/.test(w)) v.push(w.replace(/(o|u)s$/, 'ot'));
  return [...new Set(v)];
}

import { guessHebrew } from './guess.js';

/* Hebrew spellings to compare a candidate against, each with a small similarity penalty:
 * the plain guess; Ashkenazi -os as -ot; v->vav when not word-final (mitzvah, vayikra);
 * ch->kaf (bracha); final -a -> aleph (aba, savta). Returns [[hebrew, penalty], ...]. */
export function hebGuesses(w, basic = false) {
  const lat = new Map(latinVariants(w).map((b, i) => [b, i ? 0.03 : 0]));
  if (!basic) {
    for (const [b, p] of [...lat]) {
      if (/v(?=.)/.test(b) && !/v$/.test(b)) lat.set(b.replace(/v(?=.)/g, 'w'), p + 0.06);
      if (/.ch/.test(b)) lat.set(b.replace(/(.)ch/g, '$1k'), p + 0.1);
      if (/kh/.test(b)) lat.set(b.replace(/kh/g, 'k'), p + 0.02); // academic kh = soft kaf (bekhol)
    }
  } else for (const b of [...lat.keys()].slice(1)) lat.delete(b);
  const out = new Map();
  const put = (g, p) => { if (!out.has(g) || out.get(g) > p) out.set(g, p); };
  for (const [b, p] of lat) {
    const g = guessHebrew(b);
    // a vowel pair the plain guess spells as nothing (michael, yael) is rarely silent in Hebrew
    put(g, p + (!basic && /[^aeiou](ae|ea|ao|eo|aa)[^aeiouh]/.test(b) ? 0.06 : 0));
    if (!basic && /[^h]a$/.test(b) && g.endsWith('ה')) put(g.slice(0, -1) + 'א', p);
    if (!basic && /[^aeiouy][iue]a$/.test(b)) { // -ia: try both יה (kushia) and יע (yashmia)
      put(guessHebrew(b + 'h'), p + 0.03);
      if (!g.endsWith('ע')) put(g.replace(/ה$/, '') + 'ע', p + 0.03);
    }
    // two vowels in a row mid-word often hide an ayin or aleph (meidim, shmuel); 'j' marks the
    // spot because it is the only letter the guesser spells ג׳
    if (!basic && !b.includes('j') && /[^aeiou][aeiou]{2}[^aeiouh]/.test(b.replace(/h$/, ''))) {
      const g2 = guessHebrew(b.replace(/([^aeiou][aeiou])([aeiou][^aeiou])/, '$1j$2'));
      // a mid-word aleph rarely carries a patach, so before an 'a' the hidden letter leans ayin
      const nextA = /[^aeiou]ea[^aeiou]/.test(b);
      for (const L of ['ע', 'א']) put(g2.replace('ג׳', L), p + (nextA && L === 'א' ? 0.05 : 0.02));
    }
  }
  return [...out];
}

export const bestSim = (guesses, h, sim, strict) => Math.max(...guesses.map(([g, p]) => sim(g, h, strict) - p));
