import test from 'node:test';import assert from 'node:assert/strict';import {describeSharedGames,gameKey} from '../public/correlation-v312.mjs';
test('same scheduled game is recognized regardless of home and away ordering',()=>assert.equal(gameKey({team:'BOS',opponent:'NYK'}),gameKey({team:'NYK',opponent:'BOS'})));
test('same-team player props are explicitly flagged for usage collision',()=>{
 const a={team:'BOS',opponent:'NYK',player:'A'},b={team:'BOS',opponent:'NYK',player:'B'};
 assert.match(describeSharedGames(a,[a,b]),/2 on BOS/);
});
test('different-game picks are not called correlated without supporting evidence',()=>{
 const a={team:'BOS',opponent:'NYK'},b={team:'LAL',opponent:'DET'};
 assert.equal(describeSharedGames(a,[a,b]),'');
});
