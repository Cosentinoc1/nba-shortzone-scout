import test from 'node:test';import assert from 'node:assert/strict';
import {buildDvpIndex,defenseMatchup} from '../lib/dvp.mjs';
const rosters={DAL:[{id:'1',pos:'G'}],UTA:[{id:'2',pos:'G'}]};
test('DVP index never uses same-day box scores in pregame matchup grade',()=>{
 const mk=(id,date,value,opp)=>({id,date,teams:['DAL','UTA'],players:[{id:'1',team:'DAL',played:true,minutes:33,box:{pts:value,reb:2,ast:5,tpm:1,fga:15,tpa:3,ftm:1}},{id:'2',team:'UTA',played:true,minutes:32,box:{pts:opp,reb:3,ast:2,tpm:1,fga:10,tpa:3,ftm:1}}]});
 const gc={a:mk('a','2026-11-05T01:00:00Z',20,12),b:mk('b','2026-11-07T01:00:00Z',500,500)};
 const r=buildDvpIndex(gc,rosters,'2026-11-06');assert.equal(r.games,1);
 assert.equal(r.ranking.G_PTS.get('UTA').average,20);
});
test('DVP lacks grade when insufficient opponents or samples',()=>{
 const d=buildDvpIndex({},rosters,'2026-11-07');assert.equal(defenseMatchup(d,{opponent:'IND',pos:'F',stat:'PTS'}).available,false);
});
