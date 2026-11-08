import test from 'node:test';
import assert from 'node:assert/strict';
import {assessProp} from '../lib/decision-v25.mjs';
const NOW=Date.parse('2026-11-07T23:42:00Z');
const date=new Date(NOW-12*60_000).toISOString();
const recent=Array.from({length:10},(_,i)=>({stat:19.5+(i%3)*2,minutes:31+(i%3),fga:14+(i%3),fta:5+(i%2),tpa:6+(i%2),pts:19.5+(i%3)*2,reb:5+(i%2),ast:4+(i%2)}));
function row(extra={}){return {player:'Test Player',team:'OKC',opponent:'BKN',stat:'PTS',line:17.5,side:'MORE',state:'RESEARCH ONLY',hard:[],observedAt:date,lineupStatus:'confirmed',injuryStatus:'active',v2History:{boxscoreGames:14,recent}, ...extra};}
const rotowire={matched:true,projectedStat:24,projectedMinutes:32,projectedFGA:17,projectedFTA:5,projected3PA:6,modelGap:6.5,unstableMinutes:false,historyOpposes:false,minutesChangePct:1};
const d={available:true,proxy:false,score:78,lessScore:22,position:'SG',stat:'PTS',opponent:'BKN',components:[{stat:'PTS',rankMostAllowed:8,value:21}]};
const evaluate=(r=row(),o={})=>assessProp(r,{rotowire,defenseGrade:d,now:NOW,...o});

