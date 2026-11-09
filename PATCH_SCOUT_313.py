#!/usr/bin/env python3
"""NBA Scout v3.13: correct stale version assertions from GitHub Actions run #29.
Run after v3.11 and v3.12 patches. Safe to repeat.
"""
from pathlib import Path
ROOT=Path(__file__).resolve().parent

def patch(rel, old, new):
    p=ROOT/rel
    if not p.is_file():
        raise RuntimeError(f'Expected existing file missing: {rel}')
    data=p.read_text(encoding='utf8')
    if new in data:
        print(f'{rel}: already patched')
        return
    count=data.count(old)
    if count != 1:
        raise RuntimeError(f'{rel}: expected one old version anchor, found {count}: {old}')
    p.write_text(data.replace(old, new, 1),encoding='utf8')
    print(f'{rel}: updated for v3.13')

patch('server.mjs',
    "version:'3.12.0',dataQuality:checkDataQuality(",
    "version:'3.13.0',dataQuality:checkDataQuality(")
patch('test/decision-v25-wiring.test.mjs',
    r"assert.match(read('server.mjs'),/version:'2\.7\.1'/);",
    r"assert.match(read('server.mjs'),/version:'3\.13\.0'/);")
patch('test/decision-v25-wiring.test.mjs',
    "assert.equal(JSON.parse(read('package.json')).version,'2.7.1');",
    "assert.equal(JSON.parse(read('package.json')).version,'3.13.0');")
print('NBA Scout v3.13 regression-test repair complete.')
