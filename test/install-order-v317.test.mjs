import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('v3.17 deploy runs only current incremental patch and not completed 3.14/3.15 migrations',()=>{
 const pkg=JSON.parse(read('package.json'));
 assert.equal(pkg.version,'3.18.0');
 assert.equal(pkg.scripts.pretest,'python3 PATCH_SCOUT_318.py');
 assert.doesNotMatch(pkg.scripts.pretest,/PATCH_SCOUT_314|PATCH_SCOUT_315|PATCH_SCOUT_316/);
 assert.match(read('PATCH_SCOUT_317.py'),/version:'3\.15\.0'/);
 assert.match(read('PATCH_SCOUT_317.py'),/version:'3\.17\.0'/);
});
