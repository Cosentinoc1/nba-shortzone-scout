import test from 'node:test';
import assert from 'node:assert/strict';
import {buildOffenseContext,roleFor,roleFact} from '../lib/offense-context-v316.mjs';
const c={};
for(let day=1;day<=6;day++){
 const date=`2026-11-${String(day).padStart(2,'0')}T02:00:00Z`;
 c[String(day)]={id:String(day),date,schemaVersion:2,teams:['BOS','NYK'],players:[
  {team:'BOS',name:'Alpha',played:true,minutes:34,box:{fga:20,fta:5,tpa:8,ast:7,reb:4,pts:27}},
  {team:'BOS',name:'Beta',played:true,minutes:27,box:{fga:11,fta:2,tpa:3,ast:4,reb:8,pts:14}},
  {team:'BOS',name:'Gamma',played:true,minutes:22,box:{fga:6,fta:1,tpa:0,ast:1,reb:3,pts:7}},
  {team:'NYK',name:'Opponent',played:true,minutes:37,box:{fga:17,fta:4,tpa:5,ast:5,reb:4,pts:26}}
 ]};
}
test('BOS shooting leader is rank 1 on exactly previous 5 team games',()=>{
 const x=buildOffenseContext(c,'2026-11-10'),r=roleFor(x,'BOS','Alpha');
 assert.equal(r.teamGames,5);assert.equal(r.sample,5);assert.equal(r.fgaRank,1);assert.equal(r.fgaPerGame,20);
 assert.equal(roleFact(r,'PTS').topTwo,true);assert.match(roleFact(r,'PTS').text,/not verified usage rate/);
});
test('strict Chicago pre-slate cutoff excludes selected-date and future games',()=>{
 const x=buildOffenseContext(c,'2026-11-01');assert.equal(roleFor(x,'BOS','Alpha'),null);
});
test('different stat types select relevant box-score share without inventing touches/chances',()=>{
 const x=buildOffenseContext(c,'2026-11-10'),r=roleFor(x,'BOS','Beta');
 assert.equal(roleFact(r,'REB').rank,1);
 assert.equal(roleFact(r,'AST').rank,2);
 assert.equal(roleFact(r,'PTS').rank,2);
 assert.doesNotMatch(roleFact(r,'REB').text,/verified usage%/);
});

test('fantasy points per minute are shown only with six completed ESPN box-score stats',()=>{
 const complete=structuredClone(c);
 for(const game of Object.values(complete))for(const p of game.players){p.box.stl=1;p.box.blk=0;p.box.tov=3;}
 const x=buildOffenseContext(complete,'2026-11-10'),r=roleFor(x,'BOS','Alpha');
 assert.equal(r.fantasyGames,5);assert.equal(r.fantasyPointsPerMinute,1.2);
 assert.match(roleFact(r,'PTS').text,/Historical fantasy production 1.2 per played minute/);
 const prior=roleFor(buildOffenseContext(c,'2026-11-10'),'BOS','Alpha');
 assert.equal(prior.fantasyPointsPerMinute,null);
});
