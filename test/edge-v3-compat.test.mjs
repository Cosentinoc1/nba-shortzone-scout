import {test} from 'node:test';import assert from 'node:assert/strict';
import {enhancedEvidence} from '../lib/edge-v4.mjs';
const row=(side, margin)=>({player:'Sample Player',team:'DEN',opponent:'IND',stat:'PTS',line:21.5,side,margin,score:68,minutes:33,defenseGrade:{available:true,score:70},evidence:{baseline:61}});
const projected={matched:true,projectedMinutes:34,modelGap:3.5,minutesChangePct:3,unstableMinutes:false,historyOpposes:false};
test('A partial DvP stub without position or lessScore cannot crash rounding',()=>{
 const x=enhancedEvidence(row('MORE',1.2),{defenseGrade:{available:true,score:70},rotowire:projected});
 assert.ok(Number.isFinite(x.score));assert.equal(x.exactDefense,false);
});
test('Invalid DvP data never appears to be exact, even when available=true',()=>{
 const x=enhancedEvidence(row('LESS',-1.2),{defenseGrade:{available:true,proxy:false,position:'PG',score:undefined,lessScore:undefined},rotowire:projected});
 assert.equal(x.exactDefense,false);assert.ok(Number.isFinite(x.score));
});
test('Real exact DvP is still used',()=>{
 const x=enhancedEvidence(row('MORE',1.2),{defenseGrade:{available:true,proxy:false,position:'PG',score:70,lessScore:30,sample:28},rotowire:projected});
 assert.equal(x.exactDefense,true);assert.ok(Number.isFinite(x.score));
});
