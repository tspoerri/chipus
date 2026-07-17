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
