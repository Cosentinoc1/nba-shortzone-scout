import test from 'node:test';import assert from 'node:assert/strict';
import {applyVerification} from '../lib/decision.mjs';
const make=(player,side='MORE')=>({player,playerId:player,team:'DEN',opponent:'IND',stat:'PTS',line:10,side,score:68,margin:4,hit10:{sample:8,win:7,push:0,loss:1},minutes:32,observedAt:new Date().toISOString(),hard:[],evidence:{baseline:85,hitHistory:77,opportunity:52,confidence:70,consistency:72,minutesTrend:1,opportunityMeasured:true},checks:[],reasons:[]});
test('Never calls an EXPECTED RotoWire lineup confirmed and injuries veto regardless score',()=>{
 const input={all:[make('Nikola Jokic'),make('Jamal Murray')],boardCount:2,games:[{away:'DEN',home:'IND',odds:{total:224,spreadText:'DEN -5.5'}}]};
 const out=applyVerification({board:input,context:{injuriesFetched:true,injuries:[{team:'DEN',player:'Nikola Jokic',status:'Out',updatedAt:new Date().toISOString()}],lineupsFetched:true,lineups:{DEN:{status:'expected',players:[{name:'Jamal Murray',pos:'PG'}]}}},rosters:{DEN:[{name:'Nikola Jokic',id:'Nikola Jokic',pos:'C'},{name:'Jamal Murray',id:'Jamal Murray',pos:'G'}]},day:'2026-11-07',limit:10});
 const a=out.all.find(x=>x.player==='Nikola Jokic'),b=out.all.find(x=>x.player==='Jamal Murray');
 assert.equal(a.state,'PASS');assert.equal(b.lineupStatus,'expected');assert.equal(b.sourceChecks.find(c=>c.name==='Starter status').state,'expected');assert.equal(out.topMore.some(x=>x.player==='Nikola Jokic'),false);
});
test('Top 10 split and sorted board retain every scored direction',()=>{const board={all:Array.from({length:12},(_,i)=>make(`Player ${i}`)),games:[]};const out=applyVerification({board,day:'2026-11-07',rosters:{DEN:[]},limit:10});assert.equal(out.topMore.length,10);assert.equal(out.all.length,12);assert.ok(out.all.every(x=>x.grade&&x.sourceChecks.length>=10));});
