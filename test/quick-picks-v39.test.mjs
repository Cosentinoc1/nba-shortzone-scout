import test from 'node:test';
import assert from 'node:assert/strict';
import {explainQuickPick,enrichBoardQuickReads} from '../lib/quick-pick-explainer.mjs';
const now=Date.parse('2026-11-09T16:00:00Z');
const games=[{away:'LAL',home:'ATL',tipoff:'2026-11-10T00:00:00Z',state:'pre',completed:false}];
const base={player:'Example Guard',playerId:'100',team:'LAL',opponent:'ATL',stat:'PTS',side:'MORE',line:20.5,
 observedAt:'2026-11-09T15:30:00Z',minutes:31,lineupStatus:'unverified',hard:[],state:'RESEARCH ONLY',
 researchRank:{score:69,tier:'LEAN'},hit10:{sample:10,win:7,loss:2,push:1},
 v2History:{boxscoreGames:10,hitRates:{last10:{sample:10,win:7,loss:2,push:1},last5:{sample:5,win:4,loss:1,push:0},season:{sample:10,win:7,loss:2,push:1}},opportunity:{fgaL5:17,fgaL10:14,minutesL5:31,minutesL10:28,tpaL5:6,tpaL10:4}}};
const zone={player:'Example Guard',team:'LAL',opponent:'ATL',threeShare:.45,topZone:'above',topZoneName:'Above-break 3',topZonePlayerFgaPerGame:5.0,topZoneVolumeDeltaPP:2.4,topZoneFgDeltaPP:3.5,threePAperGame:6.3,top3ZoneName:'Above-break 3',top3ZoneFgaPerGame:5,top3ZoneVolumeDeltaPP:2.4,top3ZoneFgDeltaPP:3.5};
const rosters={LAL:[{id:'100',name:'Example Guard',pos:'PG'},{id:'101',name:'Teammate Guard',pos:'SG'},{id:'102',name:'Teammate Center',pos:'C'}]};
const inj={injuriesFetched:true,injuries:[{team:'LAL',player:'Teammate Guard',status:'Out',updatedAt:'2026-11-09T13:00:00Z'},{team:'LAL',player:'Teammate Center',status:'Out',updatedAt:'2026-11-09T13:00:00Z'}]};
const args={zone,context:inj,rosters,games,now};
test('True win history counts pushes separately, never calls observed rate a prediction',()=>{
 const r=explainQuickPick(base,args);
 assert.match(r.facts[0].detail,/7 wins \/ 2 losses \/ 1 pushes/);
 assert.match(r.facts[0].detail,/78% of resolved/);
 assert.doesNotMatch(r.facts[0].detail,/100% probability|guaranteed/i);
});
test('Zone and playstyle evidence use observed attempts and correct team/opponent',()=>{
 const r=explainQuickPick(base,args);
 assert.match(r.facts[1].detail,/Above-break 3/);
 assert.match(r.facts[1].detail,/\+2\.4 pp shot share/);
 assert.match(r.facts[3].detail,/17 FGA\/game vs L10 14/);
 assert.equal(r.facts[1].strength,'support');
});
test('Same-listed-role teammate OUT is CONDITIONAL, not a projected minutes boost',()=>{
 const r=explainQuickPick(base,args);
 assert.match(r.facts[2].detail,/Teammate Guard \(Out\)/);
 assert.match(r.facts[2].detail,/NOT a verified minutes increase/);
 assert.doesNotMatch(r.facts[2].detail,/Teammate Center/);
 assert.equal(r.facts[2].strength,'conditional');
 assert.match(r.facts[2].detail,/No independent minutes forecast/);
});
test('Own ESPN OUT or questionable leads PASS or HOLD',()=>{
 const out=explainQuickPick(base,{...args,context:{injuriesFetched:true,injuries:[{team:'LAL',player:'Example Guard',status:'Out',updatedAt:'2026-11-09T15:00:00Z'}]}});
 assert.match(out.status,/PASS · INACTIVE/);
 const q=explainQuickPick(base,{...args,context:{injuriesFetched:true,injuries:[{team:'LAL',player:'Example Guard',status:'Questionable',updatedAt:'2026-11-09T15:00:00Z'}]}});
 assert.match(q.status,/HOLD/);
});
test('Stale or same-day started game never shows positive priority',()=>{
 const stale=explainQuickPick({...base,observedAt:'2026-11-09T09:00:00Z'},args);
 assert.match(stale.status,/HOLD · RECHECK LINE/);
 const started=explainQuickPick(base,{...args,games:[{away:'LAL',home:'ATL',tipoff:'2026-11-09T14:00:00Z',state:'post',completed:true}]});
 assert.match(started.status,/CLOSED/);
});
test('No historical data or zone data must not invent clearance/shot overlap',()=>{
 const r=explainQuickPick({...base,stat:'AST',hit10:null,v2History:{}},{...args,zone:null,context:{injuriesFetched:false,injuries:[]}});
 assert.match(r.facts[0].detail,/unavailable/);
 assert.match(r.facts[1].detail,/does not directly establish AST/);
 assert.match(r.facts[2].detail,/Injury feed unavailable/);
});
test('Independent RotoWire minutes honored, but not confused with observed minutes',()=>{
 const r=explainQuickPick({...base,rotowire:{matched:true,projectedMinutes:36,projectedStat:23}},{...args,context:{injuriesFetched:true,injuries:[]}});
 assert.match(r.facts[2].detail,/RotoWire projects 36 min vs 31 recent actual/);
 assert.equal(r.checks.independentMinutes,true);
});
test('All array views receive same enhanced facts with order and no shared mutable refs',()=>{
 const zoneReport={games:[{label:'LAL @ ATL',candidates:[zone]}]};
 const board={all:[base,{...base,player:'Other',playerId:'103',stat:'REB',side:'LESS'}],
 topMore:[base],topLess:[],top10More:[base],top10Less:[],candidates:[base],bottom10:[],games};
 const x=enrichBoardQuickReads(board,{zoneReport,context:inj,rosters,games,now});
 assert.equal(x.all.length,2);assert.equal(x.topMore[0].quickRead.facts[1].strength,'support');
 assert.equal(x.topMore[0],x.all[0]);
 assert.equal(x.all[1].quickRead,undefined); // unranked rows stay lightweight
 assert.equal(board.all[0].quickRead,undefined);
});
test('Opponent mismatch never joins unrelated player zone data',()=>{
 const r=explainQuickPick({...base,opponent:'BOS'},{...args,zone:null});
 assert.match(r.facts[1].detail,/No qualifying/);
});
