import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeParlayRows } from '../lib/propFeed.mjs';
const sample = (more = {}) => ({bookmaker:'prizepicks', player:'Nikola Jokic',market_key:'player_assists',line:8.5,odds_type:'standard',period:'FULL',last_update:Date.now(),age_seconds:10,...more});
test('Parlay PrizePicks standard NBA full-game line maps into our research board',()=>{
 const out=normalizeParlayRows([sample()]);
 assert.equal(out.length,1);assert.equal(out[0].team,'DEN');assert.equal(out[0].stat,'AST');assert.equal(out[0].line,8.5);assert.ok(out[0].observedAt);
});
test('Other books, alternate lines, and unverified periods are never mistaken for standard',()=>{
 assert.equal(normalizeParlayRows([sample({bookmaker:'fanduel'}), sample({odds_type:'demon'}), sample({period:'UNKNOWN'}),sample({market_key:'player_blocks'})]).length,0);
});
test('Unknown athlete and missing freshness are not promoted',()=>{
 assert.equal(normalizeParlayRows([sample({player:'Unknown Bogus Name'}),sample({last_update:null,age_seconds:NaN})]).length,0);
});
test('Names with diacritics and combined stat aliases are supported',()=>{
 const out=normalizeParlayRows([sample({player:'Nikola Jokić',market_key:'player_pra',line:47.5})]);
 assert.equal(out[0].stat,'PRA');assert.equal(out[0].team,'DEN');
});
test('Old observations are excluded',()=>{
 assert.equal(normalizeParlayRows([sample({age_seconds:3700})]).length,0);
});
test('Provider key is kept server-side and current PrizePicks standard props load through ParlayAPI', async () => {
 const savedFetch = globalThis.fetch;
 const oldParlay = process.env.PARLAY_API_KEY;
 const oldPP = process.env.PRIZEPICKS_API_KEY;
 const oldCSV = process.env.PROPS_CSV_URL;
 process.env.PARLAY_API_KEY = 'redacted_test_only';
 delete process.env.PRIZEPICKS_API_KEY; delete process.env.PROPS_CSV_URL;
 let urlCheck = null, keyCheck = null;
 globalThis.fetch = async (url,options) => {
  urlCheck=String(url); keyCheck=options.headers['X-API-Key'];
  return {ok:true, headers:{get:(header)=>header==='x-result-has-more'?'false':null},text:async()=>JSON.stringify([sample()])};
 };
 try {
  const {loadPropsFeed,feedStatusOnly} = await import('../lib/propFeed.mjs?integrationtest=1');
  const result=await loadPropsFeed();
  assert.match(urlCheck,/bookmakers=prizepicks/);assert.equal(keyCheck,'redacted_test_only');
  assert.equal(result.rows[0].stat,'AST');assert.equal(result.status,'ok');
  assert.equal(feedStatusOnly(result).rows,undefined);assert.equal(feedStatusOnly(result).count,1);
  assert.equal(JSON.stringify(feedStatusOnly(result)).includes('redacted_test_only'),false);
 } finally {
  globalThis.fetch=savedFetch;
  if(oldParlay===undefined)delete process.env.PARLAY_API_KEY;else process.env.PARLAY_API_KEY=oldParlay;
  if(oldPP===undefined)delete process.env.PRIZEPICKS_API_KEY;else process.env.PRIZEPICKS_API_KEY=oldPP;
  if(oldCSV===undefined)delete process.env.PROPS_CSV_URL;else process.env.PROPS_CSV_URL=oldCSV;
 }
});