test('clear MORE candidate requires strong model + history, does not misstate hit probability',()=>{
 const z=evaluate();assert.equal(z.tier,'STRONG');assert.match(z.status,/STRONG MORE/);assert.equal(z.entryReady,false);assert.match(z.summary,/payout/);assert.equal(z.weights.projection,30);assert.equal(z.components.projection>50,true);assert.equal(z.helps.some(s=>s.includes('Defense matchup:')),true);
});
test('no invented bet ready just because an odds field exists',()=>{
 const z=evaluate(row(),{marketVerified:true});assert.equal(z.entryReady,false);assert.doesNotMatch(z.status,/BET-READY/);
});
test('BET-READY requires explicit vetted positive market edge, role, injury and model',()=>{
 const z=evaluate(row(),{marketVerified:true,marketEdgeVerified:true});assert.equal(z.entryReady,true);assert.match(z.status,/BET-READY/);
});
test('missing independent projection cannot get STRONG',()=>{
 const z=evaluate(row(),{rotowire:null});assert.notEqual(z.tier,'STRONG');assert.equal(z.entryReady,false);assert.match(z.checks.join(' '),/RotoWire/);
});
test('opposing model is a HOLD, regardless of high historical clearance',()=>{
 const z=evaluate(row(),{rotowire:{...rotowire,projectedStat:15,modelGap:-2.5}});assert.equal(z.tier,'HOLD');assert.match(z.blockers.join(' '),/projection opposes/);
});
test('opposite direction reverses defensive interpretation',()=>{
 const over=evaluate(row());const under=evaluate(row({side:'LESS'}));assert.equal(over.defense.score,78);assert.equal(under.defense.score,22);assert.equal(under.tier,'HOLD');assert.equal(over.components.defense>under.components.defense,true);
});
test('DVP eligibility estimate has reduced weight, and conflicting range blocks a strong grade',()=>{
 const uncertain={...d,proxy:true,positionCandidates:['PG','SG'],position:'PG/SG',range:{more:[16,82],less:[18,84]},score:50,lessScore:50};const z=evaluate(row(),{defenseGrade:uncertain});assert.equal(z.defense.estimated,true);assert.equal(z.defense.uncertain,true);assert.equal(z.tier,'HOLD');assert.ok(z.blockers.some(x=>/Multi-position/.test(x)));
});
test('unknown defense is neutral on score and in pending checks, not a fabricated good matchup',()=>{
 const z=evaluate(row(),{defenseGrade:null});assert.equal(z.defense.valid,false);assert.equal(z.components.defense,50);assert.ok(z.checks.some(x=>/DVP/i.test(x)));
});
test('unfavorable defense yields risk but cannot override a verified strong independent projection on its own',()=>{
 const z=evaluate(row(),{defenseGrade:{...d,score:27,lessScore:73}});assert.ok(z.hurts.some(x=>/Defense/.test(x)));assert.ok(z.score<evaluate().score);
});
test('very adverse exact DvP blocks green promotion',()=>{
 const z=evaluate(row(),{defenseGrade:{...d,score:15,lessScore:85}});assert.equal(z.tier,'HOLD');assert.ok(z.blockers.some(x=>/adverse/.test(x)));
});
test('pre-game line timestamp is mandatory for strong',()=>{
 const z=evaluate(row({observedAt:'2026-11-06T20:00:00Z'}));assert.notEqual(z.tier,'STRONG');assert.match(z.checks.join(' '),/two hours/);
});
test('out or doubtful players are always VETO',()=>{
 for (const injuryStatus of ['out','Doubtful','inactive']){const z=evaluate(row({injuryStatus}));assert.equal(z.tier,'VETO');}
});
test('questionable injury is a HOLD, never STRONG',()=>{
 const z=evaluate(row({injuryStatus:'Questionable'}));assert.equal(z.tier,'HOLD');assert.equal(z.entryReady,false);
});
test('no starting confirmation cannot become BET-READY even if a price edge is supplied',()=>{
 const z=evaluate(row({lineupStatus:'expected'}),{marketVerified:true,marketEdgeVerified:true});assert.equal(z.entryReady,false);
});
test('larger projected-minute shift is risk not unexplained bonus',()=>{
 const z=evaluate(row(),{rotowire:{...rotowire,projectedMinutes:20,minutesChangePct:-37}});assert.equal(z.tier,'HOLD');assert.ok(z.blockers.some(x=>/minutes change/.test(x)));
});
test('thin sample cannot be marked STRONG',()=>{
 const z=evaluate(row({v2History:{boxscoreGames:4,recent:recent.slice(0,4)}}));assert.ok(['HOLD','VETO','PASS'].includes(z.tier));assert.ok(z.score<=48);
});
test('combo opportunity uses component trends rather than pretending potential assists are tracked',()=>{
 const statRecent=recent.map((x,i)=>({...x,stat:x.pts+x.reb+x.ast}));const z=evaluate(row({stat:'PRA',line:25,v2History:{boxscoreGames:10,recent:statRecent}}),{rotowire:{...rotowire,projectedStat:36}});assert.ok(z.checks.some(x=>/Potential assists/.test(x)));assert.ok(z.signals.some(x=>/BOX-SCORE production proxy/.test(x.detail)));
});
test('malformed row rejected rather than given a grade',()=>{
 assert.throws(()=>assessProp(row({line:'oops'}),{now:NOW}),/valid MORE\/LESS/);
});
test('source and weight rationale exposed for each criterion',()=>{
 const z=evaluate();assert.equal(Object.values(z.weights).reduce((a,b)=>a+b,0),100);assert.equal(z.signals.some(x=>x.key==='projection'),true);assert.equal(z.signals.some(x=>x.key==='defense'),true);assert.match(z.method,/untrained heuristics/);
});
test('LESS can be STRONG when model and historical median both support under',()=>{
 const data=[14,15,16,13,15,14,16,13,14,15].map(v=>({stat:v,pts:v,minutes:25,fga:10,fta:3,tpa:4}));
 const z=evaluate(row({side:'LESS',line:18.5,v2History:{boxscoreGames:10,recent:data}}),{rotowire:{...rotowire,projectedStat:15,projectedMinutes:26},defenseGrade:{...d,score:20,lessScore:80}});
 assert.equal(z.tier,'STRONG');assert.match(z.status,/STRONG LESS/);assert.equal(z.defense.score,80);
});
test('wrong-opponent RotoWire match cannot become STRONG',()=>{
 const z=evaluate(row(),{rotowire:{...rotowire,matchupMismatch:true,matched:false}});
 assert.equal(z.tier,'HOLD');assert.ok(z.blockers.some(s=>/different opponent/.test(s)));
});
test('severely opposing attempt volume blocks a superficially strong MORE',()=>{
 const down=Array.from({length:10},(_,i)=>({stat:23,minutes:30,fga:i<5?9:20,fta:i<5?2:6,tpa:6,pts:23}));
 const z=evaluate(row({v2History:{boxscoreGames:10,recent:down}}));
 assert.equal(z.tier,'HOLD');assert.ok(z.blockers.some(x=>/volume trend/.test(x)));
});
test('volatile recent minutes are a clear hold, not a bonus from a high median',()=>{
 const volatile=recent.map((x,i)=>({...x,minutes:15+(i%2)*25}));
 const z=evaluate(row({v2History:{boxscoreGames:10,recent:volatile}}));
 assert.equal(z.tier,'HOLD');assert.ok(z.blockers.some(x=>/minutes distribution/.test(x)));
});

