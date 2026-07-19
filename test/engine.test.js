import { test } from "node:test";
import assert from "node:assert/strict";
import { ChipusIndex } from "../src/index.js";

function buildIndex() {
  const idx = new ChipusIndex({
    fields: [
      { name: "dh", weight: 3 },
      { name: "body", weight: 1 },
    ],
  });
  idx.add([
    { id: "bereshit", dh: "בְּרֵאשִׁית", body: "אין המקרא הזה אומר אלא דרשני" },
    { id: "lechlecha", dh: "לֶךְ לְךָ", body: "להנאתך ולטובתך" },
    { id: "vayomer", dh: "וַיֹּאמֶר", body: "ויאמר ה' אל אברם" },
    { id: "noach", dh: "נֹחַ", body: "אלה תולדות נח" },
  ]);
  return idx;
}

const topId = (idx, q, opts) => idx.search(q, opts)[0]?.doc.id;

test("Hebrew query, vocalized and not, finds the doc", () => {
  const idx = buildIndex();
  assert.equal(topId(idx, "בראשית"), "bereshit");
  assert.equal(topId(idx, "בְּרֵאשִׁית"), "bereshit");
});

test("transliterated queries in any convention find the doc", () => {
  const idx = buildIndex();
  assert.equal(topId(idx, "bereshit"), "bereshit");
  assert.equal(topId(idx, "Bereishis"), "bereshit");
  assert.equal(topId(idx, "lech lecha"), "lechlecha");
  assert.equal(topId(idx, "vayomer"), "vayomer");
  assert.equal(topId(idx, "noach"), "noach");
});

test("typos are tolerated via key-space edit distance", () => {
  const idx = buildIndex();
  assert.equal(topId(idx, "berelshit"), "bereshit"); // inserted letter
  assert.equal(topId(idx, "toldos"), "noach");       // תולדות, Ashkenazi + chaser
});

test("multi-token phrase outranks scattered matches and rewards adjacency", () => {
  const idx = buildIndex();
  const res = idx.search("lech lecha");
  assert.equal(res[0].doc.id, "lechlecha");
  assert.ok(res[0].matches.length >= 2);
});

test("mixed-script query works token by token", () => {
  const idx = buildIndex();
  assert.equal(topId(idx, "el אברם"), "vayomer");
});

test("fuzzy can be disabled", () => {
  const idx = buildIndex();
  assert.equal(idx.search("berelshit", { fuzzy: false }).length, 0);
});

test("match metadata names field and word position", () => {
  const idx = buildIndex();
  const res = idx.search("dorsheni")[0] ?? idx.search("darsheni")[0];
  assert.ok(res, "should match דרשני in the body");
  assert.equal(res.doc.id, "bereshit");
  assert.equal(res.matches[0].field, "body");
});

// --- v3 opts (DESIGN-v3.md D2/D5) ------------------------------------------

test("v3 opts default off: scores are bit-identical to plain {}", () => {
  const build = (opts) => {
    const idx = new ChipusIndex({
      fields: [
        { name: "dh", weight: 3 },
        { name: "body", weight: 1 },
      ],
      ...opts,
    });
    idx.add([
      { id: "bereshit", dh: "בְּרֵאשִׁית", body: "אין המקרא הזה אומר אלא דרשני" },
      { id: "vayomer", dh: "וַיֹּאמֶר", body: "ויאמר ה' אל אברם" },
    ]);
    return idx;
  };
  const plain = build({});
  const explicit = build({ coverageWeight: 0, refineWeightLatin: null });
  for (const q of ["bereshit", "vayomer", "el אברם"]) {
    assert.deepEqual(plain.search(q), explicit.search(q));
  }
});

test("coverageWeight rewards a fully-consumed short field over a scattered long one", () => {
  // Two single-field docs at equal weight, equal tier (both EXACT on all
  // query tokens): doc A's field IS the query; doc B's field merely
  // contains the same words plus a lot more text.
  const idx = new ChipusIndex({ coverageWeight: 20 });
  idx.add([
    { id: "short", text: "אור גדול" },
    { id: "long", text: "אור גדול ואור קטן וגם הרבה מילים אחרות כאן כדי להאריך את השדה מאוד מאוד" },
  ]);
  const res = idx.search("אור גדול");
  assert.equal(res[0].doc.id, "short");
  // Without the bonus the two docs tie (same tokensMatched, same tier, same
  // field weight, no adjacency difference) — confirm the bonus is what
  // decides it.
  const idxOff = new ChipusIndex({});
  idxOff.add([
    { id: "short", text: "אור גדול" },
    { id: "long", text: "אור גדול ואור קטן וגם הרבה מילים אחרות כאן כדי להאריך את השדה מאוד מאוד" },
  ]);
  const resOff = idxOff.search("אור גדול");
  assert.equal(resOff[0].score, resOff[1].score);
});

test("refineWeightLatin applies only to Latin query tokens", () => {
  const idxHi = new ChipusIndex({ refineWeightLatin: 40 });
  const idxLo = new ChipusIndex({}); // REFINE_WEIGHT = 10
  for (const idx of [idxHi, idxLo]) {
    idx.add({ id: "vayomer", text: "וַיֹּאמֶר" });
  }
  // Latin query token: refineWeightLatin (40) should raise the score vs the
  // default REFINE_WEIGHT (10), same tier/matches otherwise.
  const hiLatin = idxHi.search("vayomer")[0].score;
  const loLatin = idxLo.search("vayomer")[0].score;
  assert.ok(hiLatin > loLatin, "Latin token score should rise with refineWeightLatin");

  // Hebrew query token: no Latin letters, so refineWeightLatin must not apply
  // — scores should match the default-weight engine exactly.
  const hiHeb = idxHi.search("ויאמר")[0].score;
  const loHeb = idxLo.search("ויאמר")[0].score;
  assert.equal(hiHeb, loHeb, "Hebrew token score should be unaffected by refineWeightLatin");
});
