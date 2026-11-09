import test from 'node:test';import assert from 'node:assert/strict';
import {canonicalStat,statValue,gradePick,summaries,pretipCandidates,extractESPNPlayers,matchPlayer,numericBox} from '../scripts/review-lib.mjs';
test('stat aliases and exact pushes',()=>{
 for(const [s,out] of Object.entries({'Points':'PTS','PTS+REB+AST':'PRA','Pts+Asts':'PA','Rebs+Asts':'RA','3-Pointers Made':'3PM','FT made':'FTM','FG Attempts':'FGA'}))assert.equal(canonicalStat(s),out);
 const player={stats:{PTS:20,REB:8,AST:4,MIN:33},team:'BOS',name:'Test'};
 assert.equal(statValue(player.stats,'PRA'),32);assert.equal(gradePick({stat:'PRA',line:32,side:'MORE'},player).result,'PUSH');
 assert.equal(gradePick({stat:'PRA',line:31.5,side:'MORE'},player).result,'WIN');
 assert.equal(gradePick({stat:'PRA',line:33.5,side:'LESS'},player).result,'WIN');
});
test('miss, void and unverified rows are not invented losses',()=>{
 const p={stat:'Points',line:9.5,side:'MORE'};
 assert.equal(gradePick(p,{stats:{PTS:6,MIN:11}}).result,'LOSS');
 assert.equal(gradePick(p,{dnp:true,stats:{PTS:null}}).result,'VOID');
 assert.equal(gradePick(p,null).result,'UNVERIFIED');
 const s=summaries([{board:'Top 10 MORE',result:'WIN',side:'MORE'},{board:'Top 10 MORE',result:'VOID',side:'MORE'},{board:'Top 10 LESS',result:'LOSS',side:'LESS'},{board:'Bottom 10',result:'WIN',side:'MORE'}]);
 assert.equal(s.recommended.hitRate,50);assert.equal(s.bottom.wins,1);assert.equal(s.recommended.voids,1);
});
test('never freeze a wrong opponent or already tipped game',()=>{
 const date=Date.now();const board={top10More:[{player:'S Test',team:'BOS',opponent:'NYK',stat:'Points',line:11.5,recommendation:{tier:'LEAN',score:61}}],games:[{away:'BOS',home:'NYK',tipoff:new Date(date+60*60000).toISOString(),completed:false}]};
 assert.equal(pretipCandidates(board,new Date(date)).length,1);
 board.games[0].tipoff=new Date(date-60000).toISOString();assert.equal(pretipCandidates(board,new Date(date)).length,0);
 board.games[0].tipoff=new Date(date+60*60000).toISOString();board.top10More[0].opponent='LAL';assert.equal(pretipCandidates(board,new Date(date)).length,0);
});
test('official box-score player matching requires team identity',()=>{
 const arr=extractESPNPlayers({boxscore:{players:[{team:{abbreviation:'BOS'},statistics:[{labels:['MIN','FG','3PT','FT','REB','AST','PTS'],athletes:[{athlete:{displayName:'A Example',id:'123'},stats:['31','7-11','2-4','4-5','8','3','20']}]}]}]}});
 assert.equal(arr.length,1);assert.equal(arr[0].stats.FGA,11);assert.equal(arr[0].stats['3PM'],2);assert.equal(arr[0].stats['2PM'],5);
 assert.equal(matchPlayer({player:'A Example',team:'BOS'},arr).id,'123');assert.equal(matchPlayer({player:'A Example',team:'NYK'},arr),null);
});

test('new 2.7 WATCH / LEAN candidates are captured as research rather than fabricated bets',()=>{
 const date=Date.now();
 const mk=(board,tier,side)=>({player:'Player '+board,team:'NYK',opponent:'BOS',stat:'Points',line:17.5,side,
  state:'RESEARCH ONLY',recommendation:{tier:'PASS',entryReady:false},researchRank:{tier,score:61,eligible:true,lineFresh:true,coverage:'LIMITED'}});
 const board={top10More:[mk('MORE','WATCH','MORE')],top10Less:[mk('LESS','LEAN','LESS')],bottom10:[mk('COUNTER','PASS','MORE')],
  games:[{home:'BOS',away:'NYK',tipoff:new Date(date+50*60000).toISOString(),completed:false}]};
 const picks=pretipCandidates(board,new Date(date));
 assert.equal(picks.filter(x=>x.board!=='Bottom 10').length,2);
 assert.ok(picks.some(x=>x.tier==='WATCH'));
 assert.ok(picks.every(x=>x.line===17.5));
 assert.ok(picks.some(x=>x.board==='Bottom 10'&&x.tier==='COUNTERCHECK'));
});
