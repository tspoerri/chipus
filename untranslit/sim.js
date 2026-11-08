/* sim.js - similarity between two Hebrew spellings (final forms normalized;
 * matres lectionis cheap to add/drop; look-alike letters cheap to swap). */
const FINALS = { 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' };
export const norm = (s) => s.replace(/[ךםןףץ]/g, (c) => FINALS[c]).replace(/[^א-ת]/g, '');
const CHEAP_INDEL = new Set(['ו', 'י', 'א', 'ה', 'ע']);
const PAIRS = {
  'כק': 0.25, 'תט': 0.2, 'סש': 0.4, 'אע': 0.2, 'סת': 0.5, 'חכ': 0.5, 'וי': 0.6,
  'בו': 0.7, 'בפ': 0.7, 'סצ': 0.6, 'זס': 0.6, 'אה': 0.5, 'אי': 0.6, 'גק': 0.7,
};
const MATRES = 'ויאהע';
const STRICT_OK = new Set(['כק', 'קכ', 'תט', 'טת', 'אע', 'עא', 'סש', 'שס']);
const pairCost = (a, b, strict) => strict ? (a === b ? 0 : STRICT_OK.has(a + b) ? 0.3 : 1) :  (a === b ? 0 : MATRES.includes(a) && MATRES.includes(b) && !PAIRS[a + b] && !PAIRS[b + a] ? 0.55 : PAIRS[a + b] ?? PAIRS[b + a] ?? 1);
// position-aware: a letter at the start of a word always matters; vowel letters elsewhere are cheap
const indel = (c, i, len) => (CHEAP_INDEL.has(c) && i > 0 ? (i === len - 1 ? 0.55 : 0.4) : 1);

export function hebDistance(a, b, strict = false) {
  a = norm(a); b = norm(b);
  const n = a.length, m = b.length;
  let prev = [0];
  for (let j = 1; j <= m; j++) prev[j] = prev[j - 1] + indel(b[j - 1], j - 1, m);
  for (let i = 1; i <= n; i++) {
    const cur = [prev[0] + indel(a[i - 1], i - 1, n)];
    for (let j = 1; j <= m; j++) {
      const da = indel(a[i - 1], i - 1, n), db = indel(b[j - 1], j - 1, m);
      cur[j] = Math.min(prev[j] + da, cur[j - 1] + db, prev[j - 1] + Math.min(pairCost(a[i - 1], b[j - 1], strict), da + db));
    }
    prev = cur;
  }
  return prev[m];
}
export function hebSim(a, b, strict = false) {
  const L = Math.max(norm(a).length, norm(b).length);
  return L ? Math.max(0, 1 - hebDistance(a, b, strict) / L) : 1;
}
