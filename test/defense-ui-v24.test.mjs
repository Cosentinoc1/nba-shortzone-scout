import test from 'node:test';
import assert from 'node:assert/strict';
import {defenseView} from '../public/defense-ui.mjs';
const example={available:true,proxy:true,position:'PG/SG',positionCandidates:['PG','SG'],stat:'RA',score:15,lessScore:85,grade:'F',lessGrade:'A',range:{more:[8,22],less:[78,92]},source:'Public DvP + positions'};
test('The same matchup is F for MORE and A for LESS; under is favorable',()=>{
 const more=defenseView(example,'MORE'),less=defenseView(example,'LESS');
 assert.equal(more.letter,'F');assert.equal(more.score,15);assert.equal(more.tone,'bad');
 assert.equal(less.letter,'A');assert.equal(less.score,85);assert.equal(less.tone,'good');
 assert.match(less.verdict,/favorable/i);assert.match(less.sourceLabel,/estimate/i);
 assert.match(less.rangeText,/78–92/);assert.match(less.caution,/Confirm the role/);
});
test('Picks with C grade are mixed; D/F never displayed as good',()=>{
 for(const [s,l,tone] of [[50,'D','bad'],[56,'C','mixed'],[70,'B','good'],[81,'A','good']]){
  let r=defenseView({available:true,proxy:false,position:'C',stat:'REB',score:s,lessScore:100-s},'MORE');
  assert.equal(r.letter,l);assert.equal(r.tone,tone);
 }
});
test('Missing or invalid defense never becomes an invented grade',()=>{
 for(const d of [null,{available:false,score:70},{available:true,score:null},{available:true,score:NaN},{available:true,score:101}]){
  const r=defenseView(d,'MORE');assert.equal(r.available,false);assert.equal(r.letter,'—');assert.equal(r.score,null);
 }
});
test('Single-position data is not marked game-day confirmed',()=>{
 const d=defenseView({available:true,proxy:false,position:'C',stat:'REB',score:13,lessScore:87},'LESS');
 assert.equal(d.letter,'A');assert.match(d.sourceQuality,/assignment unconfirmed/);
 assert.doesNotMatch(d.sourceLabel,/estimate/);
});
test('Estimated eligibility has source and range; no win probability claims',()=>{
 const r=defenseView(example,'LESS');
 assert.match(r.sourceQuality,/game-day position unconfirmed/);
 assert.doesNotMatch(JSON.stringify(r),/85%|win probability|guaranteed/i);
});
test('Bad input direction defaults to MORE and optional score is safely handled',()=>{
 const a=defenseView(example,'WHAT');assert.equal(a.side,'MORE');assert.equal(a.score,15);
 const b=defenseView({available:true,score:'40',lessScore:60,position:'SG'},'LESS');assert.equal(b.letter,'C');
});
