import test from 'node:test';import assert from 'node:assert/strict';
import {enhancedEvidence} from '../lib/edge-v4.mjs';
const recent=Array.from({length:10},(_,i)=>{
 const pts=i<5?20:15,reb=i<5?7:4,ast=i<5?6:3;
 return {stat:pts+reb+ast,pts,reb,ast,minutes:33,fga:i<5?17:12,fta:4,tpa:5};
});
const baseline={side:'MORE',stat:'PRA',line:27.5,margin:4.5,hit10:{sample:10,win:8,loss:2,push:0},evidence:{opportunity:60},v2History:{boxscoreGames:10,recent,hitRates:{last10:{win:8,loss:2,push:0},season:{win:8,loss:2,push:0}}}};
const roto={matched:true,modelGap:6,projectedMinutes:33,minutesChangePct:0,unstableMinutes:false,historyOpposes:false};
test('Additional evidence is traceable, combo trend positive, no win probability',()=>{
 const x=enhancedEvidence(baseline,{rotowire:roto,defenseGrade:{available:true,proxy:false,score:75,lessScore:25,position:'PG',sample:50}});
 assert.ok(x.score>60);assert.equal(x.componentSupport.supported,3);assert.ok(x.additionalReasons.some(t=>t.includes('Needed')));
 assert.ok(!('winProbability' in x));assert.ok(!('expectedValue' in x));
});
test('Reverse direction loses positive evidence, no automatic priority',()=>{
 const plus=enhancedEvidence(baseline,{rotowire:roto});
 const minus=enhancedEvidence({...baseline,side:'LESS',margin:-4.5,hit10:{sample:10,win:2,loss:8,push:0},v2History:{...baseline.v2History,hitRates:{last10:{win:2,loss:8,push:0}}}},{rotowire:{...roto,modelGap:-6}});
 assert.ok(plus.score>minus.score);assert.notEqual(minus.tier,'PRIORITY');
});
test('Large spread, second night, unstable minutes lower confidence',()=>{
 const a=enhancedEvidence(baseline,{rotowire:roto});const b=enhancedEvidence(baseline,{rotowire:roto,rest:{secondNight:true},latestOdds:{spreadText:'ATL -15.5'}});
 assert.ok(a.score>b.score);assert.ok(b.warnings.some(x=>x.includes('back-to-back')));
});
test('Absent RotoWire leaves a visible gate and cannot qualify for model priority',()=>{
 const x=enhancedEvidence(baseline);
 assert.equal(x.hasModel,false);assert.notEqual(x.tier,'PRIORITY');assert.match(x.readiness,/RotoWire/);
});
test('Small game sample remains neutral rather than creating false confidence',()=>{
 const x=enhancedEvidence({...baseline,margin:20,v2History:{...baseline.v2History,boxscoreGames:3,recent:recent.slice(0,3)}});
 assert.equal(x.tier==='PRIORITY',false);assert.ok(Math.abs(x.score-50)<15);
});
