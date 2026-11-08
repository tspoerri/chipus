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
const lex = () => LEX || loadLexicon();

export const MIN_SIM = 0.78;      // lexicon candidate must be at least this similar to the guess
export const SOFT_MARGIN = 0.08; // lexicon must beat a soft-exact entry's similarity by this much
export const FREQ_WEIGHT = 0.08;  // log10(ppm) weight in the ranking
const PREFIX = { she: 'ש', ha: 'ה', ve: 'ו', be: 'ב', le: 'ל', me: 'מ', ke: 'כ' };
const PRE_RE = /^(she|ha|ve|be|le|me|ke)(?=[a-z]{3,})/;

function lexiconMatch(w) {
  const { byKey } = lex();
  const guesses = hebGuesses(w);
  let best = null;
  const seen = new Set();
  for (const k of new Set(latinVariants(w).flatMap((v) => foldToken(v)))) {
    for (const [h, ppm] of byKey[k] || []) {
      if (seen.has(h)) continue; seen.add(h);
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
