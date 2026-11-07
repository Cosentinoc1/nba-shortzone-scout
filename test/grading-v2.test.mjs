import test from 'node:test';
import assert from 'node:assert/strict';
import {gradePropV2} from '../lib/grading-v2.mjs';
const now=Date.parse('2026-11-07T19:00:00Z');
const prop={player:'Sample Player',stat:'PTS',line:18.5,observedAt:'2026-11-07T18:30:00Z'};
const rows=[{minutes:30,fga:16,fta:4,pts:20,reb:6,ast:4,stat:20},{minutes:31,fga:16,fta:5,pts:20,reb:6,ast:5,stat:20},{minutes:32,fga:18,fta:5,pts:22,reb:6,ast:5,stat:22},{minutes:32,fga:17,fta:6,pts:21,reb:7,ast:4,stat:21},{minutes:31,fga:16,fta:5,pts:20,reb:7,ast:5,stat:20},{minutes:30,fga:15,fta:4,pts:19,reb:5,ast:4,stat:19},{minutes:30,fga:14,fta:4,pts:18,reb:5,ast:4,stat:18},{minutes:30,fga:15,fta:4,pts:18,reb:5,ast:3,stat:18},{minutes:29,fga:14,fta:3,pts:17,reb:5,ast:3,stat:17},{minutes:30,fga:14,fta:4,pts:17,reb:6,ast:3,stat:17}];
const hist={boxscoreGames:10,projectedBaseline:20,opportunity:{minutesL5:31.2,minutesL10:30.5},recent:rows,hitRates:{last10:{win:6,loss:4,push:0}}};
const market={lineVerified:true,offeredSideVerified:true,priceVerified:true};
const src={source:'RotoWire user-provided export',minutes:32,stat:22,roleVerified:true,injuryVerified:true,injuryStatus:'available'};
const dvp={source:'Position-specific verified chart',verified:true,score:70};
const env={source:'NBA game context',verified:true,score:55};
const score=(p=prop,side='MORE',h=hist,ext={})=>gradePropV2({prop:p,side,hist:h,now, ...ext});
test('Missing externally verified minutes and role never produces a final pick or high grade',()=>{
 const r=score(); assert.equal(r.state,'PROVISIONAL');assert.ok(r.score<=63);assert.ok(r.missing.some(x=>x.includes('Independent projected minutes')));assert.equal(r.scoringVersion,'2.0-hypothesis');
 assert.equal(r.methodology.includes('not P(win)'),true);assert.equal(r.projectionSource,'Historical box-score baseline only');
});
test('Independent projection opposite to selected direction is downgraded',()=>{
 const positive=score(prop,'MORE',hist,{independent:src,dvp,market,environment:env});
 const negative=score(prop,'MORE',hist,{independent:{...src,stat:11},dvp,market,environment:env});
 assert.ok(positive.score>negative.score);assert.ok(negative.score<=52);assert.ok(negative.warnings.some(x=>x.includes('strongly opposes')));
});
test('Exact-line MORE and LESS have opposite projection direction',()=>{
 const more=score(prop,'MORE',hist,{independent:src,dvp,market,environment:env});
 const less=score(prop,'LESS',hist,{independent:src,dvp,market,environment:env});
 assert.ok(more.components.projectionEdge>less.components.projectionEdge);assert.ok(more.score>less.score);
});
test('Different metrics are not treated as same-stat defense evidence',()=>{
 const r=score({...prop,stat:'AST',line:3.5},'MORE',{...hist,projectedBaseline:4.2,hitRates:{last10:{win:6,loss:4}}},
  {independent:{...src,stat:4.5},zone:{score:95},market});
 assert.equal(r.components.matchup,50);assert.ok(r.missing.some(x=>x.includes('Potential assists')));
});
test('Pushes excluded from win rate; tiny sample regresses strongly toward neutral',()=>{
 const h={...hist,hitRates:{last10:{win:1,loss:0,push:9}}};
 const r=score(prop,'MORE',h);
 assert.equal(r.components.form,50); // fewer than three true resolved outcomes
});
test('Missing source for strong baseline does not become verified projection',()=>{
 const h={...hist,projectedBaseline:40};const r=score(prop,'MORE',h);
 assert.equal(r.state,'PROVISIONAL');assert.ok(r.score<=63);assert.ok(r.missing.some(x=>x.includes('sourced independent projection')));
});
test('Old line and unavailable player are hard vetoes, regardless of formula',()=>{
 const stale=score({...prop,observedAt:'2026-11-07T10:00:00Z'},'MORE',hist,{independent:src,dvp,market,environment:env});
 assert.equal(stale.state,'PASS');assert.ok(stale.score<=40);
 const out=score(prop,'MORE',hist,{independent:{...src,injuryStatus:'OUT'},dvp,market,environment:env});
 assert.equal(out.state,'PASS');assert.ok(out.hard.some(x=>x.includes('Unavailable')));
});
test('All missing external checks remain visible and no observed win probability exists',()=>{
 const r=score();assert.equal('winProbability' in r,false);assert.equal('expectedValue' in r,false);
 assert.equal(r.weights.minutesRole,30);assert.equal(r.weights.projectionEdge,25);assert.equal(r.weights.opportunity,20);
 assert.ok(r.missing.some(x=>x.includes('Sportsbook price')));
});
test('Sourced potential assists change assist opportunity without pretending box score is tracking',()=>{
 const pa={...prop,stat:'AST',line:5.5};const h={...hist,projectedBaseline:5.8};
 const a=score(pa,'MORE',h,{tracking:{source:'NBA tracking',verified:true,potentialAssists:14,baselinePotentialAssists:9}});
 const b=score(pa,'MORE',h,{tracking:{source:'NBA tracking',verified:true,potentialAssists:6,baselinePotentialAssists:9}});
 assert.ok(a.components.opportunity>b.components.opportunity);
});
test('Second sourced projection disagreement shows warning instead of being silently averaged',()=>{
 const a=score(prop,'MORE',hist,{independent:src,consensusProjections:[{source:'Independent model B',stat:13}],market});
 assert.ok(a.warnings.some(x=>x.includes('projections disagree')));
});
