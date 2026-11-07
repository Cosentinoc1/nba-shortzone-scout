import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseSnapshotCsv,parsePublishedHtml,getPublishedPositions,publishedMatchup} from '../lib/published-positions.mjs';
import {readFile} from 'node:fs/promises';
const today='2026-11-07',now=Date.parse('2026-11-07T20:00:00Z');
const failed=async()=>{throw Error('network blocked')};
const get=async()=>getPublishedPositions({day:today,now,fetcher:failed});
test('Bundled snapshot contains 240+ sourced positions and exact team/name matches',async()=>{
 const csv=await readFile(new URL('../data/nba_fantasy_positions_2026.csv',import.meta.url),'utf8');
 const p=parseSnapshotCsv(csv);assert.ok(p.count>=240,p.count);
 assert.deepEqual(p.entries['POR:scoothenderson'].positions,['PG','SG']);
 assert.deepEqual(p.entries['ATL:nickeilalexanderwalker'].positions,['PG','SG']);
 assert.deepEqual(p.entries['PHX:khamanmaluach'].positions,['C']);
 assert.equal(p.entries['LAL:scoothenderson'],undefined);
});
test('Missing live NBA.com response uses sourced Sep 29 snapshot, labelled not game position',async()=>{
 const p=await get();assert.equal(p.available,true);assert.equal(p.live,false);
 assert.equal(p.publishedAt,'2026-09-29');assert.match(p.reason,/snapshot/i);
 assert.match(p.positionSemantics,/not identify the actual position/i);
});
test('No hindsight for games before source publication',async()=>{
 const x=await getPublishedPositions({day:'2026-09-01',now,fetcher:failed});
 assert.equal(x.available,false);
});
test('Real published HTML table parser requires complete coverage and exact role tokens',()=>{
 const base=Array.from({length:240},(_,i)=>`<tr><td>${i+1}</td><td>Player ${i}</td><td>${i%2?'PG,SG':'PF,C'}</td><td>ATL</td></tr>`);
 const p=parsePublishedHtml('<table><tbody>'+base.join('')+'</tbody></table>');
 assert.ok(p.count>=200);assert.deepEqual(p.entries['ATL:player1'].positions,['PG','SG']);
 assert.throws(()=>parsePublishedHtml('<html>blocked</html>'),/table not found/);
});
test('Multi-position defensive grade is proxy with a displayed range, not exact',async()=>{
 const p=await get();const values={};
 for(const pos of ['PG','SG'])values[`SAS|${pos}|PTS`]={team:'SAS',position:pos,stat:'PTS',rankMostAllowed:pos==='PG'?3:27,value:pos==='PG'?28:16};
 for(const pos of ['PG','SG'])values[`SAS|${pos}|REB`]={team:'SAS',position:pos,stat:'REB',rankMostAllowed:pos==='PG'?6:28,value:pos==='PG'?6:3};
 const dvp={available:true,values,source:'sourced',url:'https://example.com',updatedAt:'2026-11-07T18:00:00Z',statsLoaded:['PTS','REB']};
 const d=publishedMatchup(dvp,p,{team:'POR',player:'Scoot Henderson',opponent:'SAS',stat:'PR'});
 assert.equal(d.available,true);assert.equal(d.proxy,true);
 assert.deepEqual(d.positionCandidates,['PG','SG']);assert.ok(d.range.more[1]>d.range.more[0]);assert.equal(d.score+d.lessScore,100);
 assert.match(d.notes,/Verify lineup/);assert.equal(d.sourceUrl,'https://example.com');
 // A missing candidate must not cherry-pick the most favorable role.
 delete values['SAS|SG|REB'];assert.equal(publishedMatchup(dvp,p,{team:'POR',player:'Scoot Henderson',opponent:'SAS',stat:'PR'}),null);
});
test('Wrong team or missing stat gives no invented defensive grade',async()=>{
 const p=await get();const dvp={available:true,values:{},source:'test'};
 assert.equal(publishedMatchup(dvp,p,{team:'LAL',player:'Scoot Henderson',opponent:'SAS',stat:'PTS'}),null);
 assert.equal(publishedMatchup(dvp,p,{team:'ATL',player:'Unknown Player',opponent:'BKN',stat:'AST'}),null);
});
