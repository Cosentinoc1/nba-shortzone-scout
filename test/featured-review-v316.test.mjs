import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('Featured picks have a separately timestamped pretip archive and official postgame audit',()=>{
 const script=read('scripts/update-review.mjs');
 assert.match(script,/const featured=\{top2:/);
 assert.match(script,/snapshot:\{capturedAt:now\.toISOString\(\), qualified, picks:pickList, featured,/);
 assert.match(script,/featuredInput/);assert.match(script,/featuredTop2/);
 assert.match(script,/picks:originalResults,summary:summaries\(originalResults\)/);
 assert.match(script,/featured:\{top2:featuredTop2,top5:featuredResults,/);
});
test('Results lab does not quietly add featured history to the baseline Top 10 denominator',()=>{
 const ui=read('public/review/review.js'),page=read('public/review.html');
 assert.match(page,/id="featuredReview"/);assert.match(ui,/function renderFeature/);
 assert.match(ui,/Top 2/);assert.match(ui,/renderFeature\(d\)/);
 assert.match(ui,/NOT added to the Top 10 denominator/);
});
test('v3.16 sources and six-pillar featured UI exist and never call them win probabilities',()=>{
 const s=read('lib/featured-picks-v316.mjs');const ui=read('public/featured-picks-v316.mjs');
 assert.match(s,/buildFeaturedPicks/);assert.match(s,/roleFor/);
 assert.match(s,/sourceCoverage:covered/);assert.match(ui,/Source verification/);
 assert.match(ui,/Top 2/);assert.match(ui,/Top 5/);
 assert.match(ui,/not a calibrated chance of winning/);
});
