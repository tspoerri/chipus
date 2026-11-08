#!/usr/bin/env node
/* build-lexicon.js - writes untranslit/lexicon.json (git-ignored; personal corpora).
 *   node untranslit/build-lexicon.js
 * exact : latin-lowercase -> hebrew (trusted terms.tsv rows + overrides.tsv)
 * soft  : unflagged terms.tsv rows that pass the similarity check; used unless the lexicon is clearly better
 * byKey : chipus fold key -> [[hebrew, ppm], ...] from he_50k + miyodeya Hebrew counts
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { foldHebrew, stripNikud } from '../src/index.js';
import { guessHebrew } from './guess.js';
import { hebSim } from './sim.js';
import { hebGuesses, bestSim } from './variants.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const HOME = process.env.HOME;
const TERMS = process.env.TERMS_TSV || `${HOME}/Documents/Projects/life-os/untranslit-mining/terms.tsv`;
const MIYO = process.env.MIYODEYA_DB || `${HOME}/Documents/Projects/life-os/orthodox-context/miyodeya/miyodeya.db`;
const PER_KEY = 60, MIN_PPM = 0.4;
const ALT_MARGIN = 0.25;
const TOP_COUNT = 650;          // terms.tsv count at about rank 300
const EXACT_MIN_SIM_TOP = 0.7;  // unflagged top rows: loose check vs guessHebrew
const EXACT_MIN_SIM = 0.85;     // other unflagged rows: strict check

const HEB = /^[א-ת]{2,}$/;
// holdout.js: HOLDOUT names a file of latin words to leave out of exact/soft/overrides; LEX_DIR redirects output
const HOLD = new Set(process.env.HOLDOUT ? fs.readFileSync(process.env.HOLDOUT, 'utf8').split('\n').filter(Boolean) : []);
const OUT = process.env.LEX_DIR || here;
const bySource = {};

// 1. he_50k
{
  const m = new Map(); let tot = 0;
  for (const line of fs.readFileSync(path.join(here, 'data/he_50k.txt'), 'utf8').split('\n')) {
    const [w, c] = line.trim().split(/\s+/); const n = +c;
    if (!w || !n) continue;
    const cw = stripNikud(w); tot += n;
    if (HEB.test(cw)) m.set(cw, (m.get(cw) || 0) + n);
  }
  bySource.he = { m, tot };
}
// 2. miyodeya Hebrew tokens
try {
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync(MIYO, { readOnly: true });
  const m = new Map(); let tot = 0;
  for (const row of db.prepare('SELECT title, body_text FROM posts').all()) {
    const txt = stripNikud((row.title || '') + ' ' + (row.body_text || ''));
    for (const w of txt.match(/[א-ת]+/g) || []) { tot++; m.set(w, (m.get(w) || 0) + 1); }
  }
  for (const [w, n] of m) if (n < 2 || !HEB.test(w)) m.delete(w);
  bySource.miyo = { m, tot };
} catch (e) { console.error('miyodeya skipped:', e.message); }

// 3. merge: average of per-million rates (a source missing a word counts as 0)
const words = new Set();
for (const s of Object.values(bySource)) for (const w of s.m.keys()) words.add(w);
const nSrc = Object.keys(bySource).length;
const byKey = {};
for (const w of words) {
  let ppm = 0;
  for (const s of Object.values(bySource)) ppm += ((s.m.get(w) || 0) / s.tot) * 1e6;
  ppm /= nSrc;
  if (ppm < MIN_PPM) continue;
  let keys; try { keys = foldHebrew(w); } catch { continue; }
  for (const k of new Set(keys)) (byKey[k] ||= []).push([w, ppm]);
}
let entries = 0;
for (const k of Object.keys(byKey)) {
  byKey[k].sort((a, b) => b[1] - a[1]);
  byKey[k] = byKey[k].slice(0, PER_KEY).map(([w, p]) => [w, +p.toPrecision(2)]);
  entries += byKey[k].length;
}

// 4. exact table
const exact = {}, soft = {}; const stats = { trusted: 0, passed: 0, rejected: 0, overrides: 0 };
const lines = fs.readFileSync(TERMS, 'utf8').split('\n').slice(1);
const norm1 = (h) => h.replace(/[^א-ת״׳]/g, '');
for (const line of lines) {
  const [latin, count, hebrew, alt, , , flag] = line.split('\t');
  if (!latin || !/^[a-z]+$/.test(latin) || HOLD.has(latin)) continue;
  const n = +count;
  if (flag && /^hand/.test(flag)) {
    if (hebrew) { exact[latin] = hebrew; stats.trusted++; }
    continue;
  }
  if (flag) continue;
  const gs = hebGuesses(latin);
  const top = n >= TOP_COUNT; // ranks <=300 were sampled and hand-corrected
  const min = top ? EXACT_MIN_SIM_TOP : EXACT_MIN_SIM;
  let best = null, bs = 0;
  // primary pair wins unless a runner-up beats it by a clear margin
  [hebrew, ...(alt ? alt.split(';').slice(0, 2) : [])].forEach((c, i) => {
    if (!c) return;
    const s = bestSim(gs, c, hebSim, !top) - (i ? ALT_MARGIN : 0);
    if (s > bs) { bs = s; best = c; }
  });
  if (best && bs >= min) { soft[latin] = norm1(best); stats.passed++; } else stats.rejected++;
}
const ov = path.join(here, 'overrides.tsv');
if (fs.existsSync(ov)) {
  for (const l of fs.readFileSync(ov, 'utf8').split('\n')) {
    if (!l.trim() || l.startsWith('#')) continue;
    const [lat, heb] = l.split('\t');
    if (lat && heb && !HOLD.has(lat.toLowerCase())) { exact[lat.toLowerCase()] = heb.trim(); stats.overrides++; }
  }
}
fs.writeFileSync(path.join(OUT, 'lexicon.json'), JSON.stringify({ exact, soft, byKey }));
const rows = [];
for (const [name, obj] of Object.entries({ exact, soft, byKey }))
  for (const [k, v] of Object.entries(obj)) rows.push(`${name}\x1f${k}\x1f${JSON.stringify(v)}`);
fs.writeFileSync(path.join(OUT, 'lexicon.lines'), rows.join('\n') + '\n');
const size = fs.statSync(path.join(OUT, 'lexicon.json')).size;
console.log(JSON.stringify({ exact: Object.keys(exact).length, soft: Object.keys(soft).length, keys: Object.keys(byKey).length, entries, bytes: size, ...stats }));
