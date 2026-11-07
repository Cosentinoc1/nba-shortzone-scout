import {test} from 'node:test';
import assert from 'node:assert/strict';
import {directionalEvidence} from '../lib/edge-v3.mjs';
const h={boxscoreGames:12,hitRates:{last10:{win:8,loss:2,push:0},season:{win:9,loss:3,push:1}},recent:[20,21,19,22,20,21,19,20,18,20].map(stat=>({stat}))};
const base={player:'Example',side:'MORE',stat:'PTS',line:17.5,margin:2.5,v2History:h,evidence:{opportunity:65}};
const model={matched:true,modelGap:3.2,minutesChangePct:2,unstableMinutes:false,historyOpposes:false};
test('Good independent projection and consistent historical direction receive distinct higher score',()=>{
 const watch=directionalEvidence(base),priority=directionalEvidence(base,{rotowire:model});
 assert.ok(priority.score>watch.score);
 assert.equal(priority.tier,'PRIORITY');
 assert.notEqual(watch.tier,'PRIORITY');
 assert.ok(priority.readiness.includes('FINAL VETO'));
});
test('Historical direction reversed degrades, no artificial positive pick',()=>{
 const opposing=directionalEvidence({...base,margin:-4},{rotowire:{...model,modelGap:-4}});
 assert.ok(opposing.score<45);
 assert.notEqual(opposing.tier,'PRIORITY');
});
test('Independent-model disagreement creates HOLD, not false certainty',()=>{
 const r=directionalEvidence(base,{rotowire:{...model,modelGap:-5}});
 assert.equal(r.tier,'CONFLICT');
 assert.ok(r.warnings.some(x=>x.includes('conflicts')));
});
test('Broad positional proxy cannot create a verified exact DvP grade',()=>{
 const x=directionalEvidence(base,{defenseGrade:{available:true,proxy:true,score:95}});
 const y=directionalEvidence(base,{defenseGrade:{available:true,proxy:false,score:95,lessScore:5,position:'PG',sample:22}});
 assert.equal(x.exactDefense,false);
 assert.equal(y.exactDefense,true);
 assert.ok(y.score>x.score);
});
test('No usable history stays neutral and independent projections do not generate guaranteed selections',()=>{
 const x=directionalEvidence({...base,v2History:{boxscoreGames:2},margin:12},{rotowire:model});
 assert.equal(x.score,50);
 assert.equal(x.tier,'NEUTRAL');
 assert.equal('winProbability' in x,false);
});
