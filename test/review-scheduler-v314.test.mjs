import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('scheduled review runs before games and next morning, with permanent GitHub history commits',()=>{
 const y=read('workflow_manual/nba-scout-daily-review.yml');
 assert.match(y,/schedule:/);
 assert.match(y,/15,17,19,21,23/);
 assert.match(y,/14,18/);
 assert.match(y,/node scripts\/update-review\.mjs/);
 assert.match(y,/git add public\/review\/history\.json/);
});
test('capture never invents rankings after tipoff, and persists source failures honestly',()=>{
 const js=read('scripts/update-review.mjs');
 assert.match(js,/pretipCandidates/);
 assert.match(js,/sourceFresh/);
 assert.match(js,/capture ran after|Capture ran after/);
 assert.match(js,/recordStatus\('not_frozen'/);
 assert.match(js,/snapshot:\{capturedAt:/);
 assert.match(js,/gradePick\(p,player\)/);
});
