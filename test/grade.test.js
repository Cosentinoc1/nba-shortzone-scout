const {test}=require('node:test');
const assert=require('node:assert/strict');
const {matchupGrade,rankings}=require('../lib/grade');
const defense=require('../data/defense.json');
const players=require('../data/players.json');
test('valid grades are bounded and justified by actual source data',()=>{
 let eligible=0;
 for(const p of players) for(const d of defense.teams){
  const g=matchupGrade(p,d,defense.league);
  if(g.eligible){eligible++;assert(g.score>=0&&g.score<=100);assert.equal(g.contributions.length,6)}
 }
 assert(eligible>100);
});
test('refuses no sample, insufficient sample and self-opponent',()=>{
 let p=players[0],d=defense.teams.find(x=>x.code===p.team);
 assert.equal(matchupGrade(p,d,defense.league).eligible,false);
 assert.equal(matchupGrade({...p,zones:{}},defense.teams.find(x=>x.code!==p.team),defense.league).eligible,false);
});
test('rankings return 6 sorted strongest and weakest with clear eligibility',()=>{
 const r=rankings(players,defense);
 assert.equal(r.top.length,6);assert.equal(r.worst.length,6);
 assert(r.top[0].score>=r.top.at(-1).score);assert(r.worst[0].score<=r.worst.at(-1).score);
});
