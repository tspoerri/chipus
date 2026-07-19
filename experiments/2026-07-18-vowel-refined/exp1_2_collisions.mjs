// Experiments 1 & 2: coarse-key collision stats, and how much the refined
// key separates each collision group.
import fs from "node:fs";
import { foldToken, tokenize, stripNikud } from "/Users/tamar/Documents/Projects/chipus/src/fold.js";
import { foldTokenRefined } from "./refined.js";

const CORPUS_PATH = "/Users/tamar/Documents/Projects/rashi-search/data/rashi.json";
const FIELDS = ["dh", "t", "vt"];

const raw = JSON.parse(fs.readFileSync(CORPUS_PATH, "utf8"));
const records = Array.isArray(raw) ? raw : Object.values(raw);
console.error(`corpus records: ${records.length}`);

// key -> Set(surface words, stripNikud-normalized)
const keyWords = new Map();
let tokenCount = 0;
for (const rec of records) {
  for (const field of FIELDS) {
    const text = rec[field];
    if (!text) continue;
    const tokens = tokenize(String(text));
    for (const tok of tokens) {
      if (/^\d+$/.test(tok)) continue; // skip pure digits/verse numbers
      const keys = foldToken(tok);
      if (!keys.length) continue;
      tokenCount++;
      const surface = stripNikud(tok);
      for (const key of keys) {
        let set = keyWords.get(key);
        if (!set) keyWords.set(key, (set = new Set()));
        set.add(surface);
      }
    }
  }
}

console.error(`tokens folded: ${tokenCount}, unique coarse keys: ${keyWords.size}`);

// --- Experiment 1: collision stats ---
const sizes = [...keyWords.values()].map((s) => s.size);
const histogram = new Map(); // size -> count of keys with that many distinct words
for (const sz of sizes) histogram.set(sz, (histogram.get(sz) || 0) + 1);
const sortedHistogram = [...histogram.entries()].sort((a, b) => a[0] - b[0]);

const collisionGroups = [...keyWords.entries()].filter(([, set]) => set.size >= 2);
collisionGroups.sort((a, b) => b[1].size - a[1].size);
const worst15 = collisionGroups.slice(0, 15).map(([key, set]) => ({ key, size: set.size, words: [...set] }));

const exp1 = {
  totalTokensFolded: tokenCount,
  uniqueCoarseKeys: keyWords.size,
  singletonKeys: sizes.filter((s) => s === 1).length,
  collisionGroups: collisionGroups.length,
  histogram: sortedHistogram,
  worst15,
};

// --- Experiment 2: refinement power over every collision group (size>=2) ---
// For each group, compute refined key per member word (best-guess, nikud-vowels ON).
// Classify: "separated" = all refined keys distinct; "merged" = all refined keys
// identical (no separation at all); "partial" = strictly between.
let separated = 0, partial = 0, merged = 0;
const worst15Refined = [];
for (const [key, set] of collisionGroups) {
  const words = [...set];
  const refinedKeys = words.map((w) => foldTokenRefined(w));
  const distinctRefined = new Set(refinedKeys).size;
  let cls;
  if (distinctRefined === words.length) { cls = "separated"; separated++; }
  else if (distinctRefined === 1) { cls = "merged"; merged++; }
  else { cls = "partial"; partial++; }
  if (worst15.some((w) => w.key === key)) {
    worst15Refined.push({
      key,
      distinctRefined,
      total: words.length,
      cls,
      pairs: words.map((w, i) => [w, refinedKeys[i]]),
    });
  }
}

const exp2 = {
  totalGroups: collisionGroups.length,
  separated, partial, merged,
  separatedPct: +(100 * separated / collisionGroups.length).toFixed(1),
  partialPct: +(100 * partial / collisionGroups.length).toFixed(1),
  mergedPct: +(100 * merged / collisionGroups.length).toFixed(1),
  worst15Refined,
};

fs.writeFileSync(
  new URL("./results_exp1_2.json", import.meta.url),
  JSON.stringify({ exp1, exp2 }, null, 2)
);
console.error("wrote results_exp1_2.json");
console.error(JSON.stringify({ exp1: { ...exp1, worst15: undefined }, exp2: { ...exp2, worst15Refined: undefined } }, null, 2));
