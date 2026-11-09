import test from 'node:test';import assert from 'node:assert/strict';import {auditMarket} from '../lib/market-gate-v312.mjs';
const now=Date.parse('2026-11-09T18:00:00Z'),row={player:'A Test',team:'LAL',stat:'PTS',line:24.5,side:'MORE',observedAt:new Date(now-10*60000).toISOString()};
test('never invents market edge without quotes',()=>{const r=auditMarket(row,{now});assert.equal(r.edgeVerified,false);assert.equal(r.status,'MARKET NOT VERIFIED')});
test('flags stale platform lines',()=>{const r=auditMarket({...row,observedAt:new Date(now-180*60000).toISOString()},{now});assert.equal(r.status,'STALE LINE')});
test('even 2 market prices do not prove EV without no-vig/payout',()=>{const mk=(book)=>({player:row.player,team:'LAL',stat:'PTS',line:24.5,side:'MORE',book,americanOdds:-110,observedAt:new Date(now-5*60000).toISOString()});const r=auditMarket(row,{now,quotes:[mk('book A'),mk('book B')]});assert.equal(r.status,'QUOTE CHECK ONLY');assert.equal(r.edgeVerified,false)});