test('low-minute MORE is held rather than promoted on an attractive projection gap',()=>{
 const z=evaluate(row(),{rotowire:{...rotowire,projectedMinutes:22,projectedStat:26}});
 assert.equal(z.tier,'HOLD');assert.ok(z.score<=54);assert.ok(z.blockers.some(x=>/Low-minute MORE/.test(x)));
});
test('23-25-minute combo MORE is held without exceptional corroboration',()=>{
 const data=recent.map(x=>({...x,stat:x.pts+x.reb+x.ast}));
 const z=evaluate(row({stat:'PRA',line:25,v2History:{boxscoreGames:10,recent:data}}),{rotowire:{...rotowire,projectedMinutes:24,projectedStat:37}});
 assert.equal(z.tier,'HOLD');assert.ok(z.blockers.some(x=>/Fragile MORE/.test(x)));
});
test('LESS upper-tail breakout risk overrides a mildly favorable forecast',()=>{
 const vals=[13,14,15,16,15,14,31,30,32,29];
 const data=vals.map(v=>({stat:v,pts:v,minutes:31,fga:16,fta:4,tpa:5}));
 const z=evaluate(row({side:'LESS',line:19.5,v2History:{boxscoreGames:10,recent:data}}),{rotowire:{...rotowire,projectedStat:17,projectedMinutes:31},defenseGrade:{...d,score:20,lessScore:80}});
 assert.equal(z.tier,'HOLD');assert.equal(z.underFragile,true);assert.ok(z.score<=54);assert.ok(z.blockers.some(x=>/Fragile LESS/.test(x)));assert.ok(z.hurts.some(x=>/upper quartile/.test(x)));
});
test('missing lineup and official injury review cap grade even if signals look positive',()=>{
 const z=evaluate(row({lineupStatus:'expected',injuryStatus:null}));
 assert.ok(z.score<=62);assert.notEqual(z.tier,'STRONG');assert.equal(z.entryReady,false);
});
test('without a matched independent projection the research grade cannot masquerade as strong',()=>{
 const z=evaluate(row(),{rotowire:null});assert.ok(z.score<=57);assert.notEqual(z.tier,'STRONG');
});
test('LESS with stable distribution and volume can remain STRONG, not a universal under veto',()=>{
 const data=[14,15,16,13,15,14,16,13,14,15].map(v=>({stat:v,pts:v,minutes:25,fga:10,fta:3,tpa:4}));
 const z=evaluate(row({side:'LESS',line:18.5,v2History:{boxscoreGames:10,recent:data}}),{rotowire:{...rotowire,projectedStat:15,projectedMinutes:26},defenseGrade:{...d,score:20,lessScore:80}});
 assert.equal(z.tier,'STRONG');assert.equal(z.underFragile,false);
});
