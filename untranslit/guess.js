/*
 * guess.js - rule-based fallback speller: transliterated Hebrew -> Hebrew letters.
 * Used only when a word is not in the frequency lexicon. No niqqud.
 *
 * Rules (the brief's list, with these choices):
 *  - Input is lowercased; everything except a-z is dropped. Hyphens split segments.
 *  - Digraphs first: sh->ש ch/kh->ח tz/ts->צ ph->פ th->ת gh->ג ck->ק.
 *  - t->ת (not ט): ת is the commoner letter in modern spelling; th also ->ת.
 *  - k->כ (ק for q and ck), s->ס (ש only via sh), v/b->ב, w->ו, c->ק, x->קס, j->ג׳.
 *  - ch->ח at word end too (final ch is not ך).
 *  - Vowels: oo/ou->ו; ee/ei/ai->י. Initial vowel: a->א, o/u->או, e/i/ei/ai->אי.
 *    Internal a/e dropped, o/u->ו, i->י. Final a/e/ah/eh->ה, i->י, o/u->ו.
 *  - A single i right after y is dropped (bayit->בית, mayim->מים): y already gives י.
 *  - Identical adjacent consonants collapse (shabbat->שבת).
 *  - Final forms ך ם ן ף ץ at the end of each segment.
 *  - Prefixes ha/ve/be/le/me/she/ke attach as one letter. With a hyphen
 *    (ha-shana) always; without one, only when the rest is 2+ letters and
 *    (starts with a vowel a/o/u [any vowel for ha], or the prefix is ve). A
 *    consonant-initial rest already spells the same without prefix logic, and
 *    "ei" after be/le/me/she/ke is treated as a diphthong (beinoni stays whole).
 *  - A non-prefix hyphen segment is guessed on its own and concatenated.
 */

const PREFIX = { ha: 'ה', ve: 'ו', be: 'ב', le: 'ל', me: 'מ', she: 'ש', ke: 'כ' };
const DIGRAPH = {
  sh: 'ש', ch: 'ח', kh: 'ח', tz: 'צ', ts: 'צ', ph: 'פ', th: 'ת', gh: 'ג', ck: 'ק',
};
const SINGLE = {
  b: 'ב', v: 'ב', w: 'ו', g: 'ג', d: 'ד', h: 'ה', z: 'ז', t: 'ת', y: 'י', k: 'כ', q: 'ק',
  l: 'ל', m: 'מ', n: 'נ', s: 'ס', f: 'פ', p: 'פ', r: 'ר', c: 'ק', x: 'קס', j: 'ג׳',
};
const FINAL = { 'כ': 'ך', 'מ': 'ם', 'נ': 'ן', 'פ': 'ף', 'צ': 'ץ' };
const VOWELS = 'aeiou';
const VOWEL_PAIRS = { oo: 'ו', ou: 'ו', ee: 'י', ei: 'י', ai: 'י' };

function tokenize(w) {
  const units = [];
  for (let i = 0; i < w.length; ) {
    const two = w.slice(i, i + 2);
    if (DIGRAPH[two]) { units.push({ c: DIGRAPH[two], src: two }); i += 2; continue; }
    if (VOWEL_PAIRS[two]) { units.push({ v: VOWEL_PAIRS[two] }); i += 2; continue; }
    const ch = w[i];
    if (VOWELS.includes(ch)) units.push({ v: ch });
    else units.push({ c: SINGLE[ch], src: ch });
    i++;
  }
  return units;
}

const INTERNAL = (v) => (v === 'a' || v === 'e' ? '' : v === 'o' || v === 'u' ? 'ו' : v === 'i' ? 'י' : v);
const FINAL_V = (v) => (v === 'a' || v === 'e' ? 'ה' : v === 'o' || v === 'u' ? 'ו' : v === 'i' ? 'י' : v);
const INITIAL_V = (v) => (v === 'a' ? 'א' : v === 'o' || v === 'u' ? 'או' : v === 'e' || v === 'i' ? 'אי' : 'א' + v);

function spell(word) {
  if (!word) return '';
  if (/[ae]h$/.test(word)) word = word.slice(0, -1); // -ah / -eh: the h is just the vowel's carrier
  const units = tokenize(word);
  const out = [];
  let prev = null;
  for (let i = 0; i < units.length; ) {
    if (units[i].c !== undefined) {
      const u = units[i];
      if (!(prev && prev.c !== undefined && prev.src === u.src)) out.push(u.c);
      prev = u; i++; continue;
    }
    let j = i;
    while (j < units.length && units[j].v !== undefined) j++;
    const run = units.slice(i, j).map((u) => u.v);
    const initial = i === 0, final = j === units.length;
    run.forEach((v, k) => {
      if (initial && k === 0) { out.push(INITIAL_V(v)); return; }
      if (v === 'i' && k === 0 && prev && prev.src === 'y') return; // yi -> י once
      out.push(final && k === run.length - 1 ? FINAL_V(v) : INTERNAL(v));
    });
    prev = { v: true }; i = j;
  }
  let s = out.join('');
  const last = s[s.length - 1];
  if (FINAL[last]) s = s.slice(0, -1) + FINAL[last];
  return s;
}

function withPrefix(seg) {
  const m = /^(she|ha|ve|be|le|me|ke)(.{2,})$/.exec(seg);
  if (!m) return spell(seg);
  const [, p, rest] = m;
  const first = rest[0];
  const vowelStart = p === 'ha' ? VOWELS.includes(first) : 'aou'.includes(first);
  if (p === 've' ? true : vowelStart) {
    if (p === 've' && !VOWELS.includes(first) && !/^[a-z]/.test(first)) return spell(seg);
    return PREFIX[p] + spell(rest);
  }
  return spell(seg);
}

export function guessHebrew(latinWord) {
  const segs = String(latinWord ?? '').toLowerCase().split('-')
    .map((s) => s.replace(/[^a-z]/g, '')).filter(Boolean);
  let out = '';
  segs.forEach((seg, i) => {
    const isLast = i === segs.length - 1;
    if (!isLast && PREFIX[seg]) out += PREFIX[seg];
    else out += isLast && segs.length === 1 ? withPrefix(seg) : spell(seg);
  });
  return out;
}

export default guessHebrew;
