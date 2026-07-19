// refined.js — prototype vowel-aware "refined key" for chipus v2, plus an
// asymmetric alignment similarity over refined keys.
//
// This file is a standalone PROTOTYPE. It re-derives the same consonant
// classes as chipus/src/fold.js (copied/adapted, not imported, since the
// internal tables there aren't exported), but instead of dropping vowel-ish
// letters it emits lowercase vowel-CLASS markers ('a' / 'i' / 'u')
// interleaved at the position where the vowel evidence occurred. Uppercase
// consonant-class letters are identical to chipus's coarse key alphabet
// (B G D Z C T S $ K L M N R).
//
// Do not edit chipus/src/*.js from here — this is exploration only.

import { isHebrewText, stripNikud, tokenize } from "/Users/tamar/Documents/Projects/chipus/src/fold.js";

export { isHebrewText, stripNikud, tokenize };

// --- Hebrew refined folding ------------------------------------------------
//
// Consonant classes: identical to chipus's HEB_CLASS.
// Vowel classes (spec):
//   א, ע           -> 'a' (generic vowel marker), always
//   ה               -> 'a', in every position (not just word-final)
//   י (mater, i.e. always — fold.js never treats yud as a folded consonant)
//                   -> 'i'
//   mater-vav (the cases fold.js drops or treats as optional-dropped)
//                   -> 'u'
//   consonantal vav (fold.js "B") -> 'B', no vowel marker from the letter
//                   itself
// Nikud-vowel classes (optional, controlled by opts.nikudVowels):
//   patach/kamatz/segol/tzere/schwa -> 'a'
//   chirik                          -> 'i'
//   holam/shuruk/kubutz             -> 'u'
//   emitted AFTER the consonant char(s) they decorate.

const HEB_CONS_CLASS = {
  "ב": "B", "פ": "B", "ף": "B",
  "ג": "G", "ד": "D",
  "ז": "Z", "צ": "C", "ץ": "C",
  "ט": "T", "ת": "T", "ס": "S",
  "כ": "K", "ך": "K", "ק": "K", "ח": "K",
  "ל": "L", "מ": "M", "ם": "M", "נ": "N", "ן": "N", "ר": "R",
  "װ": "B",
};

const SHIN_DOT = "ׁ";
const SIN_DOT = "ׂ";
const DAGESH = "ּ";
const HOLAM = /[ֹֺ]/;
const VOWEL_ON_VAV = /[ְ-ָֻ]/;

// Nikud -> vowel class, for the optional nikud-vowel-emission mode.
// Patach ַ, Kamatz ָ / Kamatz-katan, Segol ֶ, Tzere ֵ, Sheva ְ  -> 'a'
// Chirik ִ -> 'i'
// Holam ֹֺ, Kubutz ֻ, (Shuruk is a vav+dagesh, handled at the vav itself) -> 'u'
const NIKUD_VOWEL_CLASS = {
  "ַ": "a", "ָ": "a", "ֶ": "a", "ֵ": "a", "ְ": "a", "ֱ": "a", "ֲ": "a", "ֳ": "a",
  "ִ": "i",
  "ֹ": "u", "ֺ": "u", "ֻ": "u",
};

function isMark(ch) {
  return ch >= "֑" && ch <= "ׇ" && ch !== "־" && ch !== "׃";
}

/**
 * Fold one Hebrew-script token to its refined key (single best-guess
 * string — no candidate expansion, unlike chipus's coarse fold). Ambiguous
 * bare-vav/bare-shin cases resolve to the same best guess chipus's coarse
 * folder would rank first.
 *
 * @param {string} token
 * @param {{nikudVowels?: boolean}} [opts] nikudVowels defaults to true.
 */
