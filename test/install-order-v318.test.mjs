import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('new release executes only the 3.18 incremental installer and serves quick UI',()=>{
 const pkg=JSON.parse(read('package.json'));assert.equal(pkg.version,'3.18.0');assert.equal(pkg.scripts.pretest,'python3 PATCH_SCOUT_318.py');
 assert.doesNotMatch(pkg.scripts.pretest,/PATCH_SCOUT_31[34567]/);
 for(const file of ['server.mjs','public/index.html','public/clean.js'])assert.match(read(file),/simple-dashboard-v318/);
 assert.match(read('public/index.html'),/Top 10 and every source check/);
 assert.match(read('server.mjs'),/historyAudit:auditPlayerHistory/);
});
