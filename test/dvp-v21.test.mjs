import test from 'node:test';
import assert from 'node:assert/strict';
import {buildDvpIndex,defenseMatchup} from '../lib/dvp.mjs';
const rosters={OFF:[{id:'p1',name:'Alpha Guard',pos:'G'},{id:'p2',name:'Beta Guard',pos:'G'}]};
const gameCache={};
for(let i=0;i<9;i++)for(let j=0;j<3;j++){
 const opp='D'+i,id=opp+'-'+j;
 gameCache[id]={id,date:`2026-11-0${j+1}T20:00:00Z`,teams:['OFF',opp],players:[
  {id:'p1',name:'Alpha Guard',team:'OFF',pos:'G',played:true,minutes:30,box:{pts:12+i*2}},
  {id:'p2',name:'Beta Guard',team:'OFF',pos:'G',played:true,minutes:30,box:{pts:12+i*2}}
 ]};
}
const positions=[{team:'OFF',name:'Alpha Guard',pos:'PG'},{team:'OFF',name:'Beta Guard',pos:'PG'}];
test('Exact five-position DvP produces orientation-aware results with sourced player positions',()=>{
 const d=buildDvpIndex(gameCache,rosters,'2026-11-07',{positionOverrides:positions});
 const tough=defenseMatchup(d,{opponent:'D0',pos:'PG',stat:'PTS'});
 const easy=defenseMatchup(d,{opponent:'D8',pos:'PG',stat:'PTS'});
 assert.equal(tough.available,true);assert.equal(tough.proxy,false);
 assert.equal(easy.position,'PG');assert.ok(tough.score<easy.score);
 assert.equal(easy.lessScore,100-easy.score);
});
test('Broad guard position cannot claim verified exact-position letter',()=>{
 const d=buildDvpIndex(gameCache,rosters,'2026-11-07');
 const proxy=defenseMatchup(d,{opponent:'D4',pos:'G',stat:'PTS'});
 assert.equal(proxy.available,false);
 assert.equal(proxy.proxy,true);
 assert.equal(proxy.grade,null);
});
test('Future game never leaks into pregame DvP sample',()=>{
 const withFuture={...gameCache,future:{id:'future',date:'2026-11-07T22:00:00Z',teams:['OFF','D8'],players:[{id:'p1',name:'Alpha Guard',team:'OFF',pos:'G',played:true,minutes:30,box:{pts:500}}]}};
 const a=buildDvpIndex(gameCache,rosters,'2026-11-07',{positionOverrides:positions});
 const b=buildDvpIndex(withFuture,rosters,'2026-11-07',{positionOverrides:positions});
 assert.equal(a.exactRanking.PG_PTS.get('D8').average,b.exactRanking.PG_PTS.get('D8').average);
});
