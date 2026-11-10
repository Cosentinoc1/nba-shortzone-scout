import test from 'node:test';import assert from 'node:assert/strict';
import {normalizeRotoProjections,projectedValue} from '../lib/rotowire.mjs';
test('missing OPTIONAL RotoWire fields do not erase a valid minutes and points projection',()=>{
 const rows=normalizeRotoProjections([{NAME:'Example Player',Team:'NY',OPP:'MIL',MIN:34,PTS:24,REB:5,AST:7,FGA:17,'3PA':6,FTA:'',STL:'',BLK:'',TO:'',FGM:'','3PM':'',FTM:'',OREB:'',DREB:''}]);
 assert.equal(rows.length,1);assert.equal(rows[0].team,'NYK');assert.equal(rows[0].MIN,34);assert.equal(projectedValue(rows[0],'PRA'),36);
 assert.equal(projectedValue(rows[0],'3PM'),null);assert.equal(projectedValue(rows[0],'2PM'),null);assert.equal(rows[0].FTA,null);
});
test('missing essential minute and attempt fields never become fabricated zeroes',()=>{
 const bad=normalizeRotoProjections([{NAME:'Example Player',Team:'NY',MIN:'',PTS:24,REB:5,AST:7,FGA:17,'3PA':6}]);
 assert.equal(bad.length,0);
});
