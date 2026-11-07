import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {rankBoard,statCode} from '../lib/props.mjs';
import {listParlayOffers,normalizeParlayRows} from '../lib/propFeed.mjs';
const load=name=>JSON.parse(readFileSync(new URL('../data/'+name+'.json',import.meta.url),'utf8'));
const rosters=load('rosters'),players=load('players'),defense=load('defense');
const pp=[['DEN','IND'],['HOU','PHX'],['NYK','CLE'],['WAS','OKC']];
function fixture(){
 const cache={};
 for(let i=0;i<10;i++){
  for(const [j,[a,b]]of pp.entries()){
   const day=new Date('2026-10-21T21:00:00Z');day.setUTCDate(day.getUTCDate()+i);
   cache[i+'-'+j]={id:i+'-'+j,date:day.toISOString(),teams:[a,b],players:[...rosters[a].slice(0,9).map(p=>({id:String(p.id),team:a,name:p.name,played:true,minutes:32,box:{pts:18+i,reb:6,ast:4,fgm:7,fga:14+i,tpm:2,tpa:7,ftm:2,fta:3}})),...rosters[b].slice(0,9).map(p=>({id:String(p.id),team:b,name:p.name,played:true,minutes:32,box:{pts:18+i,reb:6,ast:4,fgm:7,fga:14+i,tpm:2,tpa:7,ftm:2,fta:3}}))]};
  }
 }
 const rows=pp.flatMap(([a,b])=>rosters[a].slice(0,8).map(p=>({player:p.name,team:a,opponent:b,stat:'Points',line:19.5,Sides:'more, less',observed_at:'2026-11-07T14:50:00Z'})));
 const schedule=pp.map(([away,home],i)=>({id:String(i),away,home,completed:false}));
 return {gameCache:cache,rows,schedule};
}
test('v1.6 separates MORE and LESS and returns worst-alignments without treating them as recommended unders',()=>{
 const f=fixture(),board=rankBoard({...f,rosters,players,defense,day:'2026-11-07',now:Date.parse('2026-11-07T15:00:00Z')});
 assert.equal(board.scoringVersion,'1.6-opportunity-confidence');
 assert.ok(board.matched>=10);assert.ok(board.topMore.every(p=>p.side==='MORE'));
 assert.ok(board.topLess.every(p=>p.side==='LESS'));
 assert.ok(board.unfavorable.every(p=>p.unfavorable===true));
 assert.ok(board.candidates.every(p=>p.evidence?.confidence!=null));
 assert.ok(board.candidates.length<=6&&board.topLess.length<=6);
 assert.ok(board.warning.includes('NOT final picks'));
});
test('no candidate uses old or clock-invalid exact lines',()=>{
 const f=fixture();f.rows.forEach(r=>r.observed_at='2026-11-05T01:00:00Z');
 const result=rankBoard({...f,rosters,players,defense,day:'2026-11-07',now:Date.parse('2026-11-07T15:00:00Z')});
 assert.equal(result.qualified,0);assert.equal(result.topMore.length,0);assert.equal(result.topLess.length,0);
});
test('All Lines view distinguishes standard, goblin and unknown market without ranking them',()=>{
 const shared={bookmaker:'prizepicks',player:'Nikola Jokic',team_abbr:'DEN',period:'FULL',line:9.5,last_update:'2026-11-07T14:50:00Z',age_seconds:30};
 const rows=[{...shared,odds_type:'standard',market_key:'player_pts_rebs_asts'},{...shared,odds_type:'goblin',market_key:'player_rebounds',line:5.5},{...shared,odds_type:'demon',market_key:'player_blocks',line:4.5}];
 assert.equal(normalizeParlayRows(rows).length,1);
 const offers=listParlayOffers(rows);assert.equal(offers.length,3);
 assert.deepEqual(offers.map(x=>x.tier),['standard','goblin','demon']);
 assert.equal(statCode('Pts+Rebs+Asts'),'PRA');
});
test('full slate ranks quickly and retains transparent limited candidate payload',()=>{
 const f=fixture();const t=performance.now();const out=rankBoard({...f,rosters,players,defense,day:'2026-11-07',now:Date.parse('2026-11-07T15:00:00Z')});
 assert.ok(performance.now()-t<1400);
 assert.ok(out.all.length<=64);assert.equal(out.allCount,out.matched);
});
