#!/usr/bin/env python3
"""NBA Scout RFPP 2.6 patch for the existing v2.5 GitHub Auto-Update job.
The ZIP replaces the tested scoring module and tests before this script runs.
Never overwrites production history; no tokens, sportsbook calls or actions.
"""
from pathlib import Path
import json, subprocess
ROOT=Path(__file__).resolve().parent

def replace(file,old,new):
    p=ROOT/file
    if not p.is_file(): raise RuntimeError(f'Missing expected existing site file: {file}')
    source=p.read_text(encoding='utf-8')
    if new in source and old not in source:
        print(f'{file}: already upgraded'); return
    if source.count(old)!=1: raise RuntimeError(f'{file}: source revision mismatch; expected anchor once ({source.count(old)}): {old[:90]}')
    p.write_text(source.replace(old,new,1),encoding='utf-8')
    print(f'Updated {file}')

# The scoring module and tests have already been extracted from the ZIP.
assert 'RFPP 2.6' in (ROOT/'lib/decision-v25.mjs').read_text(), 'Missing upgraded decision engine'
replace('server.mjs',"version:'2.5.0'","version:'2.6.0'")
replace('lib/decision.mjs',"scoringVersion:'2.5-explainable-directional-research'","scoringVersion:'2.6-tail-and-minute-guarded-research'")
# Keep HTML/cache-bust assets and direction labels synchronized with API version.
for filename in ['public/clean.js','public/insight-ui.js','public/index.html']:
    p=ROOT/filename
    if not p.exists(): raise RuntimeError(f'Expected dashboard file missing: {filename}')
    current=p.read_text(encoding='utf-8')
    updated=current.replace('RFPP 2.5','RFPP 2.6').replace('NBA Scout v2.5','NBA Scout v2.6').replace('RFPP 2.5 SCORE','RFPP 2.6 SCORE')
    if filename=='public/index.html':
        updated=updated.replace('?v=2.5','?v=2.6')
    if updated!=current:
        p.write_text(updated,encoding='utf-8')
        print(f'Updated labels/cache keys: {filename}')
p=ROOT/'package.json'
d=json.loads(p.read_text());d['version']='2.6.0';p.write_text(json.dumps(d,indent=2)+'\n',encoding='utf-8')
for name in ['lib/decision-v25.mjs','lib/decision.mjs','lib/rotowire.mjs','server.mjs','public/clean.js','public/insight-ui.js']:
    subprocess.run(['node','--check',str(ROOT/name)],check=True)
print('RFPP 2.6: syntax checked; run npm test before committing site changes.')
