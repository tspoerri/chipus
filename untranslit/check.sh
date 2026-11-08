#!/bin/sh
# check.sh - every score in one line: unit tests, eval (tuned), held-out own words (5 seeds), Sefaria
cd "$(dirname "$0")/.." || exit 1
f=$(node --no-warnings --test 'untranslit/*.test.js' 2>&1 | sed -n 's/^# fail //p')
e=$(node --no-warnings untranslit/eval.js 2>&1 | sed -n 's/.*TOTAL \([0-9/]*\).*/\1/p')
h=$(for s in 1 2 3 4 5; do node --no-warnings untranslit/holdout.js $s | sed -n 's/.*: \([0-9]*\)\/\([0-9]*\).*/\1 \2/p'; done | awk '{a+=$1;b+=$2} END{printf "%d/%d", a, b}')
x=$(node --no-warnings untranslit/sefaria-test.js | awk '{print $2}' | paste -sd' ' -)
echo "fail=$f eval=$e own-heldout=$h sefaria(topics books)=$x"
