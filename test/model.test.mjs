import test from 'node:test';
import assert from 'node:assert/strict';
import {coordinateZone,matchupGrade,rankMatchups,parseESPNGame,zeroZones,normalizeTeam} from '../lib/model.mjs';
import {readFileSync} from 'node:fs';
const defense=JSON.parse(readFileSync(new URL('../data/defense.json',import.meta.url)));
const players=JSON.parse(readFileSync(new URL('../data/players.json',import.meta.url)));
test('ESPN team aliases',()=>{assert.equal(normalizeTeam('NO'),'NOP');assert.equal(normalizeTeam('UTAH'),'UTA')});
test('court zone classifier including heaves and free throws',()=>{
 const p=(x,y,pointsAttempted)=>({coordinate:{x,y},pointsAttempted});
 assert.equal(coordinateZone(p(25,2,2)),'rim');
 assert.equal(coordinateZone(p(25,12,2)),'paint');
 assert.equal(coordinateZone(p(24,27,2)),'mid');
 assert.equal(coordinateZone(p(2,7,3)),'left');
 assert.equal(coordinateZone(p(48,7,3)),'right');
 assert.equal(coordinateZone(p(22,24,3)),'above');
 assert.equal(coordinateZone(p(12,47,3)),'heave');
 assert.equal(coordinateZone(p(25,1,1)),null);
});
test('matchup cannot be ranked if player has no shot volume',()=>{
 const d=defense.teams[0],p={name:'Zero attempts',gp:8,zones:zeroZones()};assert.equal(matchupGrade(p,d,defense.league).eligible,false);
});
test('grade is bounded and clearly not a probability',()=>{
 const p=players.find(x=>x.gp>=4&&Object.values(x.zones).reduce((n,z)=>n+z.fga,0)>=40);
 assert.ok(p,'At least one sample player has enough shots');let g=matchupGrade(p,defense.teams[0],defense.league);
 assert.ok(g.score>=10&&g.score<=90);assert.equal(g.rows.length,6);assert.match(g.method,/NOT P\(win\)/);
});
test('rankings only cover requested actual matchup and eligible players',()=>{
 const out=rankMatchups({players,defense,matchups:[{away:'ATL',home:'BOS',label:'ATL @ BOS'}],scope:'today'});
 assert.equal(out.pairings,2);assert.ok(out.top.every(x=>['ATL','BOS'].includes(x.offense)));
 assert.ok(out.top.every(x=>x.games>=4&&x.attempts>=40));
 assert.ok(out.worst.length<=6&&out.top.length<=6);
});
test('play-by-play validation catches incomplete boxscore totals',()=>{
 const fake={boxscore:{teams:[{team:{id:'1',abbreviation:'ATL'},statistics:[{name:'fieldGoalsMade-fieldGoalsAttempted',displayValue:'1-20'}]},{team:{id:'2',abbreviation:'BOS'},statistics:[{name:'fieldGoalsMade-fieldGoalsAttempted',displayValue:'1-20'}]}]},plays:[{shootingPlay:true,team:{id:'1'},participants:[{athlete:{id:'a'}}],pointsAttempted:2,coordinate:{x:25,y:1}}]};
 assert.throws(()=>parseESPNGame({id:1,date:'2026-10-25'},fake),/play-by-play FGA/);
});

test('ESPN end-of-period heaves beyond baseline are not treated as unknown attempts',()=>{
 const heave={type:{text:'Heave Jump Shot'},text:'Victor Wembanyama misses heave jump shot',coordinate:{x:21,y:62},pointsAttempted:3};
 assert.equal(coordinateZone(heave),'heave');
 const ev={id:'heave-fixture',date:'2026-11-05T00:00Z'};
 const data={
  boxscore:{teams:[
   {team:{id:'1',abbreviation:'SAS'},statistics:[{name:'fieldGoalsMade-fieldGoalsAttempted',displayValue:'20-30'}]},
   {team:{id:'2',abbreviation:'OKC'},statistics:[{name:'fieldGoalsMade-fieldGoalsAttempted',displayValue:'20-30'}]},
  ]},
  plays:[...Array.from({length:60},(_,i)=>({shootingPlay:true,scoringPlay:i%2===0,pointsAttempted:2,team:{id:i<30?'1':'2'},participants:[{athlete:{id:i<30?'p1':'p2'}}],coordinate:{x:25,y:2},text:'two pointer'})),
   {shootingPlay:true,scoringPlay:false,pointsAttempted:3,team:{id:'1'},participants:[{athlete:{id:'p1'}}],coordinate:{x:21,y:62},type:{text:'Heave Jump Shot'},text:'misses heave jump shot'}]
 };
 const out=parseESPNGame(ev,data);
 assert.equal(out.unknown,0);
 assert.equal(out.valid,60);
 assert.equal(out.excludedHeaves,1);
 assert.equal(out.unreconciledFga,0);
});

test('minor ESPN scorebook shot correction is flagged and does not abort a game',()=>{
 const ev={id:'corrected',date:'2026-11-05T00:00Z'};
 const data={boxscore:{teams:[
  {team:{id:'1',abbreviation:'ATL'},statistics:[{name:'fieldGoalsMade-fieldGoalsAttempted',displayValue:'20-30'}]},
  {team:{id:'2',abbreviation:'BOS'},statistics:[{name:'fieldGoalsMade-fieldGoalsAttempted',displayValue:'20-30'}]}
 ]},plays:Array.from({length:61},(_,i)=>({shootingPlay:true,scoringPlay:i%2===0,pointsAttempted:2,team:{id:i<31?'1':'2'},participants:[{athlete:{id:i<31?'p1':'p2'}}],coordinate:{x:25,y:2},text:'field goal'}))};
 const out=parseESPNGame(ev,data);assert.equal(out.unreconciledFga,1);
});

test('rankings audit counts missing and low-volume roster players separately',()=>{
 const sample=players.find(p=>p.team==='ATL'&&p.gp>=4&&Object.values(p.zones).reduce((n,z)=>n+z.fga,0)>=40);
 assert.ok(sample);
 const roster={ATL:[{name:sample.name,id:'matched',pos:'G'},{name:'No profile available',id:'missing',pos:'G'},{name:'Low sample',id:'low',pos:'C'}],BOS:[{name:'Unmeasured opponent',id:'other'}]};
 const low={name:'Low sample',team:'ATL',gp:2,pos:'C',zones:zeroZones()};
 const out=rankMatchups({players:[sample,low],defense,matchups:[{away:'ATL',home:'BOS',label:'ATL @ BOS'}],scope:'today',rosters:roster});
 assert.equal(out.totalRosterSlots,4);assert.equal(out.eligiblePlayers,1);
 assert.equal(out.missingProfiles,2);assert.equal(out.notQualified,1);
 assert.equal(out.complete,false);assert.equal(out.coveragePct,25);
});
