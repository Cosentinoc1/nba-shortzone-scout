import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('RotoWire overlay uses safe canonical matching and reports exact diagnostic counts',()=>{
 const r=read('lib/rotowire.mjs'),ui=read('public/clean.js');
 assert.match(r,/buildRotoLookup\(data\)/);
 assert.match(r,/findRotoProjection\(lookup,r\)/);
 assert.match(r,/uniquePropsMatched:matchedOffers\.size/);
 assert.match(r,/diagnoseRotoMatch\(/);
 assert.match(r,/rankResearchProp\(adjustedRow,recommendation\)/);
 assert.match(ui,/uniquePropsMatched/);
 assert.match(ui,/rs\.message/);
});
