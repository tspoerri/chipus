// Experiments 3 & 4: ranking spot-check + cost sensitivity.
import fs from "node:fs";
import { foldToken, foldHebrew, tokenize, stripNikud, isHebrewText } from "/Users/tamar/Documents/Projects/chipus/src/fold.js";
import { foldTokenRefined, refinedSimilarity } from "./refined.js";

const CORPUS_PATH = "/Users/tamar/Documents/Projects/rashi-search/data/rashi.json";
const FIELDS = ["dh", "t", "vt"];

const raw = JSON.parse(fs.readFileSync(CORPUS_PATH, "utf8"));
const records = Array.isArray(raw) ? raw : Object.values(raw);

// key -> Set(surface words, stripNikud-normalized) -- same as exp1
const keyWords = new Map();
for (const rec of records) {
  for (const field of FIELDS) {
    const text = rec[field];
    if (!text) continue;
    for (const tok of tokenize(String(text))) {
      if (/^\d+$/.test(tok)) continue;
      const keys = foldToken(tok);
      if (!keys.length) continue;
      const surface = stripNikud(tok);
      for (const key of keys) {
        let set = keyWords.get(key);
        if (!set) keyWords.set(key, (set = new Set()));
        set.add(surface);
      }
    }
  }
}

const QUERIES = [
  { query: "emet", target: "אמת", note: "vs מת (met) collision" },
  { query: "met", target: "מת", note: "vs אמת (emet) collision" },
  { query: "shabbos", target: "שבת", note: "must NOT prefer שבעת (shivah)" },
  { query: "olam", target: "עולם" },
  { query: "lecha", target: "לך" },
  { query: "elohecha", target: "אלהיך" },
  { query: "torah", target: "תורה" },
  { query: "berelshit", target: "בראשית", note: "typo of bereshit" },
  { query: "adam", target: "אדם" },
  { query: "amar", target: "אמר" },
];

function candidatesFor(query) {
  const qkeys = foldToken(query); // exact-tier coarse keys, best guess first
  const seen = new Set();
  const cands = [];
  for (const k of qkeys) {
    const set = keyWords.get(k);
    if (!set) continue;
    for (const w of set) {
      if (!seen.has(w)) { seen.add(w); cands.push(w); }
    }
  }
  return { qkeys, cands };
}

function rerank(query, cands, costs) {
  const qRefined = foldTokenRefined(query);
  const scored = cands.map((w) => ({
    word: w,
    refined: foldTokenRefined(w),
    sim: refinedSimilarity(qRefined, foldTokenRefined(w), costs),
  }));
  scored.sort((a, b) => b.sim - a.sim);
  return { qRefined, scored };
}

function rankOf(scoredList, target) {
  const targetStripped = stripNikud(target);
  const idx = scoredList.findIndex((s) => s.word === targetStripped);
  return idx === -1 ? null : idx + 1; // 1-based, null = not in candidate set at all
}

// --- Experiment 3: baseline costs ---
const BASELINE = { vowelIndel: 0.25, vowelContradiction: 0.75, consonantCost: 1.0 };
const exp3 = [];
for (const q of QUERIES) {
  const { qkeys, cands } = candidatesFor(q.query);
  const { qRefined, scored } = rerank(q.query, cands, BASELINE);
  const rank = rankOf(scored, q.target);
  exp3.push({
    query: q.query,
    target: q.target,
    note: q.note || "",
    qkeys,
    qRefined,
    candidateCount: cands.length,
    top10Before: cands.slice(0, 10),
    top10After: scored.slice(0, 10).map((s) => `${s.word} (${s.refined}, sim=${s.sim.toFixed(3)})`),
    rankAfter: rank,
    rank1: rank === 1,
  });
}

// --- Experiment 4: cost sensitivity ---
const COMBOS = [
  { name: "baseline (0.25/0.75)", vowelIndel: 0.25, vowelContradiction: 0.75, consonantCost: 1.0 },
  { name: "indel=0/contra=0.5", vowelIndel: 0, vowelContradiction: 0.5, consonantCost: 1.0 },
  { name: "indel=0/contra=1.0", vowelIndel: 0, vowelContradiction: 1.0, consonantCost: 1.0 },
  { name: "indel=0.5/contra=0.5", vowelIndel: 0.5, vowelContradiction: 0.5, consonantCost: 1.0 },
  { name: "indel=0.5/contra=1.0", vowelIndel: 0.5, vowelContradiction: 1.0, consonantCost: 1.0 },
];

const exp4 = [];
for (const combo of COMBOS) {
  const rows = [];
  let rank1Count = 0;
  for (const q of QUERIES) {
    const { cands } = candidatesFor(q.query);
    const { scored } = rerank(q.query, cands, combo);
    const rank = rankOf(scored, q.target);
    if (rank === 1) rank1Count++;
    rows.push({ query: q.query, rank });
  }
  exp4.push({ combo: combo.name, costs: combo, rank1Count, rows });
}

fs.writeFileSync(
  new URL("./results_exp3_4.json", import.meta.url),
  JSON.stringify({ exp3, exp4 }, null, 2)
);
console.error("wrote results_exp3_4.json");
console.error(JSON.stringify({ exp3: exp3.map(({ query, target, candidateCount, rankAfter, rank1 }) => ({ query, target, candidateCount, rankAfter, rank1 })) }, null, 2));
console.error(JSON.stringify({ exp4: exp4.map(({ combo, rank1Count }) => ({ combo, rank1Count })) }, null, 2));
