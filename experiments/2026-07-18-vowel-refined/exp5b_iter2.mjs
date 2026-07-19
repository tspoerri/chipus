import fs from "node:fs";
import { foldToken, tokenize, stripNikud } from "/Users/tamar/Documents/Projects/chipus/src/fold.js";
import {
  foldTokenRefined, refinedSimilarity,
  foldTokenRefinedA, refinedSimilarity2,
  hebrewPrefixVariants,
} from "./refined.js";

const raw = JSON.parse(fs.readFileSync("/Users/tamar/Documents/Projects/rashi-search/data/rashi.json", "utf8"));
const records = Array.isArray(raw) ? raw : Object.values(raw);
const keyWords = new Map();
for (const rec of records) for (const field of ["dh","t","vt"]) {
  const text = rec[field]; if (!text) continue;
  for (const tok of tokenize(String(text))) {
    if (/^\d+$/.test(tok)) continue;
    const keys = foldToken(tok); if (!keys.length) continue;
    const surface = stripNikud(tok);
    for (const key of keys) { let s=keyWords.get(key); if(!s) keyWords.set(key,(s=new Set())); s.add(surface); }
  }
}

const QUERIES = [
  ["emet","אמת"],["met","מת"],["shabbos","שבת"],["olam","עולם"],["lecha","לך"],
  ["elohecha","אלהיך"],["torah","תורה"],["berelshit","בראשית"],["adam","אדם"],["amar","אמר"],
  ["haemet","האמת"],["ha'aretz","הארץ"],["baruch","ברוך"],["bereshit","בראשית"],
  ["veamar","ואמר"],["veamar","אמר","veamar→אמר"],
];

function candidatesFor(query) {
  const seen=new Set(), cands=[];
  for (const k of foldToken(query)) {
    const set=keyWords.get(k); if(!set) continue;
    for (const w of set) if(!seen.has(w)){seen.add(w);cands.push(w);}
  }
  return cands;
}

const VARIANTS = {
  baseline: { foldQ: foldTokenRefined, foldC: (t)=>[foldTokenRefined(t)], sim: refinedSimilarity },
  A: { foldQ: foldTokenRefinedA, foldC: (t)=>[foldTokenRefinedA(t)], sim: refinedSimilarity2 },
  B: { foldQ: foldTokenRefined, foldC: (t)=>hebrewPrefixVariants(t).map(foldTokenRefined), sim: refinedSimilarity },
  AB: { foldQ: foldTokenRefinedA, foldC: (t)=>hebrewPrefixVariants(t).map(foldTokenRefinedA), sim: refinedSimilarity2 },
};

for (const vowelIndel of [0, 0.25]) {
  const COSTS = { vowelIndel, vowelContradiction: 0.75, consonantCost: 1.0 };
  console.log(`\n================ vowelIndel=${vowelIndel} (contradiction=0.75) ================`);
  console.log("query\ttarget\tn\t" + Object.keys(VARIANTS).map(v=>`${v}(strict/ties)`).join("\t"));
  for (const [query, target, label] of QUERIES) {
    const cands = candidatesFor(query);
    const cells = [];
    for (const V of Object.values(VARIANTS)) {
      const qr = V.foldQ(query);
      const sims = cands.map((w)=>({ w, sim: Math.max(...V.foldC(w).map((rk)=>V.sim(qr,rk,COSTS))) }));
      const t = sims.find((s)=>s.w===target);
      if (!t) { cells.push("null"); continue; }
      const strictly = sims.filter((s)=>s.sim > t.sim).length;
      const tied = sims.filter((s)=>s.sim === t.sim).length;
      cells.push(`${strictly+1}/${tied}`);  // competition rank / tie-group size
    }
    console.log(`${label||query}\t${target}\t${cands.length}\t${cells.join("\t")}`);
  }
}
