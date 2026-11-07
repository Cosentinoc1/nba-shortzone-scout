import {test} from 'node:test';import assert from 'node:assert/strict';
import {statCode,parseCsv,normalizeRows,freshness,rankBoard} from '../lib/props.mjs';
test('Parses PrizePicks sheet CSV including embedded commas and quoted cells',()=>{
 const data=parseCsv('Player,Team,Opponent,Stat,Line,Sides,Prop observed_at\n"Player, Jr",DAL,UTA,Points,19.5,"more, less",2026-11-07T16:00:00Z\n');
 assert.equal(data[0].Player,'Player, Jr');assert.deepEqual(normalizeRows(data)[0].sides,['MORE','LESS']);
});
test('Normalizes combo aliases, omits goblins and missing lines',()=>{
 assert.equal(statCode('Points + Rebounds + Assists'),'PRA');
 assert.equal(statCode('3-Pointers Made'),'3PM');
 const a=normalizeRows([{player:'Test Player',team:'DAL',stat:'Points',line:12.5,tier:'goblin'},{player:'Test Player',team:'DAL',stat:'Points',line:12.5,tier:'standard'},{player:'Test Player',team:'DAL',stat:'Points',line:'',tier:'standard'}]);
 assert.equal(a.length,1);
});
test('Distinguishes old props from fresh observations',()=>{
 let n=Date.parse('2026-11-07T16:00:00Z');
 assert.equal(freshness([{observedAt:'2026-11-04T20:00:00Z'}],n).status,'stale');
 assert.equal(freshness([{observedAt:'2026-11-07T15:00:00Z'}],n).status,'fresh');
 assert.equal(freshness([],n).status,'unverified');
});
test('Empty live sheet never invents picks',()=>{
 const got=rankBoard({rows:[],schedule:[],day:'2026-11-07',rosters:{},gameCache:{},players:[],defense:{teams:[]}});
 assert.deepEqual(got.candidates,[]);assert.equal(got.boardCount,0);
});
test('Does not consider completed games eligible current matchups',()=>{
 const got=rankBoard({rows:[{player:'Test',team:'DAL',stat:'Points',line:12.5}],schedule:[{away:'DAL',home:'UTA',completed:true}],day:'2026-11-07',rosters:{},gameCache:{},players:[],defense:{teams:[]}});
 assert.equal(got.matched,0);
});
