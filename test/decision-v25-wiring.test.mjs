import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('strict final veto 2.6 remains connected to live board and RotoWire import',()=>{
 const board=read('lib/decision.mjs'),rw=read('lib/rotowire.mjs');
 for(const src of [board,rw])assert.match(src,/import \{assessProp\} from '\.\/decision-v25\.mjs'/);
 assert.match(board,/recommendation=assessProp/);
});
test('signal rank is separate from final wager approval and is surfaced on both Top 10 and Grade Board',()=>{
 const board=read('lib/decision.mjs'),ui=read('public/clean.js');
 assert.match(board,/import \{rankResearchProp\}/);assert.match(board,/researchRank:rankResearchProp/);
 assert.match(board,/researchRank\?\.eligible/);assert.match(ui,/c\.researchRank\?\.eligible/);
 assert.match(ui,/PRIORITY/);assert.match(ui,/WATCH/);
 assert.match(ui,/Final veto:/);assert.match(ui,/NOT WIN %/);
});
test('sourced explanation and backtest are visible',()=>{
 const page=read('public/review.html'),ui=read('public/clean.js');
 assert.match(page,/SIGNALS & GRADING FEEDBACK/);
 assert.match(ui,/WHY THIS SIDE/);assert.match(ui,/Still pending/);
 assert.match(read('scripts/update-review.mjs'),/sourceFresh/);
});
test('site identifies RFPP research v2.7 without claiming automatic betting',()=>{
 assert.match(read('server.mjs'),/version:'2\.7\.1'/);
 assert.match(read('server.mjs'),/\/review\/history\.json/);
 assert.match(read('server.mjs'),/application\/json/);
 assert.match(read('lib/decision.mjs'),/2\.7-signal-ranked-research-final-veto-preserved/);
 assert.equal(JSON.parse(read('package.json')).version,'2.7.1');
});