export function foldHebrewRefined(token, opts = {}) {
  const nikudVowels = opts.nikudVowels !== false;
  const chars = [...token];
  let out = "";
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (isMark(ch)) continue;
    if (ch >= "0" && ch <= "9") { out += ch; continue; }

    const marks = [];
    for (let j = i + 1; j < chars.length && isMark(chars[j]); j++) marks.push(chars[j]);
    const markStr = marks.join("");

    // Generic vowel letters (matres lectionis, always dropped in coarse fold)
    if (ch === "א" || ch === "ע") { out += "a"; continue; }
    if (ch === "ה") { out += "a"; continue; }
    if (ch === "י") { out += "i"; continue; }

    if (ch === "ש") {
      // best guess: shin far more common than sin when unvocalized
      if (markStr.includes(SIN_DOT)) out += "S";
      else out += "$";
      if (nikudVowels) out += nikudVowelFor(markStr);
      continue;
    }

    if (ch === "ו") {
      const isFirstLetter = out === "";
      const nextIsBareVav = chars[i + 1] === "ו";
      if (nextIsBareVav) {
        out += "B";
        i++; // consume second vav (doubled vav = consonant v)
      } else if (VOWEL_ON_VAV.test(markStr)) {
        out += "B";
        if (nikudVowels) out += nikudVowelFor(markStr);
      } else if (HOLAM.test(markStr) || markStr.includes(DAGESH)) {
        out += "u"; // holam male / shuruk = mater lectionis
      } else if (isFirstLetter) {
        out += "B"; // bare word-initial vav = consonant
      } else {
        out += "u"; // bare mid-word vav: best guess = mater (matches coarse fold's variant-0 guess)
      }
      continue;
    }

    const cls = HEB_CONS_CLASS[ch];
    if (cls !== undefined) {
      out += cls;
      if (nikudVowels) out += nikudVowelFor(markStr);
    }
    // anything else (punctuation, ױ/ײ vowel ligatures) dropped
  }
  return collapseRuns(out);
}

function nikudVowelFor(markStr) {
  for (const ch of markStr) {
    const cls = NIKUD_VOWEL_CLASS[ch];
    if (cls) return cls;
  }
  return "";
}

// --- Latin refined folding --------------------------------------------------

