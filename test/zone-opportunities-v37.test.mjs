import test from 'node:test';
import assert from 'node:assert/strict';
import {zoneSignalGrade,defenseZoneGrades,ZONE_IDS} from '../public/zone-metrics.mjs';
import {rankGameZoneOpportunities,priorGamesOnly,chicagoGameDay} from '../lib/zone-opportunities.mjs';
import {readFileSync} from 'node:fs';
const zs=(values={})=>Object.fromEntries(ZONE_IDS.map(z=>[z,{fga:values[z]||0,fgm:Math.round((values[z]||0)*.45)}]));
const lgShares={rim:.30,paint:.19,mid:.10,left:.08,right:.07,above:.26};
const league={zones:Object.fromEntries(ZONE_IDS.map(z=>[z,{fg:z==='mid'?.39:.42,share:lgShares[z]}]))};
function def(code,midShare=.2,midFg=.53){
 const shares={rim:.20,paint:.16,mid:midShare,left:.07,right:.07,above:1-.20-.16-midShare-.07-.07};
 return {code,name:code,attempts:1000,zones:Object.fromEntries(ZONE_IDS.map(z=>[z,{fga:Math.round(shares[z]*1000),fg:z==='mid'?midFg:.4,share:shares[z]}]))};
}
const defense={league,teams:[def('NYK'),def('BOS',.09,.38)]};
const profile=(id,name,team,dist,gp=10)=>({id,name,team,gp,zones:zs(dist)});
const shooter=profile('1','Midrange Specialist','BOS',{mid:80,paint:10,above:10});
const rim=profile('2','Rim Driver','BOS',{rim:85,paint:10,above:5});
const nyk=profile('3','NYK Shooter','NYK',{above:60,mid:10,rim:30});
const rosters={BOS:[{id:'1'},{id:'2'}],NYK:[{id:'3'}]};
const game=[{id:'g1',label:'BOS @ NYK',away:'BOS',home:'NYK',state:'pre',tipoff:'2026-11-10T00:00Z'}];
function fakeHistory(id,team,mins=32){return Array.from({length:10},(_,i)=>({schemaVersion:2,date:new Date(Date.parse('2026-10-30T19:00:00Z')+86400000*i).toISOString(),teams:['BOS','NYK'],players:[{id,team,played:true,minutes:mins,box:{fga:10},zones:zs({rim:3,mid:6,above:1})}]}));}
const hist=[...fakeHistory('1','BOS'),...fakeHistory('2','BOS'),...fakeHistory('3','NYK')].sort((a,b)=>a.date.localeCompare(b.date));
test('volume and FG% grades are independent, league-neutral baseline 50, and low-sample FG% shrinks',()=>{
 const highVolumePoorFg=zoneSignalGrade({fga:100,totalFga:1000,fg:.28,share:.35,leagueFg:.4,leagueShare:.20});
 assert.ok(highVolumePoorFg.volumeGrade>60);assert.ok(highVolumePoorFg.efficiencyGrade<50);
 const tiny=zoneSignalGrade({fga:2,totalFga:600,fg:1,share:.05,leagueFg:.4,leagueShare:.05});
 const large=zoneSignalGrade({fga:300,totalFga:600,fg:1,share:.05,leagueFg:.4,leagueShare:.05});
 assert.ok(tiny.efficiencyGrade<large.efficiencyGrade);
 assert.equal(zoneSignalGrade({fga:100,totalFga:1000,fg:.42,share:.2,leagueFg:.42,leagueShare:.2}).volumeGrade,50);
});
test('six grades reflect actual opponent team data; not inferred win probabilities',()=>{
 const r=defenseZoneGrades(defense,'NYK');assert.equal(r.zones.length,6);
 const mid=r.zones.find(z=>z.id==='mid');assert.ok(mid.volumeGrade>50);assert.ok(mid.efficiencyGrade>50);
 assert.equal(defenseZoneGrades(defense,'MISSING'),null);
});
test('ranking auto-matches each offense to opposite defense and differentiates shot profile',()=>{
 const result=rankGameZoneOpportunities({day:'2026-11-09',games:game,playerProfiles:[shooter,rim,nyk],defense,historyGames:hist,rosters});
 assert.equal(result.gameCount,1);assert.equal(result.games[0].considered,3);
 const list=result.games[0].candidates,mid=list.find(p=>p.id==='1'),rimGuy=list.find(p=>p.id==='2');
 assert.equal(mid.opponent,'NYK');assert.equal(mid.topZone,'mid');
 assert.ok(mid.volumeGrade>rimGuy.volumeGrade);assert.ok(mid.efficiencyGrade>rimGuy.efficiencyGrade);
 assert.ok(mid.score>rimGuy.score);assert.ok(mid.fgaPerGame>0);assert.equal(mid.minutesL5,32);
 assert.ok(Number.isFinite(mid.threeMatchScore));assert.ok(['left','right','above'].includes(mid.top3Zone));
 assert.equal(list.find(p=>p.id==='3').opponent,'BOS');
 assert.match(result.method,/not a player-prop recommendation/);
});
test('unsupported roster or extremely low minutes is excluded, not passed as verified',()=>{
 const weak=[...fakeHistory('2','BOS',10),...fakeHistory('1','BOS',32)];
 const result=rankGameZoneOpportunities({day:'2026-11-09',games:game,playerProfiles:[shooter,rim,{...rim,id:'999',name:'Unknown'}],defense,historyGames:weak,rosters});
 assert.equal(result.games[0].considered,1);
 const p=result.games[0].candidates[0];assert.equal(p.player,'Midrange Specialist');
 assert.ok(p.warnings.some(x=>x.includes('availability')));
 assert.ok(!('winProbability' in p));
});
test('pregame cutoff respects America/Chicago rather than UTC date',()=>{
 assert.equal(chicagoGameDay('2026-11-10T01:00:00Z'),'2026-11-09');
 const cache={old:{schemaVersion:2,date:'2026-11-09T02:30:00Z',players:[],teams:[]},
 same:{schemaVersion:2,date:'2026-11-10T01:00:00Z',players:[],teams:[]},
 tomorrow:{schemaVersion:2,date:'2026-11-11T01:00:00Z',players:[],teams:[]}};
 assert.equal(priorGamesOnly(cache,'2026-11-09').length,1);
});
test('main app integration includes separate grades, matchup UI, and same-origin read-only route',()=>{
 const repo=new URL('../',import.meta.url);
 const read=f=>readFileSync(new URL(f,repo),'utf8');
 const s=read('server.mjs'),page=read('public/index.html'),ui=read('public/defense-zones.mjs');
 assert.match(s,/\/api\/zone-opportunities/);assert.match(s,/priorGamesOnly\(gameCache,day\)/);
 assert.match(page,/id="zoPanel"/);assert.match(page,/id="zoGame"/);assert.match(page,/zone-opportunity-ui\.mjs/);
 assert.match(ui,/zoneSignalGrade/);assert.match(ui,/VOLUME ALLOWED GRADE/);assert.match(ui,/FG% ALLOWED GRADE/);
 assert.ok(!s.includes('\.github/workflows/nba-scout-review.yml'));
});
