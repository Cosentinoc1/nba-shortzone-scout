import test from 'node:test';import assert from 'node:assert/strict';
import {directionalEvidence} from '../lib/edge-v3.mjs';
const recent=Array.from({length:10},(_,i)=>({stat:i%2?23:24}));
const r={side:'MORE',line:20.5,margin:3,stat:'PTS',v2History:{boxscoreGames:10,recent,hitRates:{last10:{win:8,loss:2},season:{win:8,loss:2}}},evidence:{opportunity:55}};
const proxy={available:true,proxy:true,positionCandidates:['PG','SG'],position:'PG/SG',score:90,lessScore:10};
const exact={available:true,proxy:false,position:'PG',score:90,lessScore:10};
test('Published eligibility defensively contributes SMALL positive evidence but not exact source',()=>{
 const a=directionalEvidence(r),b=directionalEvidence(r,{defenseGrade:proxy}),c=directionalEvidence(r,{defenseGrade:exact});
 assert.ok(b.score>a.score);assert.ok(c.score>b.score);
 assert.equal(b.exactDefense,false);assert.match(b.warnings.join(' '),/position unconfirmed/);
 assert.ok(b.components.eligibilityDvp>0);assert.equal(b.components.exactDvp,0);
});
test('LESS eligibility reverses score direction and fake broad position cannot add score',()=>{
 const base=directionalEvidence({...r,side:'LESS'},{defenseGrade:proxy});
 assert.ok(base.components.eligibilityDvp<0);
 const fake=directionalEvidence(r,{defenseGrade:{available:true,proxy:true,score:95,lessScore:5,position:'G'}});
 assert.equal(fake.components.eligibilityDvp,0);
});
