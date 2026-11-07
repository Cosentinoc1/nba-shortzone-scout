import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeRotoProjections,projectedValue,applyRotoProjections} from '../lib/rotowire.mjs';
const row=(name='Sample Player',team='DEN',minutes=34,pts=25)=>({NAME:name,Team:team,OPP:'IND',Pos:'G',MIN:minutes,PTS:pts,REB:6,AST:7,STL:1.4,BLK:.5,TO:2,FGM:10,FGA:20,'3PM':3,'3PA':8,FTM:3,FTA:4,OREB:2,DREB:4});
function candidate(side='MORE',overrides={}){return {player:'Sample Player',team:'DEN',opponent:'IND',stat:'PTS',line:21.5,side,margin:side==='MORE'?1.2:-1.2,observedAt:new Date().toISOString(),score:68,minutes:33,state:'RESEARCH ONLY',hard:[],sourceChecks:[{name:'Projected minutes',state:'pending',detail:'unavailable'},{name:'Stat-specific opportunity',state:'pending',detail:'unavailable'}],evidence:{baseline:61},defenseGrade:{available:true,score:70},...overrides};}
const board=()=>({date:'2026-11-07',candidates:[],topMore:[],topLess:[],all:[candidate('MORE'),candidate('LESS')],games:[],feed:{source:'test'}});
// RFPP 2.2 requires actual pregame box-score history before promoting a side.
// The old synthetic fixture lacked a historical sample but expected promotion;
// that was incompatible with the new confidence gate and encouraged bad picks.
const historicalRows=[23,25,24,26,24,22,23,21,20,23].map(pts=>({stat:pts,pts,minutes:33,fga:16,fta:4,reb:6,ast:7,tpa:8}));
const realHistory={boxscoreGames:10,projectedBaseline:23,recent:historicalRows,opportunity:{minutesL5:33,minutesL10:33},hitRates:{last10:{sample:10,win:8,loss:2,push:0},season:{sample:10,win:8,loss:2,push:0}}};
test('Parses RotoWire forecast columns without rounding away minutes or attempts',()=>{
 const parsed=normalizeRotoProjections([row()]);assert.equal(parsed.length,1);assert.equal(parsed[0].MIN,34);assert.equal(parsed[0].FGA,20);
 assert.equal(projectedValue(parsed[0],'PRA'),38);assert.equal(projectedValue(parsed[0],'PA'),32);assert.equal(projectedValue(parsed[0],'2PM'),7);
});
test('A same-day independent projection plus real historical evidence promotes only matching side',()=>{
 const b=board();b.all[0]=candidate('MORE',{v2History:realHistory});
 const result=applyRotoProjections(b,[row()],'2026-11-07',{uploadedAt:'2026-11-07T15:00:00Z'});
 assert.equal(result.topMore.length,1);assert.equal(result.topLess.length,0);
 assert.equal(result.candidates.length,1);assert.equal(result.topMore[0].rotowire.projectedMinutes,34);
 assert.equal(result.topMore[0].rotowire.modelGap,3.5);
 assert.equal(result.topMore[0].sourceChecks.find(x=>x.name==='RotoWire projected minutes').state,'observed');
 assert.match(result.topMore[0].lean,/(PRIORITY|PROMISING) MORE/);
 assert.ok(result.topMore[0].edge.hasModel);
});
test('RotoWire projection without a usable historical sample must NOT be promoted',()=>{
 const result=applyRotoProjections(board(),[row()],'2026-11-07');
 assert.equal(result.topMore.length,0);assert.equal(result.topLess.length,0);
 assert.equal(result.all.find(x=>x.side==='MORE').edge.tier,'NEUTRAL');
});
test('Zero projected minutes are a hard research veto, not called confirmed DNP',()=>{
 const forecast=row('Sample Player','DEN',0,0);forecast.FGA=forecast.FGM=forecast['3PA']=forecast['3PM']=forecast.FTA=forecast.FTM=0;
 const result=applyRotoProjections(board(),[forecast],'2026-11-07');
 assert.equal(result.topMore.length,0);assert.equal(result.topLess.length,0);
 assert.equal(result.all[0].state,'PASS');assert.match(result.all[0].hard.join(' '),/not a confirmed DNP/);
});
test('Projection-history disagreement triggers HOLD and no promotion',()=>{
 const b=board();b.all=[candidate('MORE',{margin:-7,score:80}),candidate('LESS',{margin:7,score:80})];
 const result=applyRotoProjections(b,[row()],'2026-11-07');
 assert.equal(result.topMore.length,0);assert.match(result.all.find(x=>x.side==='MORE').lean,/HOLD/);
});
test('Unknown player cannot gain projection support from a different team',()=>{
 const result=applyRotoProjections(board(),[row('Sample Player','NYK')],'2026-11-07');
 assert.equal(result.topMore.length,0);assert.equal(result.rotowireStatus.directionsMatched,0);
});
test('Invalid projection rows and enormous batches are rejected',()=>{
 assert.equal(normalizeRotoProjections([{NAME:'X',Team:'DEN',MIN:-3}]).length,0);
 assert.throws(()=>normalizeRotoProjections(Array.from({length:501},()=>row())),/500/);
});
