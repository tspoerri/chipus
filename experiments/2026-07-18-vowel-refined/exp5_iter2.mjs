// Iteration 2: Variant A (guttural split), Variant B (prefix-stripped index
// variants), A+B — ranking spot-check + variant-A separation stats.
import fs from "node:fs";
import { foldToken, tokenize, stripNikud, isHebrewText } from "/Users/tamar/Documents/Projects/chipus/src/fold.js";
import {
  foldTokenRefined, refinedSimilarity,
  foldTokenRefinedA, refinedSimilarity2,
  hebrewPrefixVariants,
} from "./refined.js";

const COSTS = { vowelIndel: 0, vowelContradiction: 0.75, consonantCost: 1.0 };

const raw = JSON.parse(fs.readFileSync("/Users/tamar/Documents/Projects/rashi-search/data/rashi.json", "utf8"));
const records = Array.isArray(raw) ? raw : Object.values(raw);

const keyWords = new Map();
for (const rec of records) {
  for (const field of ["dh", "t", "vt"]) {
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
  { query: "emet", target: "אמת" },
  { query: "met", target: "מת" },
  { query: "shabbos", target: "שבת" },
  { query: "olam", target: "עולם" },
  { query: "lecha", target: "לך" },
  { query: "elohecha", target: "אלהיך" },
  { query: "torah", target: "תורה" },
  { query: "berelshit", target: "בראשית" },
  { query: "adam", target: "אדם" },
  { query: "amar", target: "אמר" },
  { query: "haemet", target: "האמת" },
  { query: "ha'aretz", target: "הארץ" },
  { query: "baruch", target: "ברוך" },
  { query: "bereshit", target: "בראשית" },
  { query: "veamar", target: "ואמר" },
  { query: "veamar", target: "אמר", label: "veamar→אמר" },
];

function candidatesFor(query) {
  const seen = new Set();
  const cands = [];
  for (const k of foldToken(query)) {
    const set = keyWords.get(k);
    if (!set) continue;
    for (const w of set) if (!seen.has(w)) { seen.add(w); cands.push(w); }
  }
  return cands;
}

// Variant definitions.
// fold: query+corpus refined-key function. sim: similarity fn.
// corpusVariants: surface -> array of surfaces to fold (variant B).
const VARIANTS = {
  baseline: {
    foldQ: (t) => foldTokenRefined(t),
    foldC: (t) => [foldTokenRefined(t)],
    sim: refinedSimilarity,
  },
  A: {
    foldQ: (t) => foldTokenRefinedA(t),
    foldC: (t) => [foldTokenRefinedA(t)],
    sim: refinedSimilarity2,
  },
  B: {
    foldQ: (t) => foldTokenRefined(t),
    foldC: (t) => hebrewPrefixVariants(t).map((v) => foldTokenRefined(v)),
    sim: refinedSimilarity,
  },
  AB: {
    foldQ: (t) => foldTokenRefinedA(t),
    foldC: (t) => hebrewPrefixVariants(t).map((v) => foldTokenRefinedA(v)),
    sim: refinedSimilarity2,
  },
};

const table = [];
for (const q of QUERIES) {
  const cands = candidatesFor(q.query);
  const row = { query: q.label || q.query, target: q.target, n: cands.length };
  for (const [name, V] of Object.entries(VARIANTS)) {
    const qr = V.foldQ(q.query);
    const scored = cands.map((w) => {
      const sims = V.foldC(w).map((rk) => V.sim(qr, rk, COSTS));
      return { word: w, sim: Math.max(...sims) };
    });
    scored.sort((a, b) => b.sim - a.sim);
    const idx = scored.findIndex((s) => s.word === q.target);
    row[name] = idx === -1 ? null : idx + 1;
    if (name === "AB") row.topAB = scored.slice(0, 6).map((s) => `${s.word}:${s.sim.toFixed(3)}`).join(" ");
    if (name === "A") row.topA = scored.slice(0, 6).map((s) => `${s.word}:${s.sim.toFixed(3)}`).join(" ");
  }
  table.push(row);
}

console.log("query\ttarget\tn\tbaseline\tA\tB\tAB");
for (const r of table) {
  console.log(`${r.query}\t${r.target}\t${r.n}\t${r.baseline}\t${r.A}\t${r.B}\t${r.AB}`);
}
console.log("\n--- top-6 under A / AB for non-rank-1 rows ---");
for (const r of table) {
  if (r.A !== 1 || r.AB !== 1) {
    console.log(`${r.query} (${r.target})  A_rank=${r.A} AB_rank=${r.AB}`);
    console.log(`  A : ${r.topA}`);
    console.log(`  AB: ${r.topAB}`);
  }
}

// --- Experiment 2 rerun for variant A: separation stats ---
const groups = [...keyWords.entries()].filter(([, s]) => s.size >= 2);
function sepStats(fold) {
  let sep = 0, part = 0, mer = 0;
  for (const [, set] of groups) {
    const words = [...set];
    const d = new Set(words.map(fold)).size;
    if (d === words.length) sep++;
    else if (d === 1) mer++;
    else part++;
  }
  return { sep, part, mer, total: groups.length };
}
const sBase = sepStats((w) => foldTokenRefined(w));
const sA = sepStats((w) => foldTokenRefinedA(w));
console.log("\n--- separation stats ---");
for (const [name, s] of [["baseline", sBase], ["variantA", sA]]) {
  console.log(`${name}: separated ${s.sep} (${(100 * s.sep / s.total).toFixed(1)}%), partial ${s.part} (${(100 * s.part / s.total).toFixed(1)}%), merged ${s.mer} (${(100 * s.mer / s.total).toFixed(1)}%)`);
}

// aMT-type check: does variant A now separate אמת from האמת/המת inside coarse key MT?
const mtWords = [...(keyWords.get("MT") || [])];
const interesting = ["אמת", "האמת", "המת", "מת", "מאת", "מעט", "מטה"];
console.log("\n--- MT-group sample refined keys (baseline vs A) ---");
for (const w of interesting) {
  if (mtWords.includes(w)) console.log(`${w}: base=${foldTokenRefined(w)}  A=${foldTokenRefinedA(w)}`);
}

fs.writeFileSync(new URL("./results_exp5_iter2.json", import.meta.url), JSON.stringify({ table, sBase, sA }, null, 2));
