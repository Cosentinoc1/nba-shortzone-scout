import test from 'node:test';import assert from 'node:assert/strict';
import {checkDataQuality} from '../lib/data-quality-v312.mjs';
const z=['rim','paint','mid','left','right','above'];
function fixture(){const teams=Array.from({length:30},(_,i)=>({code:'T'+i,zones:Object.fromEntries(z.map(k=>[k,{fga:20,fgm:10,fg:.5,share:1/6}])),attempts:120}));
const league={attempts:3600,zones:Object.fromEntries(z.map(k=>[k,{fga:600,fgm:300,fg:.5,share:1/6}]))};
return {defense:{teams,league,asof:'2026-11-08',source:'source'},players:[],today:'2026-11-09'};}
test('all six zones and league aggregates reconcile',()=>{const q=checkDataQuality(fixture());assert.equal(q.structuralOk,true);assert.equal(q.teamFga,3600)});
test('wrong aggregate is an explicit hard data error',()=>{const f=fixture();f.defense.league.zones.above.fga=599;assert.equal(checkDataQuality(f).structuralOk,false)});
test('incomplete player coverage is disclosed rather than silently treated as complete',()=>{const f=fixture();f.players=[{team:'T1',gp:null}];const q=checkDataQuality(f);assert.equal(q.playerLeaderboardsComplete,false);assert.equal(q.playerTeamCoverage,1);assert.ok(q.warnings.some(w=>w.includes('29/30')===false&&w.includes('1/30')))});
test('future data is not silently accepted for past slate',()=>{const f=fixture();f.today='2026-11-06';assert.equal(checkDataQuality(f).structuralOk,false)});
