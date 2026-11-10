import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHistoryBoxScore} from '../lib/espn-history-v315.mjs';
const ev={id:'123',date:'2026-11-08T23:00:00Z',competitions:[{competitors:[{team:{abbreviation:'BOS'}},{team:{abbreviation:'NYK'}}]}]};
const row=(name,id,minutes,pts,reb,ast)=>({athlete:{displayName:name,id},stats:[minutes,'5-11','2-4','3-3',String(reb),String(ast),String(pts)]});
test('ESPN fallback preserves official player PTS/REB/AST, MIN and FG/3PT/FT fields',()=>{
 const summary={boxscore:{players:[{team:{abbreviation:'BOS'},statistics:[{labels:['MIN','FG','3PT','FT','REB','AST','PTS'],athletes:[row('One Man',1,'31:30',15,6,4)]}]},{team:{abbreviation:'NYK'},statistics:[{labels:['MIN','FG','3PT','FT','REB','AST','PTS'],athletes:[row('Other Man',2,'30',19,4,8)]}]}]}};
 const g=parseHistoryBoxScore(ev,summary);assert.equal(g.schemaVersion,1);assert.equal(g.historyOnly,true);assert.equal(g.players[0].minutes,31.5);assert.equal(g.players[0].box.pts,15);assert.equal(g.players[0].box.fga,11);assert.equal(g.players[0].box.tpa,4);assert.equal(g.players[0].zones,null);
});
test('missing stats are null, not fabricated zeroes and incomplete source fails closed',()=>{
 const summary={boxscore:{players:[{team:{abbreviation:'BOS'},statistics:[{labels:['MIN','PTS'],athletes:[{athlete:{displayName:'One',id:'1'},stats:['24','12']}]}]},{team:{abbreviation:'NYK'},statistics:[{labels:['MIN','PTS'],athletes:[{athlete:{displayName:'Two',id:'2'},stats:['25','15']}]}]}]}};
 const g=parseHistoryBoxScore(ev,summary);assert.equal(g.players[0].box.reb,null);assert.equal(g.players[0].box.fga,null);
 assert.throws(()=>parseHistoryBoxScore(ev,{boxscore:{players:[]}}),/Not enough/);
});
