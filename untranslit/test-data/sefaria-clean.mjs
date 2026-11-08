import fs from 'node:fs';
const { foldToken, foldHebrew } = await import('/Users/tamar/Documents/Projects/chipus/src/index.js');
const eng = new Set(fs.readFileSync('/usr/share/dict/words','utf8').toLowerCase().split('\n'));
const ed=(a,b)=>{const d=[...Array(b.length+1).keys()];for(let i=1;i<=a.length;i++){let p=d[0];d[0]=i;for(let j=1;j<=b.length;j++){const t=d[j];d[j]=Math.min(d[j]+1,d[j-1]+1,p+(a[i-1]===b[j-1]?0:1));p=t;}}return d[b.length];};
const { EVAL } = await import('/Users/tamar/Documents/Projects/chipus/untranslit/eval-set.js');
const seen=new Set(EVAL.flatMap(([l])=>l.toLowerCase().split(/\s+/)));
for (const l of fs.readFileSync('/Users/tamar/Documents/Projects/chipus/untranslit/overrides.tsv','utf8').split('\n')) if(l) seen.add(l.split('\t')[0].toLowerCase());
for (const src of ['topics','books']) {
  const all = JSON.parse(fs.readFileSync(`${process.argv[2]}/${src}.pairs.json`,'utf8'));
  const keep = all.filter(([l,h]) => !seen.has(l) && !/^[ivxlc]+$/.test(l) && !eng.has(l.replace(/(es|s)$/,'')) && !eng.has(l.replace(/s$/,''))
    && foldToken(l).some(k => ed(k, String(foldHebrew(h))) <= 1));
  fs.writeFileSync(`${process.argv[2]}/${src}.clean.json`, JSON.stringify(keep));
  console.log(src, all.length, '->', keep.length, keep.slice(0,400).filter((_, i) => i % 40 == 0).map(x=>x.join('=')).join(' '));
}