const COMBINING_LATIN = /[̀-ͯ]/g;
const APOSTROPHES = /['‘’.׳-]/g;

/**
 * Fold one Latin-script token to its refined key. Consonant classes match
 * chipus's foldLatin variant-0 guess (s -> S, z -> Z — the coarse folder's
 * best guess, since refined keys aren't candidate-expanded here).
 */
export function foldLatinRefined(token) {
  let s = token.toLowerCase().normalize("NFD").replace(COMBINING_LATIN, "");
  s = s.replace(APOSTROPHES, "");
  s = s.replace(/x/g, "ks");
  s = s.replace(/sch|sh/g, "$");
  s = s.replace(/th/g, "T");
  s = s.replace(/tz|ts/g, "C");
  s = s.replace(/ch|kh|ck|q|k|c/g, "K");
  s = s.replace(/ph|f|v|w|b|p/g, "B");
  // h is a silent vowel-carrier -> dropped. j is a rare consonant -> dropped.
  // y is treated as a vowel here (vocalic y), unlike the coarse folder.
  s = s.replace(/[hj]/g, "");
  s = s.replace(/y/g, "i");
  s = s.replace(/t/g, "T");
  s = s.replace(/s/g, "S"); // best guess (coarse folder's S/T ambiguity resolves to S)
  s = s.replace(/z/g, "Z"); // best guess (coarse folder's Z/C ambiguity resolves to Z)
  s = s.replace(/g/g, "G").replace(/d/g, "D").replace(/l/g, "L")
       .replace(/m/g, "M").replace(/n/g, "N").replace(/r/g, "R");
  s = s.replace(/[ae]/g, "a").replace(/[ou]/g, "u"); // i already 'i' from above
  s = s.replace(/[^A-Za-z$ 0-9]/g, "");
  return collapseRuns(s);
}

/** Fold any token (script auto-detected) to its refined key. */
export function foldTokenRefined(token, opts = {}) {
  if (isHebrewText(token)) return foldHebrewRefined(token, opts);
  if (/[a-z]/i.test(token)) return foldLatinRefined(token);
  return token || "";
}

function collapseRuns(s) {
  return s.replace(/(.)\1+/g, "$1");
}

// --- Asymmetric refined similarity ------------------------------------------
//
// Needleman-Wunsch-style global alignment (implemented as classic DP edit
// distance with position-dependent costs):
//   * consonant substitution / indel: 1.0
//   * vowel char present in one string, absent (gap) at aligned position
//     in the other: 0.25  (vowel omission is weak evidence — users drop them)
//   * two DIFFERENT vowel classes aligned to each other: 0.75 (contradiction)
//   * identical chars (consonant or vowel): 0
//   * vowel-vs-consonant substitution (mismatched types): treated as a full
//     mismatch, 1.0 (not covered explicitly by the spec's vowel rules).
//
// similarity = 1 - dist / max(len(a), len(b))   (1.0 if both strings empty)

export const DEFAULT_COSTS = { vowelIndel: 0.25, vowelContradiction: 0.75, consonantCost: 1.0 };

function isVowelChar(ch) {
  return ch === "a" || ch === "i" || ch === "u";
}

export function refinedDistance(a, b, costs = DEFAULT_COSTS) {
  const { vowelIndel, vowelContradiction, consonantCost } = costs;
  const n = a.length, m = b.length;
  if (n === 0 && m === 0) return 0;

  const delCost = (ch) => (isVowelChar(ch) ? vowelIndel : consonantCost);
  const insCost = (ch) => (isVowelChar(ch) ? vowelIndel : consonantCost);
  const subCost = (x, y) => {
    if (x === y) return 0;
    if (isVowelChar(x) && isVowelChar(y)) return vowelContradiction;
    return consonantCost;
  };

  let prev = new Array(m + 1);
  let curr = new Array(m + 1);
  prev[0] = 0;
  for (let j = 1; j <= m; j++) prev[j] = prev[j - 1] + insCost(b[j - 1]);
  for (let i = 1; i <= n; i++) {
    curr[0] = prev[0] + delCost(a[i - 1]);
    for (let j = 1; j <= m; j++) {
      curr[j] = Math.min(
        prev[j] + delCost(a[i - 1]),
        curr[j - 1] + insCost(b[j - 1]),
        prev[j - 1] + subCost(a[i - 1], b[j - 1])
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[m];
}

export function refinedSimilarity(a, b, costs = DEFAULT_COSTS) {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  const dist = refinedDistance(a, b, costs);
  return 1 - dist / maxLen;
}

// ===========================================================================
// Iteration 2 — Variant A: split guttural classes; Variant B: prefix-stripped
// index variants.
// ===========================================================================
//
// Variant A char alphabet additions (lowercase-ish, non-vowel):
//   'ʔ'  א/ע — weak-consonant class (often carries a vowel)
//   'h'  word-initial/medial ה — weak-consonant class
//   ה word-final stays 'a' (mater).
//   Latin word-INITIAL vowel additionally emits 'ʔ' before its vowel marker.
//
// Alignment costs for weak classes (ʔ, h):
//   weak vs identical weak = 0; ʔ vs h = 0.25; weak vs vowel = 0.25;
//   weak vs gap = 0.25; weak vs consonant = 1.0.

export function foldHebrewRefinedA(token, opts = {}) {
  const nikudVowels = opts.nikudVowels !== false;
  const chars = [...token];
  // find index of last non-mark char (to detect word-final ה)
  let lastIdx = -1;
  for (let i = chars.length - 1; i >= 0; i--) {
    if (!isMark(chars[i])) { lastIdx = i; break; }
  }
  let out = "";
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (isMark(ch)) continue;
    if (ch >= "0" && ch <= "9") { out += ch; continue; }
    const marks = [];
    for (let j = i + 1; j < chars.length && isMark(chars[j]); j++) marks.push(chars[j]);
    const markStr = marks.join("");

    if (ch === "א" || ch === "ע") { out += "ʔ"; continue; }
    if (ch === "ה") { out += (i === lastIdx ? "a" : "h"); continue; }
    if (ch === "י") { out += "i"; continue; }

    if (ch === "ש") {
      out += markStr.includes(SIN_DOT) ? "S" : "$";
      if (nikudVowels) out += nikudVowelFor(markStr);
      continue;
    }
    if (ch === "ו") {
      const isFirstLetter = out === "";
      const nextIsBareVav = chars[i + 1] === "ו";
      if (nextIsBareVav) { out += "B"; i++; }
      else if (VOWEL_ON_VAV.test(markStr)) { out += "B"; if (nikudVowels) out += nikudVowelFor(markStr); }
      else if (HOLAM.test(markStr) || markStr.includes(DAGESH)) out += "u";
      else if (isFirstLetter) out += "B";
      else out += "u";
      continue;
    }
    const cls = HEB_CONS_CLASS[ch];
    if (cls !== undefined) {
      out += cls;
      if (nikudVowels) out += nikudVowelFor(markStr);
    }
  }
  return collapseRuns(out);
}

export function foldLatinRefinedA(token) {
  const base = foldLatinRefined(token);
  // word-initial vowel implies א/ע/ה in the Hebrew: prepend ʔ
  if (/^[aiu]/.test(base)) return "ʔ" + base;
  return base;
}

export function foldTokenRefinedA(token, opts = {}) {
  if (isHebrewText(token)) return foldHebrewRefinedA(token, opts);
  if (/[a-z]/i.test(token)) return foldLatinRefinedA(token);
  return token || "";
}

// --- weak-class-aware similarity -------------------------------------------

function charType(ch) {
  if (ch === "a" || ch === "i" || ch === "u") return "vowel";
  if (ch === "ʔ" || ch === "h") return "weak";
  return "cons";
}

export function refinedDistance2(a, b, costs = DEFAULT_COSTS) {
  const { vowelIndel, vowelContradiction, consonantCost } = costs;
  const WEAK = 0.25;
  const gapCost = (ch) => {
    const t = charType(ch);
    return t === "vowel" ? vowelIndel : t === "weak" ? WEAK : consonantCost;
  };
  const subCost = (x, y) => {
    if (x === y) return 0;
    const tx = charType(x), ty = charType(y);
    if (tx === "vowel" && ty === "vowel") return vowelContradiction;
    if (tx === "weak" && ty === "weak") return WEAK;      // ʔ vs h
    if ((tx === "weak" && ty === "vowel") || (tx === "vowel" && ty === "weak")) return WEAK;
    return consonantCost; // anything involving a consonant class
  };
  const n = a.length, m = b.length;
  if (n === 0 && m === 0) return 0;
  let prev = new Array(m + 1), curr = new Array(m + 1);
  prev[0] = 0;
  for (let j = 1; j <= m; j++) prev[j] = prev[j - 1] + gapCost(b[j - 1]);
  for (let i = 1; i <= n; i++) {
    curr[0] = prev[0] + gapCost(a[i - 1]);
    for (let j = 1; j <= m; j++) {
      curr[j] = Math.min(
        prev[j] + gapCost(a[i - 1]),
        curr[j - 1] + gapCost(b[j - 1]),
        prev[j - 1] + subCost(a[i - 1], b[j - 1])
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[m];
}

export function refinedSimilarity2(a, b, costs = DEFAULT_COSTS) {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - refinedDistance2(a, b, costs) / maxLen;
}

// --- Variant B: Hebrew prefix-stripped surface variants ---------------------
//
// For a (nikud-stripped) Hebrew token beginning with a single-letter prefix
// (ה ו ב ל כ מ ש), also produce the stripped form; handle two-letter stacks
// (ו+ה, ב+ה, ...) by allowing a second strip when the second letter is also
// a prefix letter. Query side is NOT expanded.

const HEB_PREFIX = new Set(["ה", "ו", "ב", "ל", "כ", "מ", "ש"]);

export function hebrewPrefixVariants(surface) {
  const out = [surface];
  const chars = [...surface];
  if (chars.length >= 3 && HEB_PREFIX.has(chars[0])) {
    out.push(chars.slice(1).join(""));
    if (chars.length >= 4 && HEB_PREFIX.has(chars[1])) {
      out.push(chars.slice(2).join(""));
    }
  }
  return out;
}
