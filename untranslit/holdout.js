#!/usr/bin/env node
/* holdout.js - score the converter on words it has never been tuned on.
 *   node untranslit/holdout.js [seed]
 * Pool: checked terms.tsv rows (hand-fixed, plus unflagged top rows, which were sampled and
 * checked), minus the eval set and overrides.tsv (those words were looked at while tuning).
 * Each run draws a fresh random 25% (or the sample for [seed]), builds a lexicon without those
 * words (and their -h / no-h spellings) into a temp folder, and scores only them.
 * Print only the score and a few misses; do not hand-fix misses from here, or it stops being held out. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { EVAL } from './eval-set.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const TERMS = process.env.TERMS_TSV || `${process.env.HOME}/Documents/Projects/life-os/untranslit-mining/terms.tsv`;
const TOP_COUNT = 650, SHARE = 0.25;

const seen = new Set(EVAL.flatMap(([lat]) => lat.toLowerCase().split(/\s+/)));
for (const l of fs.readFileSync(path.join(here, 'overrides.tsv'), 'utf8').split('\n')) if (l && !l.startsWith('#')) seen.add(l.split('\t')[0].toLowerCase());
// English words and translations whose label is not a spelling of the word (Tamar: "messiah, that's english")
for (const w of ['messiah', 'responsa', 'deut', 'halachic', 'halachically', 'maimonides', 'rabbis']) seen.add(w);
const near = (w) => [w, w + 'h', w.replace(/h$/, '')];

const pool = [];
for (const line of fs.readFileSync(TERMS, 'utf8').split('\n').slice(1)) {
  const [latin, count, hebrew, , , , flag] = line.split('\t');
  if (!latin || !/^[a-z]{3,}$/.test(latin) || !hebrew) continue;
  const checked = /^hand/.test(flag || '') || (!flag && +count >= TOP_COUNT);
  if (checked && !near(latin).some((w) => seen.has(w))) pool.push([latin, hebrew.replace(/[^א-ת׳״]/g, '')]);
}

let seed = +(process.argv[2] ?? Math.floor(Math.random() * 1e9));
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const usedSeed = seed;
const held = pool.filter(() => rnd() < SHARE);

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'untranslit-holdout-'));
try {
  fs.writeFileSync(path.join(dir, 'hold.txt'), held.flatMap(([w]) => near(w)).join('\n'));
  execFileSync(process.execPath, ['--no-warnings', path.join(here, 'build-lexicon.js')],
    { env: { ...process.env, HOLDOUT: path.join(dir, 'hold.txt'), LEX_DIR: dir }, stdio: 'ignore' });
  process.env.LEX_DIR = dir;
  const { convertText } = await import('./convert.js');
  const F = { 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' };
  const n = (s) => s.replace(/[ךםןףץ]/g, (c) => F[c]);
  const miss = held.filter(([w, h]) => n(convertText(w)) !== n(h)).map(([w, h]) => `${w} ${convertText(w)} (want ${h})`);
  const ok = held.length - miss.length;
  console.log(`holdout seed ${usedSeed}: ${ok}/${held.length} = ${(100 * ok / held.length).toFixed(1)}% (pool ${pool.length})`);
  console.log('sample misses:', miss.slice(0, 8).join('; '));
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
