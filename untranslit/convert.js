/* convert.js - convert every Latin-letter word in a text to Hebrew script.
 * convertWord: exact table -> lexicon candidates (fold key + similarity to the
 * rule-based guess) -> guess. Hebrew prefixes ha/ve/be/le/me/she/ke are tried
 * as prefix + stem. Everything that is not a Latin word is left untouched. */
import fs from 'node:fs';
import { foldToken } from '../src/index.js';
import { guessHebrew } from './guess.js';
import { hebSim } from './sim.js';
import { latinVariants, hebGuesses, bestSim } from './variants.js';

let LEX = null;
export function loadLexicon(file = new URL('./lexicon.json', import.meta.url)) {
  LEX = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : { exact: {}, byKey: {} };
  return LEX;
}
// Fast path for the Quick Action: lexicon.lines holds one "section\x1fkey\x1fjson" row per entry,
// so a run looks up only the words it needs instead of parsing the whole 3 MB JSON.
function loadLines(file = new URL('./lexicon.lines', import.meta.url)) {
  if (!fs.existsSync(file)) return null;
  const text = '\n' + fs.readFileSync(file, 'utf8');
  const section = (name) => {
    const cache = new Map();
    return new Proxy({}, {
      get(_, key) {
        if (typeof key !== 'string') return undefined;
        if (cache.has(key)) return cache.get(key);
        const tag = `\n${name}\x1f${key}\x1f`;
        const i = text.indexOf(tag);
        let v;
        if (i >= 0) { const start = i + tag.length; v = JSON.parse(text.slice(start, text.indexOf('\n', start))); }
        cache.set(key, v);
        return v;
      },
    });
  };
  return { exact: section('exact'), soft: section('soft'), byKey: section('byKey') };
}
const lex = () => LEX || (LEX = loadLines()) || loadLexicon();

export const MIN_SIM = 0.78;      // lexicon candidate must be at least this similar to the guess
export const SOFT_MARGIN = 0.08; // lexicon must beat a soft-exact entry's similarity by this much
export const FREQ_WEIGHT = 0.08;  // log10(ppm) weight in the ranking
const PREFIX = { she: 'ש', ha: 'ה', ve: 'ו', be: 'ב', le: 'ל', me: 'מ', ke: 'כ' };
const PRE_RE = /^(she|ha|ve|be|le|me|ke)(?=[a-z]{3,})/;

// First letters that may stand in for each other (k/q, t/tet, aleph/ayin, s/sh, v as bet or vav, ch).
const SAME_START = new Set(['כק', 'קכ', 'תט', 'טת', 'אע', 'עא', 'סש', 'שס', 'בו', 'וב', 'כח', 'חכ', 'סצ', 'צס']);
const startsFit = (guesses, h) => guesses.some(([g]) => g[0] === h[0] || SAME_START.has(g[0] + h[0]));
// -ia / -ua (yashmia, shavua): modern spelling always writes the vowel before the final ayin
// (many -ia words end in יה, יא or יאה instead: kushia, Luria, kria, so those are allowed too)
const endsFit = (w, h) => (/[^aeiouy]ia$/.test(w) ? /י(ע|ה|א|עה|אה)$/.test(h) : /[^aeiouy]ua$/.test(w) ? /ו(ע|ה|א|עה|אה)$/.test(h) : true);

function lexiconMatch(w) {
  const { byKey } = lex();
  const guesses = hebGuesses(w);
  let best = null;
  const seen = new Set();
  for (const k of new Set(latinVariants(w).flatMap((v) => foldToken(v)))) {
    for (const [h, ppm] of byKey[k] || []) {
      if (seen.has(h)) continue; seen.add(h);
      if (!startsFit(guesses, h) || !endsFit(w, h)) continue;
      const sim = bestSim(guesses, h, hebSim);
      if (sim < MIN_SIM) continue;
      const score = sim + FREQ_WEIGHT * Math.log10(ppm + 0.1);
      if (!best || score > best.score) best = { hebrew: h, score, sim };
    }
  }
  return best;
}

// Look up a bare lowercase a-z word (no prefix handling): {hebrew, source, score} or null
function direct(w) {
  const { exact, soft = {} } = lex();
  if (exact[w]) return { hebrew: exact[w], source: 'exact', score: 2 };
  const m = lexiconMatch(w);
  const s = soft[w];
  if (s) {
    const ss = bestSim(hebGuesses(w, true), s, hebSim);
    if (!m || m.hebrew === s || m.sim < ss + SOFT_MARGIN) return { hebrew: s, source: 'exact', score: 1.5 + ss };
  }
  return m ? { hebrew: m.hebrew, source: 'lexicon', score: m.score } : null;
}

function withPrefix(w, depth = 0) {
  const whole = direct(w);
  if (whole && whole.source === 'exact') return whole;
  let best = whole;
  const m = PRE_RE.exec(w);
  if (m && depth < 3) {
    const stem = withPrefix(w.slice(m[1].length), depth + 1);
    if (stem && stem.source !== 'guess') {
      const cand = { hebrew: PREFIX[m[1]] + stem.hebrew, source: stem.source, score: stem.score - 0.1 };
      if (!best || cand.score > best.score) best = cand;
    }
  }
  return best;
}

const SINGLE_PRE = { b: 'ב', l: 'ל', v: 'ו', m: 'מ', k: 'כ', h: 'ה', sh: 'ש', u: 'ו' };

export function convertWord(word) {
  const raw = String(word);
  if (/[-]/.test(raw)) {
    // hyphen: prefix-hyphen-stem joins; real compounds keep their hyphen
    const parts = raw.split('-').filter(Boolean);
    let pre = '';
    while (parts.length > 1 && PREFIX[parts[0].toLowerCase()]) pre += PREFIX[parts.shift().toLowerCase()];
    const conv = parts.map((p) => convertWord(p));
    return { hebrew: pre + conv.map((c) => c.hebrew).join('-'), source: conv.every((c) => c.source === conv[0].source) ? conv[0].source : 'guess' };
  }
  const apos = raw.split(/['’]/).filter(Boolean);
  let pre = '';
  if (apos.length > 1 && SINGLE_PRE[apos[0].toLowerCase()]) pre = SINGLE_PRE[apos.shift().toLowerCase()];
  const w = apos.join('').toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return { hebrew: raw, source: 'guess' };
  const r = withPrefix(w);
  if (r) return { hebrew: pre + r.hebrew, source: r.source };
  return { hebrew: pre + guessHebrew(w), source: 'guess' };
}

const TOKEN_RE = /[A-Za-z]+(?:['’-][A-Za-z]+)*/g;
export function convertText(text) {
  return String(text).replace(TOKEN_RE, (t) => convertWord(t).hebrew);
}
export default convertText;
