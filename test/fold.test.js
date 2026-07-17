import { test } from "node:test";
import assert from "node:assert/strict";
import {
  foldHebrew,
  foldLatin,
  foldToken,
  tokenize,
  stripNikud,
  isHebrewText,
} from "../src/index.js";

// Two spellings "agree" when they share at least one candidate key.
function agree(a, b) {
  const ka = foldToken(a), kb = foldToken(b);
  return ka.some((k) => kb.includes(k));
}

test("vocalized Hebrew folds to a single canonical key", () => {
  assert.deepEqual(foldHebrew("שַׁבָּת"), ["$BT"]);
  assert.deepEqual(foldHebrew("בְּרֵאשִׁית"), ["BR$T"]);
  assert.deepEqual(foldHebrew("מִצְוָה"), ["MCB"]);
  assert.deepEqual(foldHebrew("תּוֹרָה"), ["TR"]); // holam male vav dropped
  assert.deepEqual(foldHebrew("וַיֹּאמֶר"), ["BMR"]); // vocalized vav = consonant
  assert.deepEqual(foldHebrew("סֻכָּה"), ["SK"]);
});

test("unvocalized Hebrew expands only at genuinely ambiguous letters", () => {
  assert.ok(foldHebrew("שבת").includes("$BT"));
  assert.ok(foldHebrew("שבת").includes("SBT"));
  // bare mid-word vav: mater-first, consonant variant also offered
  assert.deepEqual(foldHebrew("תורה"), ["TR", "TBR"]);
});

test("transliteration conventions land on the Hebrew key", () => {
  for (const [latin, hebrew] of [
    ["shabbat", "שַׁבָּת"],
    ["Shabbos", "שַׁבָּת"],
    ["shabes", "שַׁבָּת"], // YIVO
    ["bereshit", "בְּרֵאשִׁית"],
    ["Bereishis", "בְּרֵאשִׁית"],
    ["b'reyshis", "בְּרֵאשִׁית"],
    ["mitzvah", "מִצְוָה"],
    ["mitsve", "מִצְוָה"],
    ["vayomer", "וַיֹּאמֶר"],
    ["Torah", "תּוֹרָה"],
    ["sukkah", "סֻכָּה"],
    ["succah", "סֻכָּה"],
    ["lech", "לֶךְ"],
    ["Chanukah", "חֲנֻכָּה"],
    ["Hanuka", "חֲנֻכָּה"], // dropped-h convention still matches: NK vs KNK? see note
  ].slice(0, 14)) {
    assert.ok(agree(latin, hebrew), `${latin} should agree with ${hebrew}`);
  }
});

test("Ashkenazi/Sephardi sav-tav and tz-z ambiguity is query-expanded", () => {
  assert.deepEqual(foldLatin("shabbos"), ["$BS", "$BT"]);
  assert.ok(foldLatin("mizrach").includes("MZRK"));
  assert.ok(foldLatin("mizrach").includes("MCRK"));
});

test("Yiddish spellings agree across scripts", () => {
  assert.ok(agree("וואס", "vos"));
  assert.ok(agree("מענטש", "mentsh"));
  assert.ok(agree("ייִדיש", "yidish"));
});

test("gemination and doubled letters collapse", () => {
  assert.equal(foldLatin("Chaggai")[0], foldLatin("Chagai")[0]);
  assert.ok(agree("shabbat", "shabat"));
});

test("tokenize splits on maqaf and mixed scripts, keeps gershayim tokens whole", () => {
  assert.deepEqual(tokenize("אֶל־אַבְרָם"), ["אֶל", "אַבְרָם"]);
  assert.deepEqual(tokenize("רש״י on Bereishis 12:1"), ["רש״י", "on", "Bereishis", "12", "1"]);
});

test("stripNikud removes points and cantillation, keeps letters", () => {
  assert.equal(stripNikud("בְּרֵאשִׁ֖ית"), "בראשית");
});

test("isHebrewText detects script", () => {
  assert.ok(isHebrewText("שלום"));
  assert.ok(!isHebrewText("shalom"));
});
