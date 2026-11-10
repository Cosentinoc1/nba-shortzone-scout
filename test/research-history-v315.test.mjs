import test from 'node:test';
import assert from 'node:assert/strict';
import {researchPlayer} from '../lib/research.mjs';
const cache={};
for(let i=0;i<23;i++){
 const d=new Date(Date.UTC(2026,9,20+i,20));
 cache[i]={id:String(i),date:d.toISOString(),teams:['BOS','NYK'],schemaVersion:1,
   players:[{id:'100',name:'Sample Player',team:'BOS',played:true,minutes:27+i*.1,
     box:{pts:10+i,reb:3,ast:2,fgm:5,fga:13,tpm:2,tpa:7,ftm:1,fta:2}}]};
}
test('last 10 remains stable for rankings; last 20 is separately available for player display',()=>{
 const res=researchPlayer({gameCache:cache,offense:'BOS',defense:'NYK',playerId:'100',playerName:'Sample Player',stat:'PTS',line:20.5,day:'2026-11-15'});
 assert.equal(res.last5,5);assert.equal(res.last10,10);assert.equal(res.last20,20);
 assert.equal(res.recent.length,10);assert.equal(res.recent20.length,20);
 assert.equal(res.recent20[0].stat,32);assert.equal(res.recent[0].stat,32);
 assert.equal(res.last10Mean,27.5);assert.equal(res.last20Mean,22.5);
 assert.equal(res.hitRates.last20.sample,20);assert.equal(res.hitRates.last10.sample,10);
});
test('pregame only, DNP / incomplete box rows are excluded, and sample counts stay honest',()=>{
 const short={...cache,extra:{id:'extra',date:'2026-11-20T01:00:00Z',teams:['BOS','NYK'],players:[{id:'100',name:'Sample Player',team:'BOS',played:true,minutes:42,box:{pts:50}}]}};
 const res=researchPlayer({gameCache:short,offense:'BOS',defense:'NYK',playerId:'100',playerName:'Sample Player',stat:'PTS',day:'2026-11-15'});
 assert.equal(res.boxscoreGames,23);assert.equal(res.recent20[0].stat,32);
 const fewer=Object.fromEntries(Object.entries(cache).slice(0,9));fewer.dnp={id:'dnp',date:'2026-11-10T01:00:00Z',teams:['BOS','NYK'],players:[{id:'100',name:'Sample Player',team:'BOS',played:false,minutes:0,box:{pts:0}}]};
 const r=researchPlayer({gameCache:fewer,offense:'BOS',defense:'NYK',playerId:'100',playerName:'Sample Player',stat:'PTS',day:'2026-11-15'});
 assert.equal(r.last20,9);assert.equal(r.recent20.length,9);
});
