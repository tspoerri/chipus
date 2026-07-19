import { test } from "node:test";
import assert from "node:assert/strict";
import {
  foldHebrewRefined,
  foldLatinRefined,
  foldTokenRefined,
  hebrewPrefixVariants,
  refinedDistance,
  refinedSimilarity,
  ChipusIndex,
} from "../src/index.js";

test("guttural split separates collision-group members (DESIGN-v2.md worked example)", () => {
  assert.equal(foldHebrewRefined("אמת"), "ʔMT");
  assert.equal(foldHebrewRefined("האמת"), "hʔMT");
  assert.equal(foldHebrewRefined("המת"), "hMT");
  assert.equal(foldHebrewRefined("מעט"), "MʔT");
});

test("Latin refined folding keeps vowel classes and word-initial ʔ", () => {
  assert.deepEqual(foldLatinRefined("emet"), ["ʔaMaT"]);
  assert.deepEqual(foldLatinRefined("olam"), ["ʔuLaM"]);
});

test("Latin refined folding carries s/z ambiguity as it does in the coarse fold", () => {
  const variants = foldLatinRefined("shabbos");
  assert.ok(variants.includes("$aBuS"));
  assert.ok(variants.includes("$aBuT")); // Ashkenazi sav — aligns with שבת's T
});

test("nikud vowels are emitted after their consonant", () => {
  assert.equal(foldHebrewRefined("שַׁבָּת"), "$aBaT");
});

test("Hebrew prefix variants strip single and stacked prefix letters only", () => {
  assert.deepEqual(hebrewPrefixVariants("האמת"), ["האמת", "אמת"]);
  assert.deepEqual(hebrewPrefixVariants("והאמת"), ["והאמת", "האמת", "אמת"]);
  assert.deepEqual(hebrewPrefixVariants("אמת"), ["אמת"]); // too short to strip
});

test("foldTokenRefined widens the Hebrew variant set with prefix-stripped forms", () => {
  const variants = foldTokenRefined("האמת");
  assert.ok(variants.includes("hʔMT"));
  assert.ok(variants.includes("ʔMT"));
});

test("refined similarity: vowel omission is cheap, vowel contradiction is not free", () => {
  // Omitting the vowel entirely costs less than contradicting it outright.
  assert.ok(refinedSimilarity("MT", "MaT") > refinedSimilarity("MaT", "MiT"));
  // A true consonant mismatch always costs more than a vowel mismatch.
  assert.ok(refinedSimilarity("MaT", "MiT") > refinedSimilarity("MaT", "GaT"));
});

test("refined similarity treats a consonant gap as expensive, unlike a vowel gap", () => {
  assert.ok(refinedSimilarity("MT", "MT") === 1);
  assert.ok(refinedSimilarity("MT", "MRT") < refinedSimilarity("MT", "MaT"));
});

test("engine: vowel-carrying query reorders within a tier without crossing it", () => {
  const idx = new ChipusIndex();
  idx.add([
    { id: "emet", text: "אמת" }, // ʔMT — exact vowel match for "emet"
    { id: "meat", text: "מעט" }, // MʔT — same coarse skeleton, wrong vowel slot
  ]);
  const res = idx.search("emet");
  assert.equal(res[0].doc.id, "emet");
  assert.ok(res[0].score > res[1].score);
  // Both still land in the EXACT tier — refine only reorders within it.
  assert.equal(res[0].matches[0].tier, res[1].matches[0].tier);
});

test("prefix-stripping widens ranking evidence only, never coarse recall", () => {
  const idx = new ChipusIndex();
  idx.add([{ id: "amar", text: "אמר" }]);
  // "veamar" has no coarse-key path to אמר other than v1's existing fuzzy
  // tolerance (BMR ~ MR, edit distance 1) — refined prefix variants must not
  // be why this is found, and must not turn it into a full-tier match.
  const res = idx.search("veamar");
  assert.equal(res.length, 1);
  assert.equal(res[0].matches[0].tier, 40); // FUZZY1, not EXACT/PREFIX
});
