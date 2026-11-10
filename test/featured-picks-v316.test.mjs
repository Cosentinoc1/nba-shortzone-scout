import test from 'node:test';
import assert from 'node:assert/strict';
import {buildFeaturedPicks} from '../lib/featured-picks-v316.mjs';
import {readFileSync} from 'node:fs';
const when=Date.parse('2026-11-10T15:00:00Z');
const start='2026-11-11T00:00:00Z';
function candidate(name='Example Shooter',opts={}){
 const p={player:name,team:'BOS',opponent:'NYK',playerId:'123',stat:'3PM',line:2.5,side:'MORE',tier:'standard',state:'RESEARCH ONLY',hard:[],observedAt:'2026-11-10T14:45:00Z',injuryStatus:null,
  researchRank:{tier:'LEAN',eligible:true,score:66,minutesL5:32,minutesCV:.12,components:{opportunity:63}},
  v2History:{boxscoreGames:10,hitRates:{last10:{win:7,loss:3,push:0,sample:10},last5:{win:4,loss:1,push:0}}},
  defenseGrade:{available:true,score:78,lessScore:22,primary:'NYK SG three-pointers allowed',proxy:false},
  rotowire:{matched:true,projectedMinutes:34,projectedStat:3.2},recommendation:{tier:'HOLD',status:'HOLD — CHECK PRICE',entryReady:false},
  newsZone:{shot:{contradicted:false},flags:[],veto:false,hold:false},
  quickRead:{quality:'lean',status:'RESEARCH LEAN',checks:{lineFresh:true,gameStarted:false,starterConfirmed:false,injuriesSourced:true},
   risks:['Independent payout EV not verified.'],market:{status:'MISSING',positiveEV:false},facts:[
    {label:'EXACT-LINE HISTORY',strength:'support',detail:'7 of 10 historical clears',source:'ESPN pregame game logs'},
    {label:'PLAYSTYLE & USAGE',strength:'observed',detail:'L5 7.5 3PA/game; 52% of attempts beyond arc.',source:'ESPN box-score attempts'},
    {label:'MINUTES & INJURIES',strength:'supported',detail:'RotoWire forecasts 34 minutes; no confirmed starting role.',source:'User RotoWire'},
    {label:'3-POINT ZONE',strength:'support',detail:'3-point attempts allowed above league benchmark.',source:'ESPN estimated zones'}
   ]}}
 ;return {...p,...opts};
}
function makeBoard(rows,games=[{id:'G1',away:'BOS',home:'NYK',tipoff:start,completed:false,state:'pre'}]){return {date:'2026-11-10',all:rows,games};}
test('Top 2 has plain-English line, real history, defense, role, playstyle, risk and clear non-lock status',()=>{
 const out=buildFeaturedPicks(makeBoard([candidate()]),{now:when});
 assert.equal(out.top2.length,1);const p=out.top2[0];
 assert.equal(p.side,'MORE');assert.equal(p.line,2.5);assert.equal(p.stat,'3PM');
 assert.equal(p.lastTen.percent,70);assert.equal(p.confidence,'STRONG RESEARCH');
 assert.equal(p.entryReady,false);assert.match(p.entryStatus,/NOT APPROVED/);
 for(const k of ['The numbers','Playstyle / opportunities','Why this defense?','Role and injuries'])assert.ok(p.reasons.some(x=>x.label===k));
 assert.match(p.reasons.find(x=>x.label==='Why this defense?').text,/NYK SG three-pointers/);
 assert.ok(p.checks.some(x=>/price|payout|value/i.test(x)));
});
test('Current line, no prior tip, no own OUT, correct opponent and standard line are mandatory',()=>{
 const base=candidate();const now=when;
 const samples=[
  candidate('No Line',{quickRead:{...base.quickRead,checks:{...base.quickRead.checks,lineFresh:false}}}),
  candidate('Out',{injuryStatus:'Out'}),
  candidate('Goblin',{tier:'goblin'}),
  candidate('Wrong Opponent',{opponent:'LAL'}),
  candidate('No History',{v2History:{boxscoreGames:0}}),
  candidate('Matched Bad',{rotowire:{matched:true,matchupMismatch:true,projectedStat:3.2}})
 ];
 const result=buildFeaturedPicks(makeBoard(samples),{now});assert.equal(result.top5.length,0);
 const started=buildFeaturedPicks(makeBoard([base],[{id:'G1',away:'BOS',home:'NYK',tipoff:'2026-11-10T14:00:00Z',completed:true,state:'post'}]),{now});
 assert.equal(started.top2.length,0);
});
test('Exact opponent defense score must match MORE versus LESS direction',()=>{
 const p=candidate('Under Man',{stat:'REB',side:'LESS',line:8.5,rotowire:{matched:true,projectedMinutes:34,projectedStat:6},defenseGrade:{available:true,score:85,lessScore:15,primary:'NYK rebounding'}});
 const out=buildFeaturedPicks(makeBoard([p]),{now:when});
 assert.equal(out.top2.length,0,'a strongly adverse defensive matchup is not marketed as lock');
});
test('Research without exact defensive evidence cannot pretend a weakness exists',()=>{
 const p=candidate('Missing Defense',{defenseGrade:{available:false},stat:'AST',rotowire:null});
 const out=buildFeaturedPicks(makeBoard([p]),{now:when});
 assert.equal(out.top2.length,1);const c=out.top2[0];
 assert.equal(c.matchupStrength,'missing');assert.match(c.reasons.find(x=>x.label==='Why this defense?').text,/not been independently verified/i);
 assert.ok(c.checks.some(x=>/matchup/.test(x)));
});
test('Duplicate players are removed; Top 2 prefers a different matchup when similar evidence',()=>{
 const one=candidate('A',{team:'BOS',opponent:'NYK'});
 const same={...candidate('A',{stat:'PTS',line:15.5}),researchRank:{...one.researchRank,score:68}};
 const another=candidate('B',{team:'BOS',opponent:'NYK'});
 const different=candidate('C',{team:'LAL',opponent:'ATL'});
 const games=[{id:'G1',away:'BOS',home:'NYK',tipoff:start,completed:false,state:'pre'},{id:'G2',away:'LAL',home:'ATL',tipoff:start,completed:false,state:'pre'}];
 const out=buildFeaturedPicks(makeBoard([one,same,another,different],games),{now:when});
 assert.equal(new Set(out.top5.map(x=>x.player)).size,out.top5.length);
 assert.equal(out.top2.length,2);
 assert.notEqual(out.top2[0].gameId,out.top2[1].gameId);
});
test('Never force exactly 2 or 5 and never mislabel ordinary research as bets',()=>{
 const out=buildFeaturedPicks(makeBoard([candidate('One')]),{now:when});
 assert.equal(out.top2.length,1);assert.equal(out.top5.length,1);
 assert.match(out.message,/NOT betting locks/);
 assert.equal(out.top5[0].entryReady,false);
});
test('Conflicting independent projected direction is not promoted as strong research',()=>{
 const good=candidate('Model Supports');const bad=candidate('Model Opposes',{rotowire:{matched:true,projectedMinutes:34,projectedStat:1.3}});
 const out=buildFeaturedPicks(makeBoard([bad,good]),{now:when});
 assert.equal(out.top2[0].player,'Model Supports');
 assert.ok(out.top2.every(x=>x.entryReady===false));
});
test('Frontend is interactive; server uses enriched board for all live/import/rotowire endpoints',()=>{
 const root=new URL('../',import.meta.url);const read=p=>readFileSync(new URL(p,root),'utf8');
 const server=read('server.mjs'),ui=read('public/clean.js'),html=read('public/index.html'),script=read('public/featured-picks-v316.mjs');
 assert.match(server,/buildFeaturedPicks\(\{\.\.\.enriched,date:day\}/);assert.match(server,/function quickExplain/);
 for(const api of ["'/api/picks'","'/api/picks/rotowire'","'/api/picks/import'"])assert.match(server,new RegExp(api));
 assert.match(ui,/renderSimplePicks\(data/);assert.match(html,/id="featuredPicks"/);
 assert.match(script,/data-fp-count/);assert.match(script,/data-fp-open/);
});
test('Top-two team shot responsibility is a source-labeled proxy, never invented USG%',()=>{
 const role=new Map([['BOS|exampleshooter',{player:'Example Shooter',team:'BOS',sample:5,teamGames:5,fgaRank:1,astRank:2,rebRank:3,fgaShare:28.4,astShare:17,rebShare:4.8,fgaPerGame:18.2,tpaPerGame:7.1,ftaPerGame:5.3,source:'ESPN final box scores'}]]);
 const pick=buildFeaturedPicks(makeBoard([candidate()]),{now:when,offenseContext:role}).top2[0];
 assert.equal(pick.usage?.rank,1);assert.equal(pick.usage?.share,28.4);
 assert.ok(pick.sourceCoverage.some(x=>x.name==='Team opportunity / top-two role'&&x.state==='BOX-SCORE PROXY'));
 assert.match(pick.reasons.find(x=>x.label==='Team offensive role').text,/not verified usage rate/i);
 assert.equal(pick.signalCount,6);
});
test('Featured source desk marks missing independent prices and licensed starters explicitly',()=>{
 const p=buildFeaturedPicks(makeBoard([candidate()]),{now:when}).top2[0];
 assert.equal(p.sourceCoverage.find(x=>x.name==='Independent market and payout').state,'MISSING');
 assert.equal(p.sourceCoverage.find(x=>x.name==='Starting role').state,'MISSING');
 assert.equal(p.entryReady,false);
 assert.equal(p.sourceCoverage.find(x=>x.name==='True tracking chances / on-off').state,'MISSING');
});
test('A contrary independent RotoWire forecast is removed, not sold as a strong pick',()=>{
 const p=candidate('Disagreement',{rotowire:{matched:true,projectedMinutes:34,projectedStat:1.2}});
 assert.equal(buildFeaturedPicks(makeBoard([p]),{now:when}).top5.length,0);
});
