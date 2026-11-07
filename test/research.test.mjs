import test from 'node:test';
import assert from 'node:assert/strict';
import {researchPlayer,hitRates,statValue} from '../lib/research.mjs';
const cache={};const values=[16,19,18,22,23,25,24,26];
for(let i=0;i<values.length;i++){
 const date=`2026-10-${String(21+i).padStart(2,'0')}T00:30:00Z`;
 cache[i]={id:String(i),schemaVersion:2,date,teams:['SAS',i%2?'SAC':'POR'],players:[{id:'1',name:'Player One',team:'SAS',played:true,minutes:30+i/2,box:{pts:values[i],reb:6+i,ast:3,fgm:9,fga:17,tpm:2,tpa:6,ftm:5,fta:7}}]};
}
cache.future={date:'2026-11-07T19:00:00Z',teams:['SAS','SAC'],players:[{id:'1',name:'Player One',team:'SAS',played:true,minutes:30,box:{pts:999,reb:999,ast:999}}]};
const base={gameCache:cache,offense:'SAS',defense:'SAC',playerId:'1',playerName:'Player One',stat:'PTS',side:'MORE',line:20,day:'2026-11-07'};
test('count correct independent MORE/LESS/push outcomes',()=>{
 const p=Object.values(cache).filter(x=>x.id).map(x=>x.players[0]);
 const r=hitRates(p,'PTS',22,'MORE');assert.equal(r.win,4);assert.equal(r.push,1);assert.equal(r.loss,3);
 const under=hitRates(p,'PTS',22,'LESS');assert.equal(under.win,3);assert.equal(under.push,1);assert.equal(under.loss,4);
});
test('research never includes same-day future result and H2H remains same-season',()=>{
 const r=researchPlayer(base);assert.equal(r.boxscoreGames,8);assert.equal(r.last5,5);assert.equal(r.last10,8);assert.equal(r.h2hGames,4);assert.equal(r.seasonMean,21.6);
 assert.ok(r.projectedBaseline<30);assert.equal(r.hitRates.season.sample,8);assert.equal(r.hitRates.h2h.sample,4);
 assert.equal(r.opportunity.tpaL5,6);assert.equal(r.opportunity.fgaL5,17);assert.equal(r.method.includes('not prediction intervals'),true);
});
test('projected minutes changes baseline without creating win probability',()=>{
 const baseline=researchPlayer(base),scaled=researchPlayer({...base,expectedMinutes:40});assert.ok(scaled.projectedBaseline>baseline.projectedBaseline);
 assert.equal('winProbability' in scaled,false);assert.equal(scaled.ready,true);
});
test('combined stat uses exact component sum and incomplete statistics are missing, never zeroed',()=>{
 assert.equal(statValue({pts:15,reb:7,ast:5},'PRA'),27);
 assert.equal(statValue({pts:15,reb:null,ast:5},'PRA'),null);
 assert.equal(statValue({fgm:9,tpm:2},'2PM'),7);
 assert.equal(statValue({fga:null},'FGA'),null);
});
test('side validation and missing line are handled without false hit rate',()=>{
 const noLine=researchPlayer({...base,line:null});assert.equal(noLine.hitRates,null);assert.equal(noLine.lean,'NO LEAN');
 assert.throws(()=>researchPlayer({...base,side:'CASH'}),/Unsupported/);
});
test('parsed ESPN box score includes accurate component stats used by research',async()=>{
 const {parseESPNGame}=await import('../lib/model.mjs');
 const mk=(code,id)=>({team:{id,abbreviation:code},statistics:[{name:'fieldGoalsMade-fieldGoalsAttempted',displayValue:'8-15'}]});
 const statset=(code,id)=>({team:{id,abbreviation:code},statistics:[{names:['MIN','PTS','FG','3PT','FT','REB','AST','TO','STL','BLK','OREB','DREB','PF','+/-'],athletes:[{athlete:{id,displayName:code==='SA'?'Victor':'Opponent'},stats:['31','22','8-14','2-5','4-5','11','7','1','1','2','3','8','2','+4'],didNotPlay:false}]}]});
 const plays=[];for(let i=0;i<30;i++)plays.push({shootingPlay:true,pointsAttempted:2,participants:[{athlete:{id:i%2?'2':'1'}}],team:{id:i%2?'2':'1'},coordinate:{x:25,y:1},scoringPlay:i%2===0,text:'Somebody makes layup'});
 const d=parseESPNGame({id:99,date:'2026-11-06T20:00:00Z'}, {boxscore:{teams:[mk('SA','1'),mk('SAC','2')],players:[statset('SA','1'),statset('SAC','2')]},plays});
 const p=d.players.find(x=>x.id==='1');assert.equal(d.schemaVersion,2);assert.equal(p.box.pts,22);assert.equal(p.box.reb,11);assert.equal(p.box.ast,7);assert.equal(p.box.fga,14);assert.equal(p.box.tpa,5);assert.equal(p.box.ftm,4);assert.equal(statValue(p.box,'PRA'),40);
});
