import test from 'node:test';
import assert from 'node:assert/strict';
import {auditPlayerHistory} from '../lib/history-integrity-v318.mjs';
function game(id,date,pts=20,extra={}){return {id:String(id),schemaVersion:2,date,teams:['NYK','BOS'],players:[{id:'1',name:'Player One',team:'NYK',played:true,minutes:33,box:{pts,fgm:8,tpm:2,ftm:2,fga:16,tpa:6,reb:5,ast:7,...extra}}]};}
test('same-day and future games never enter previous game logs',()=>{
 const gameCache={a:game(1,'2026-11-09T23:00:00Z'),b:game(2,'2026-11-10T02:00:00Z'),c:game(3,'2026-11-10T23:00:00Z')};
 const a=auditPlayerHistory({gameCache,team:'NYK',playerId:'1',playerName:'Player One',stat:'PTS',day:'2026-11-10'});
 assert.equal(a.playedWithStat,2);assert.equal(a.last20,2);assert.equal(a.warning.includes('Only 2'),true);assert.equal(a.gameLog.some(x=>x.gameId==='3'),false);
});
test('returns honest limited L20 samples and validates ESPN arithmetic',()=>{
 const gameCache=Object.fromEntries(Array.from({length:12},(_,i)=>[String(i),game(i,`2026-10-${String(20+i).padStart(2,'0')}T23:00:00Z`)]));
 const a=auditPlayerHistory({gameCache,team:'NYK',playerId:'1',playerName:'Player One',stat:'PRA',day:'2026-11-10'});
 assert.equal(a.last10,10);assert.equal(a.last20,12);assert.equal(a.last20Complete,false);assert.equal(a.issueCount,0);assert.equal(a.gameLog[0].value,32);
});
test('flags contradictory components without silently rewriting results',()=>{
 const bad=game(5,'2026-11-07T22:00:00Z',34,{fga:10,fgm:12});
 const a=auditPlayerHistory({gameCache:{bad},team:'NYK',playerId:'1',playerName:'Player One',stat:'PTS',day:'2026-11-10'});
 assert.equal(a.status,'CHECK SOURCE');assert.deepEqual(a.issues.map(x=>x.type),['INVALID_SHOOTING_TOTALS','POINTS_ARITHMETIC_MISMATCH']);
});
test('missing combo stat is not a zero or a valid played game for that market',()=>{
 const bad=game(6,'2026-11-07T22:00:00Z',20,{ast:null});
 const a=auditPlayerHistory({gameCache:{bad},team:'NYK',playerId:'1',playerName:'Player One',stat:'PRA',day:'2026-11-10'});
 assert.equal(a.last20,0);assert.equal(a.missingStatCount,1);assert.equal(a.issueCount,0);
});
