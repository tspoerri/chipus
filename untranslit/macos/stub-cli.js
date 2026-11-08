// Test stub: uppercases stdin. Never used in the installed workflow.
let s = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', c => (s += c));
process.stdin.on('end', () => process.stdout.write(s.toUpperCase()));
