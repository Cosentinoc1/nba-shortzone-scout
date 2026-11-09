import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {summarizeDefenseZones,ZONES} from '../public/defense-zones.mjs';
const source=JSON.parse(readFileSync(new URL('../data/defense.json',import.meta.url)));
test('all 30 defensive teams have selectable six-zone comparisons with actual FGA and FG%',()=>{
 assert.equal(source.teams.length,30);
 for(const team of source.teams){
  const view=summarizeDefenseZones(source,team.code);
  assert.equal(view.zones.length,6);
  assert.equal(view.zones.reduce((s,z)=>s+z.fga,0),team.attempts);
  for(const z of view.zones){
   assert.ok(z.fga>=0);
   assert.ok(z.fg>=0&&z.fg<=1);
   assert.ok(z.share>=0&&z.share<=1);
   assert.ok(Math.abs(z.fgDelta-(z.fg-z.leagueFg))<1e-9);
  }
 }
});
test('labels compare percentages and shot share independently, without equating raw FGA with opponent weakness',()=>{
 const data={teams:[{code:'TST',name:'Test',attempts:200,zones:Object.fromEntries(ZONES.map((z,i)=>[z.id,{fga:i===0?60:28,fg:i===0?.72:.3,share:i===0?.3:.14}]))}],league:{zones:Object.fromEntries(ZONES.map(z=>[z.id,{fg:.6,share:.2}]))}};
 const out=summarizeDefenseZones(data,'TST');
 assert.equal(out.zones[0].flag,'WEAK SPOT');
 assert.ok(out.zones.slice(1).every(z=>z.flag==='SMALL SAMPLE'));
 assert.equal(out.weaknesses[0].id,'rim');
 assert.equal(summarizeDefenseZones(data,'NOPE'),null);
});
test('zone sample-size gate flags thin samples instead of confidently calling weaknesses',()=>{
 const d={teams:[{code:'TST',name:'Test',attempts:12,zones:Object.fromEntries(ZONES.map(z=>[z.id,{fga:2,fg:1,share:.25}]))}],league:{zones:Object.fromEntries(ZONES.map(z=>[z.id,{fg:.1,share:.01}]))}};
 const r=summarizeDefenseZones(d,'TST');
 assert.ok(r.zones.every(x=>x.flag==='SMALL SAMPLE'));
 assert.equal(r.weaknesses.length,0);
});
test('main dashboard includes a defense zone tab and its assets / APIs are explicitly served',()=>{
 const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
 const server=readFileSync(new URL('../server.mjs',import.meta.url),'utf8');
 const js=readFileSync(new URL('../public/clean.js',import.meta.url),'utf8');
 assert.match(html,/id="tabZones"/);assert.match(html,/id="zonesPage"/);
 assert.match(html,/defense-zones\.css/);assert.match(html,/defense-zones\.mjs/);
 assert.match(server,/defense-zones\.mjs/);assert.match(server,/defense-zones\.css/);
 assert.match(js,/scout-zones-open/);
});
