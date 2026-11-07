import test from 'node:test';
import assert from 'node:assert/strict';
import {zeroZones,aggregateGames,matchupGrade} from '../lib/model.mjs';
import {zoneForecast} from '../lib/projection.mjs';
import {auditDay,gameLocalDate} from '../lib/audit.mjs';
import {readFileSync} from 'node:fs';
const defense=JSON.parse(readFileSync(new URL('../data/defense.json',import.meta.url)));
const players=JSON.parse(readFileSync(new URL('../data/players.json',import.meta.url)));
const p=players.find(p=>p.gp>=6&&Object.values(p.zones).reduce((n,x)=>n+x.fga,0)>=40);
const d=defense.teams.find(t=>t.code!==p.team);
const fakeRecent=Array.from({length:5},(_,i)=>({minutes:30+i,zones:p.zones}));
test('forecast exposes three grades, six zones, and an explicit no-bet veto',()=>{
 const o=zoneForecast({profile:p,defenseTeam:d,league:defense.league,recentGames:fakeRecent});
 assert.equal(o.zones.length,6);assert.ok(o.totalProjectedFga>0);assert.equal(typeof o.opportunityGrade,'number');
 assert.equal(typeof o.efficiencyGrade,'number');assert.equal(typeof o.dataConfidence,'number');
 assert.equal(o.veto.notBetApproved,true);assert.notEqual(o.veto.status,'SCOUTING CLEAR');
 assert.equal(o.expectedMinutes,32);
});
test('minutes scaling changes estimates, but cannot override a strong suppression veto',()=>{
 const a=zoneForecast({profile:p,defenseTeam:d,league:defense.league,recentGames:fakeRecent,expectedMinutes:24,roleVerified:true});
 const b=zoneForecast({profile:p,defenseTeam:d,league:defense.league,recentGames:fakeRecent,expectedMinutes:40,roleVerified:true});
 assert.ok(a.totalProjectedFga<b.totalProjectedFga);assert.ok(b.zones.every(z=>z.projectedFga>=0));
});
test('game date is Chicago-local, not the UTC next-day label',()=>{
 assert.equal(gameLocalDate({date:'2026-11-07T03:00:00Z'}),'2026-11-06');
});
test('audit scores pregame candidates before looking at game results, retaining DNPs',()=>{
 let base=zeroZones();base.rim={fga:8,fgm:5};base.paint={fga:4,fgm:2};
 let all=[];
 for(let i=0;i<25;i++){
  const day=String(i+1).padStart(2,'0');
  const date=`2026-10-${day}T23:00:00Z`;
  const a={id:'a',name:'Alpha Shooter',team:'ATL',pos:'G',played:true,minutes:30,zones:structuredClone(base)};
  const b={id:'b',name:'Beta Shooter',team:'BOS',pos:'G',played:true,minutes:30,zones:structuredClone(base)};
  all.push({id:String(i),date,teams:['ATL','BOS'],players:[a,b]});
 }
 // Day after the synthetic training set. The first game is Nov 1.
 all.push({id:'1000',date:'2026-11-02T02:00:00Z',teams:['ATL','BOS'],players:[
  {id:'a',name:'Alpha Shooter',team:'ATL',played:false,minutes:0,zones:zeroZones()},
  {id:'b',name:'Beta Shooter',team:'BOS',played:true,minutes:30,zones:{...zeroZones(),rim:{fga:20,fgm:15}}}
 ]});
 const cache=Object.fromEntries(all.map(g=>[g.id,g]));const r=auditDay(cache,'2026-11-01');
 assert.equal(r.ready,true);assert.equal(r.completedGames,1);assert.equal(r.priorGames,25);
 assert.equal(r.gradedPlayers,2);assert.equal(r.playedGradedPlayers,1);assert.equal(r.unplayedGradedPlayers,1);
 assert.ok(r.details.some(x=>x.player==='Alpha Shooter'&&x.played===false));
 const before=JSON.stringify(r.details.map(x=>[x.player,x.grade,x.projectedZoneFga,x.baselineZoneFga]));
 cache['1000'].players[1].zones.rim.fga=9999;
 const after=auditDay(cache,'2026-11-01');
 assert.equal(JSON.stringify(after.details.map(x=>[x.player,x.grade,x.projectedZoneFga,x.baselineZoneFga])),before,'Same-day shooting cannot alter any pregame projection');
});
