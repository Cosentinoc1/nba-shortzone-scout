/**
 * NBA Scout v2.0 grading installer — intended to run in the existing
 * GitHub Actions tested-release workflow before committing new app files.
 * Preserves the current v1.9 dashboard, RotoWire upload and frozen snapshots.
 */
import {readFileSync, writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const ZIP='NBA_Scout_v2.0_Grading_Patch.zip';
const read=p=>readFileSync(p,'utf8');
const work=new Map();
function replace(path,oldValue,newValue){
  const src=work.get(path)||read(path);
  if(!src.includes(oldValue))throw Error('Expected v1.9 anchor missing: '+path+' / '+oldValue.slice(0,70));
  work.set(path,src.replace(oldValue,newValue));
}
function edit(path,fn){work.set(path,fn(work.get(path)||read(path)));}
const moduleText=execFileSync('unzip',['-p',ZIP,'lib/grading-v2.mjs'],{encoding:'utf8'});
const testsText=execFileSync('unzip',['-p',ZIP,'test/grading-v2.test.mjs'],{encoding:'utf8'});
if(!moduleText.includes('export function gradePropV2')||!testsText.includes('gradePropV2'))throw Error('Cannot extract expected v2 scoring patch');

// Supply the actual pregame last-ten samples to the v2 grading function.
replace('lib/props.mjs','return {...prop,side,playerId,score,projected:','return {...prop,side,playerId,v2History:hist,score,projected:');
replace('lib/research.mjs','fga:x.box.fga,tpa:x.box.tpa,pts:x.box.pts','fga:x.box.fga,fta:x.box.fta,tpa:x.box.tpa,pts:x.box.pts');

replace('lib/decision.mjs',"import {backToBack} from './insight.mjs';", "import {backToBack} from './insight.mjs';\nimport {gradePropV2} from './grading-v2.mjs';");
replace('lib/decision.mjs','const score=round(clamp(rawScore,0,context.lineupsFetched?88:79));','let score=round(clamp(rawScore,0,context.lineupsFetched?88:79));');
replace('lib/decision.mjs',"const state=hard.length?'PASS':'RESEARCH ONLY';","let state=hard.length?'PASS':'RESEARCH ONLY';");
const v2Decision=[
 '  // Live 2.0 scoring: missing independent evidence cannot become a high-confidence pick.',
 '  let v2=null;',
 '  if(r.v2History){',
 '   v2=gradePropV2({',
 '    prop:{player:r.player,stat:r.stat,line:r.line,observedAt:r.observedAt},side:r.side,hist:r.v2History,',
 '    zone:r.zoneScore==null?null:{score:r.zoneScore},',
 '    // The G/F/C DvP proxy is NOT verified exact-position stat DvP.',
 '    dvp:null,market:{observedAt:r.observedAt,lineVerified:false,offeredSideVerified:false,priceVerified:false}',
 '   });',
 '   score=v2.score;',
 '   hard.push(...v2.hard);',
 "   state=hard.length?'PASS':'RESEARCH ONLY';",
 "   checks.push(check('v2.0 independent grading',v2.hard.length?'veto':'partial',",
 "    v2.hard.length?v2.hard.join('; '):v2.missing.length+' missing source checks; '+v2.warnings.length+' cautions',",
 "    'NBA Scout video-informed RFPP 2.0 scoring hypothesis'));",
 '  }'
].join('\n');
replace('lib/decision.mjs',"  const need=checks.filter(x=>['pending','unverified','veto'].includes(x.state)).length;",v2Decision+"\n  const need=checks.filter(x=>['pending','unverified','veto'].includes(x.state)).length;");
replace('lib/decision.mjs','return {...r,score,state,hard,grade:grade(score),lean,defenseGrade,','return {...r,score,state,hard,grade:grade(score),lean,defenseGrade,v2,');
replace('lib/decision.mjs',"pendingCount:need,scoreVersion:'RFPP v1.8 · contextual evidence not a win probability',","pendingCount:need,scoreVersion:v2?'2.0-hypothesis · source-gated':'RFPP v1.8 · contextual evidence not a win probability',");
replace('lib/decision.mjs','evidence:{...e,defense:','evidence:{...e,v2Components:v2?.components??null,v2Confidence:v2?.confidence??null,defense:');
replace('lib/decision.mjs',"scoringVersion:'1.8-RFPP-source-attributed'","scoringVersion:'2.0-hypothesis-source-gated'");

replace('lib/rotowire.mjs',"import {keyName,normalizeTeam,clamp} from './model.mjs';","import {keyName,normalizeTeam,clamp} from './model.mjs';\nimport {gradePropV2} from './grading-v2.mjs';");
const oldScore='  const score=Math.round(clamp(.60*(Number(r.score)||50)+.28*projectionScore+.12*minutesScore-(historyOpposes?11:0)-(unstableMinutes?8:0),0,88));';
const newScore=[
 '  let score=Math.round(clamp(.60*(Number(r.score)||50)+.28*projectionScore+.12*minutesScore-(historyOpposes?11:0)-(unstableMinutes?8:0),0,88));',
 '  // RotoWire is the independent user-uploaded projection, NOT a confirmed lineup.',
 '  const v2=r.v2History?gradePropV2({',
 '   prop:{player:r.player,stat:r.stat,line:r.line,observedAt:r.observedAt},side:r.side,hist:r.v2History,',
 '   zone:r.zoneScore==null?null:{score:r.zoneScore},',
 "   independent:{source:'User-uploaded RotoWire projected minutes/stats',minutes,stat:forecast,",
 "    roleVerified:r.lineupStatus==='confirmed',injuryVerified:Boolean(r.injuryStatus),",
 "    injuryStatus:r.injuryStatus||'unverified',statusObservedAt:null},",
 '   dvp:null,market:{observedAt:r.observedAt,lineVerified:false,offeredSideVerified:false,priceVerified:false}',
 '  }):null;',
 '  if(v2){score=v2.score;hard.push(...v2.hard)}'
].join('\n');
replace('lib/rotowire.mjs',oldScore,newScore);
replace('lib/rotowire.mjs','return {...r,score,grade:score>=82?', 'return {...r,score,v2,grade:score>=82?');
replace('lib/rotowire.mjs',"scoreVersion:'RFPP 1.9 · RotoWire single-source directional corroboration',","scoreVersion:v2?'2.0-hypothesis · RotoWire source-gated':'RFPP 1.9 · RotoWire single-source directional corroboration',");
replace('lib/rotowire.mjs','evidence:{...e,projection:','evidence:{...e,v2Components:v2?.components??null,v2Confidence:v2?.confidence??null,projection:');
replace('lib/rotowire.mjs',"scoringVersion:'1.9-RFPP-rotowire'","scoringVersion:'2.0-hypothesis-rotowire'");

// Add an explicit independent-evidence breakout to the existing expandable card.
const block=[
 "   ${c.v2?'<h4>v2.0 grading components · research, not win probability</h4><div class=\"tag-row\">'+",
 "   Object.entries(c.v2.components||{}).map(([k,v])=>'<span class=\"tag\">'+esc(k)+' '+esc(v)+'</span>').join('')+",
 "   '</div><p class=\"review-note\">Independent source confidence '+esc(c.v2.confidence)+'/100 · '+esc((c.v2.missing||[]).length)+' checks unverified. '+esc((c.v2.warnings||[]).slice(0,3).join('; ')||'No additional cautions.')+'</p>':''}"
].join('\n');
replace('public/clean.js','<h4>Automatically sourced checks</h4>',block+'\n   <h4>Automatically sourced checks</h4>');
edit('public/index.html',src=>{
 if(!src.includes('NBA Scout v1.9'))throw Error('Expected live v1.9 title missing');
 return src.replaceAll('NBA Scout v1.9','NBA Scout v2.0').replaceAll('?v=1.9','?v=2.0');
});
const pkg=JSON.parse(read('package.json'));
if(pkg.name!=='nba-zone-matchup-scout')throw Error('Unexpected repository app identity; refusing to patch');
pkg.version='2.0.0';delete pkg.scripts.pretest;
work.set('package.json',JSON.stringify(pkg,null,2)+'\n');
work.set('lib/grading-v2.mjs',moduleText);
work.set('test/grading-v2.test.mjs',testsText);
for(const [file,contents] of work)writeFileSync(file,contents,'utf8');
console.log('NBA Scout v2.0 source changes installed; regression suite runs before GitHub commits changes.');
