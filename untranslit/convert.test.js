import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { EVAL } from './eval-set.js';

const here = path.dirname(fileURLToPath(import.meta.url));
if (!fs.existsSync(path.join(here, 'lexicon.json'))) {
  execFileSync(process.execPath, ['--no-warnings', path.join(here, 'build-lexicon.js')], { stdio: 'inherit' });
}
const { convertText, convertWord } = await import('./convert.js');

test('eval set: >= 85% overall, per-source report', () => {
  const stats = {}; const wrong = [];
  for (const [lat, want] of EVAL) {
    const srcs = lat.split(/\s+/).map((w) => convertWord(w).source);
    const key = srcs.includes('guess') ? 'guess' : srcs.includes('lexicon') ? 'lexicon' : 'exact';
    const s = (stats[key] ||= { n: 0, ok: 0 }); s.n++;
    if (want.split('|').includes(convertText(lat))) s.ok++; else wrong.push(`${lat} -> ${convertText(lat)} (want ${want})`);
  }
  const n = EVAL.length, ok = Object.values(stats).reduce((a, s) => a + s.ok, 0);
  console.log(`eval ${ok}/${n} = ${(100 * ok / n).toFixed(1)}%`, JSON.stringify(stats), '\nwrong:', wrong.join('; '));
  assert.ok(EVAL.length >= 120);
  assert.ok(ok / n >= 0.85, `accuracy ${ok}/${n}`);
});

test('convertWord sources', () => {
  assert.equal(convertWord('hashem').source, 'exact');
  assert.equal(convertWord('shalom').hebrew, 'שלום');
  assert.equal(convertWord('qzx').source, 'guess');
});

const SENT = [
  ['ani holech la-bayit.', null],
  ['Shalom, Aryeh! How are you?', null],
  ['  leading and   multiple   spaces  ', null],
  ['line one\nline two\n\nline four', null],
  ['Call 555-1234 at 3:30pm (Shabbos)', null],
  ['"kiddush" & havdalah; tefillin: yes/no?', null],
  ['שלום shalom שלום', 'שלום שלום שלום'],
  ['1. torah 2. mishna 3. gemara', '1. תורה 2. משנה 3. גמרא'],
  ['tab\there', null],
  ['…and then—pesach!', null],
];
for (const [input, want] of SENT) {
  test(`sentence ${JSON.stringify(input)}`, () => {
    const out = convertText(input);
    assert.ok(!/[A-Za-z]/.test(out), `Latin left: ${out}`);
    if (want) assert.equal(out, want);
    // non-letter skeleton (punctuation, digits, whitespace, non-Latin text) is unchanged
    const skel = (s) => s.replace(/[A-Za-z]+/g, '').replace(/[א-ת]+/g, '');
    const keep = (s) => s.replace(/[^\s\d.,:;!?"'&()/…—\-]/g, '');
    assert.equal(keep(out), keep(input));
  });
}

test('digits, punctuation and Hebrew untouched', () => {
  assert.equal(convertText('123 !?,.; שלום'), '123 !?,.; שלום');
  assert.equal(convertText(''), '');
});

test('prefixes and apostrophes', () => {
  assert.equal(convertText('ha-shana'), 'השנה');
  assert.equal(convertText("ma'ariv"), 'מעריב');
  assert.equal(convertText("B'Av"), 'באב');
  assert.equal(convertText('ve-ani'), 'ואני');
  assert.equal(convertText('hashabbat'), 'השבת');
});

test('cli: stdin to stdout, no newline added or removed, any cwd', () => {
  const cli = path.join(here, 'cli.js');
  const run = (input) => execFileSync(process.execPath, [cli], { input, cwd: '/', encoding: 'utf8' });
  assert.equal(run('ani'), 'אני');
  assert.equal(run('ani\n'), 'אני\n');
  assert.equal(run('x  y\n\n'), convertText('x  y\n\n'));
});

test('vowel rules: mid-word vowel pair, first letter, -ia/-ua endings', () => {
  assert.equal(convertText('meidim'), 'מעידים');   // e-i hides an ayin
  assert.equal(convertText('yemallel'), 'ימלל');   // y- must stay yud (not אומלל)
  assert.equal(convertText('yashmia'), 'ישמיע');   // final -ia -> יע
  assert.equal(convertText('shavua'), 'שבוע');
  assert.equal(convertText('rakia'), 'רקיע');       // unknown -ia defaults to יע
  assert.equal(convertText('gedalia'), 'גדליה');   // known -ia words ending in יה still win
  assert.equal(convertText('chanukia'), 'חנוכיה');
  assert.equal(convertText('kushiah'), 'קושיה');   // -iah must keep the י (not קשה)
  assert.equal(convertText('ovadiah'), 'עובדיה');  // a fix for ovadia covers ovadiah
  assert.equal(convertText('beis'), 'בית');        // vowel pair as a diphthong
  assert.equal(convertText('shmuel'), 'שמואל');    // vowel pair as a glottal stop
  assert.equal(convertText('lehodia'), 'להודיע');
});
