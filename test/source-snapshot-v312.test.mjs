import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {checkDataQuality} from '../lib/data-quality-v312.mjs';
test('shipped 30-team defensive source arithmetic checks out, while partial player profiles are exposed',()=>{
 const defense=JSON.parse(readFileSync(new URL('../data/defense.json',import.meta.url),'utf8'));
 const players=JSON.parse(readFileSync(new URL('../data/players.json',import.meta.url),'utf8'));
 const q=checkDataQuality({defense,players,asOf:defense.asof,source:defense.source,today:'2026-11-09'});
 assert.equal(q.structuralOk,true,JSON.stringify(q.issues));assert.equal(q.teamCount,30);
 assert.equal(q.leagueFga,q.teamFga);assert.equal(q.fullyVerified,false);
 assert.ok(q.playerTeamCoverage<=30);
});
