import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('Server can actually deliver the shared browser module',async()=>{
 const code=await read('server.mjs');
 assert.match(code,/['"]\/defense-ui\.mjs['"]\s*:\s*['"]defense-ui\.mjs['"]/);
});
test('Top 10 cards orient the grade to their own MORE or LESS selection',async()=>{
 const code=await read('public/clean.js');
 assert.match(code,/defenseView\(match,c\.side\)/);
 assert.match(code,/DEFENSE MATCHUP FOR \$\{esc\(defView\.side\)\}/);
 assert.match(code,/esc\(defView\.letter\)/);
});
test('Full source report uses selected direction, not unconditional MORE grade',async()=>{
 const code=await read('public/insight-ui.js');
 assert.match(code,/chosenSide=selected\?\.side==='LESS'\?'LESS'/);
 assert.match(code,/defenseView\(matchup,chosenSide\)/);
 assert.match(code,/GRADE FOR \$\{esc\(defView\.side\)\}/);
 assert.doesNotMatch(code,/\$\{matchup\?\.available\?esc\(matchup\.grade\)/);
});
test('Grade board sorts using displayed direction-specific matchup score',async()=>{
 const code=await read('public/clean.js');
 assert.match(code,/defense:defenseView\(x\.defenseGrade,x\.side\)\.score\?\?-1/);
});
test('Frontend help distinguishes matchup grades from win chance',async()=>{
 const code=await read('public/index.html');
 assert.match(code,/How to read these picks and defensive grades/);
 assert.match(code,/not a predicted win %/);
});
