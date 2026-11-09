import test from 'node:test';import assert from 'node:assert/strict';import {rankingWeights} from '../lib/research-rank-v27.mjs';
test('minutes and stat opportunities outweigh unadjusted historic hit rates',()=>{
 assert.equal(Object.values(rankingWeights).reduce((a,b)=>a+b,0),100);
 assert.equal(rankingWeights.minutes,24);assert.equal(rankingWeights.opportunity,24);
 assert.ok(rankingWeights.history+rankingWeights.recentClearance<rankingWeights.minutes+rankingWeights.opportunity);
});
