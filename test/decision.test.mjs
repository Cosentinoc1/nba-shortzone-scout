import test from 'node:test';import assert from 'node:assert/strict';
import {applyVerification} from '../lib/decision.mjs';
const recent=Array.from({length:10},(_,i)=>({stat:18+i%3,pts:18+i%3,reb:5,ast:4,minutes:31+i%2,fga:i<5?14:12,fta:3,tpa:5}));
const make=(player,side='MORE')=>({player,playerId:player,team:'DEN',opponent:'IND',stat:'PTS',line:15.5,side,score:68,margin:4,hit10:{sample:10,win:9,push:0,loss:1},minutes:32,observedAt:new Date().toISOString(),hard:[],v2History:{boxscoreGames:12,recent,projectedBaseline:19,opportunity:{minutesL5:31.4,minutesL10:31.5},hitRates:{last10:{win:10,loss:0,push:0}}},evidence:{baseline:85,hitHistory:77,opportunity:62,confidence:70,consistency:72,minutesTrend:1,opportunityMeasured:true},checks:[],reasons:[]});
test('injury OUT remains vetoed even when research opportunity looks favorable',()=>{
 const input={all:[make('Nikola Jokic'),make('Jamal Murray')],boardCount:2,games:[{away:'DEN',home:'IND',odds:{total:224,spreadText:'DEN -5.5'}}]};
 const out=applyVerification({board:input,context:{injuriesFetched:true,injuries:[{team:'DEN',player:'Nikola Jokic',status:'Out',updatedAt:new Date().toISOString()}],lineupsFetched:true,lineups:{DEN:{status:'expected',players:[{name:'Jamal Murray',pos:'PG'}]}}},rosters:{DEN:[{name:'Nikola Jokic',id:'Nikola Jokic',pos:'C'},{name:'Jamal Murray',id:'Jamal Murray',pos:'G'}]},day:'2026-11-07',limit:10});
 const a=out.all.find(x=>x.player==='Nikola Jokic'),b=out.all.find(x=>x.player==='Jamal Murray');
 assert.equal(a.state,'PASS');assert.equal(b.lineupStatus,'expected');assert.equal(b.sourceChecks.find(c=>c.name==='Starter status').state,'expected');assert.equal(out.topMore.some(x=>x.player==='Nikola Jokic'),false);
});
test('Top 10 uses source-qualified history and may contain more research leans without RotoWire',()=>{
 const board={all:Array.from({length:12},(_,i)=>make(`Player ${i}`)),games:[]};
 const out=applyVerification({board,day:'2026-11-07',rosters:{DEN:[]},limit:10});
 assert.equal(out.all.length,12);assert.equal(out.topMore.length,10);
 assert.ok(out.topMore.every(x=>x.researchRank.eligible));
 assert.ok(out.all.every(x=>x.grade&&x.sourceChecks.length>=10));
 assert.ok(out.topMore.every(x=>x.recommendation.entryReady===false));
});
test('No historical observations means no fabricated research leans',()=>{
 const board={all:[{...make('Player Thin'),v2History:{boxscoreGames:0,recent:[]}}],games:[]};
 const out=applyVerification({board,day:'2026-11-07',rosters:{DEN:[]}});
 assert.equal(out.topMore.length,0);
});
