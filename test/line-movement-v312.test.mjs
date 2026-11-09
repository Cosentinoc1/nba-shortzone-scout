import test from 'node:test';import assert from 'node:assert/strict';
import {observePlatformLines,explainPlatformMove,resetLineHistoryForTests} from '../lib/line-movement-v312.mjs';
const now=Date.parse('2026-11-09T20:00:00Z'),day='2026-11-09',base={player:'John Doe',team:'LAL',stat:'PTS',side:'MORE'};
test('only real newer observations produce a line movement',()=>{
 resetLineHistoryForTests();
 const a={...base,line:24.5,observedAt:new Date(now-600000).toISOString()};
 const b={...base,line:26.5,observedAt:new Date(now-300000).toISOString()};
 assert.equal(Object.keys(observePlatformLines([a],day,now)).length,0);
 const changed=observePlatformLines([b],day,now);assert.equal(changed['LAL~johndoe~PTS'].delta,2);
 assert.equal(explainPlatformMove(b,changed).strength,'caution');
});
test('stale observations are not promoted as a new market trend',()=>{
 resetLineHistoryForTests();const a={...base,line:24.5,observedAt:new Date(now-10*3600000).toISOString()};
 assert.deepEqual(observePlatformLines([a],day,now),{});
});
test('ledger isolates identical players on different dates',()=>{
 resetLineHistoryForTests();const old={...base,line:24.5,observedAt:new Date(now-600000).toISOString()};
 const later={...base,line:27.5,observedAt:new Date(now-300000).toISOString()};
 observePlatformLines([old],day,now);assert.deepEqual(observePlatformLines([later],'2026-11-10',now),{});
});
