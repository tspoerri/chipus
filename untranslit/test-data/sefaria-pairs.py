import json,re,random,sys
eng=set(w.strip().lower() for w in open('/usr/share/dict/words'))
nik=re.compile('[֑-ׇ]')
def words(en,he):
    en=re.sub(r"[’'`]","",en); E=re.findall(r"[A-Za-z]+",en)
    he=nik.sub('',he).replace('־',' '); H=[h for h in re.findall(r"[א-ת׳״\"']+",he)]
    H=[h.replace('"','״').replace("'",'׳') for h in H]
    if len(E)!=len(H): return []
    return [(e.lower(),h) for e,h in zip(E,H) if len(e)>=3 and e.lower() not in eng and re.fullmatch('[א-ת]+',h)]
src={}
for t in json.load(open('topics.json')):
    en=(t.get('primaryTitle') or {}).get('en') or t.get('en'); he=(t.get('primaryTitle') or {}).get('he') or t.get('he')
    if en and he: 
        for p in words(en,he): src.setdefault('topics',{}).setdefault(p[0],p[1])
def walk(n):
    if isinstance(n,dict):
        if n.get('title') and n.get('heTitle'):
            for p in words(n['title'],n['heTitle']): src.setdefault('books',{}).setdefault(p[0],p[1])
        if n.get('category') and n.get('heCategory'):
            for p in words(n['category'],n['heCategory']): src.setdefault('books',{}).setdefault(p[0],p[1])
        for v in n.values(): walk(v)
    elif isinstance(n,list):
        for v in n: walk(v)
walk(json.load(open('index.json')))
for k,d in src.items():
    print(k,len(d)); json.dump(sorted(d.items()),open(k+'.pairs.json','w'),ensure_ascii=False)
    print(' ', random.Random(1).sample(sorted(d.items()),12))
