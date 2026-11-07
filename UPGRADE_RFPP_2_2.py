#!/usr/bin/env python3
"""Apply RFPP 2.2 to checkout AFTER RFPP 2.1; idempotent / strict anchors."""
from pathlib import Path
ROOT=Path(__file__).resolve().parent

def put(file,old,new):
 p=ROOT/file; a=p.read_text()
 if new in a:return
 if a.count(old)!=1:raise RuntimeError(f'{file}: expected 1 anchor, got {a.count(old)}: {old[:90]!r}')
 p.write_text(a.replace(old,new,1));print('Updated',file)
def insert(file,old,addition):
 p=ROOT/file; a=p.read_text()
 if addition in a:return
 if a.count(old)!=1:raise RuntimeError(f'{file}: expected 1 injection anchor, got {a.count(old)}: {old[:70]!r}')
 p.write_text(a.replace(old,addition+old,1));print('Injected into',file)

assert (ROOT/'lib/edge-v4.mjs').exists(), 'Missing lib/edge-v4.mjs; extract full ZIP'
assert (ROOT/'lib/public-dvp.mjs').exists(), 'Missing lib/public-dvp.mjs; extract full ZIP'
# Public opponent DvP downloaded only for CURRENT slate, and cached 6h;
# failure is shown as unverified, rather than inventing a score.
insert('lib/context.mjs',"import {normalizeTeam} from './model.mjs';", "import {getPublicDvp} from './public-dvp.mjs';\n")
put('lib/context.mjs',
 " if(inj.status==='fulfilled'||odds.status==='fulfilled')cache.set(day,{at:Date.now(),value});",
 "  try{value.publicDvp=await getPublicDvp({day});}catch(e){value.publicDvp={available:false,reason:String(e.message||e)}}\n"
 "  if(inj.status==='fulfilled'||odds.status==='fulfilled')cache.set(day,{at:Date.now(),value});")

insert('lib/decision.mjs', "import {directionalEvidence} from './edge-v3.mjs';", "import {enhancedEvidence} from './edge-v4.mjs';\nimport {externalMatchup} from './public-dvp.mjs';\n")
put('lib/decision.mjs',
 "  const pos=suppliedPos||(rosters[r.team]||[]).find(x=>String(x.id)===String(r.playerId))?.pos||null;",
 "  const pos=suppliedPos||lineup?.pos||(rosters[r.team]||[]).find(x=>String(x.id)===String(r.playerId))?.pos||null;")
put('lib/decision.mjs',
 "  const defenseGrade=defenseMatchup(dvp,{opponent:r.opponent,pos,stat:r.stat,zoneScore:r.zoneScore});",
 "  const publishedDvp=externalMatchup(context.publicDvp,{opponent:r.opponent,pos,stat:r.stat});\n"
 "  const defenseGrade=publishedDvp||defenseMatchup(dvp,{opponent:r.opponent,pos,stat:r.stat,zoneScore:r.zoneScore});")
put('lib/decision.mjs',
 "  const edge=directionalEvidence({...r,v2},{defenseGrade});",
 "  const edge=enhancedEvidence({...r,v2},{defenseGrade,rest,latestOdds:game?.odds});")
put('lib/decision.mjs',
 "defenseGrade.available?`${defenseGrade.primary} · allows ${defenseGrade.allowedAverage} ${r.stat} per ${defenseGrade.position} player (${defenseGrade.sample} observations) · matchup ${defenseGrade.grade}`:",
 "defenseGrade.available?(defenseGrade.sourceUrl?`${defenseGrade.primary} · ${defenseGrade.allowedAverage} ${r.stat} allowed per game to ${defenseGrade.position} position (season table, not player forecast)`:`${defenseGrade.primary} · ${defenseGrade.allowedAverage} ${r.stat} per player (${defenseGrade.sample} observations)`):")
put('lib/decision.mjs',
 "check('Defense vs position',defenseGrade.available?'proxy':'pending',",
 "check('Defense vs position',defenseGrade.available?(defenseGrade.proxy?'proxy':'observed'):'pending',")
put('lib/decision.mjs',
 "'ESPN prior opponent box scores (G/F/C proxy)',null,'https://www.fantasypros.com/nba/defense-vs-position.php'),",
 "defenseGrade.source||'ESPN prior opponent box scores (position proxy)',defenseGrade.updatedAt||null,defenseGrade.sourceUrl||'https://www.fantasypros.com/nba/defense-vs-position.php'),")
put('lib/decision.mjs',
 "scoreVersion:'RFPP 2.1 · directional evidence + separate readiness gates',",
 "scoreVersion:'RFPP 2.2 · additional stat-specific opportunity, median, role stability, combined stats + public exact DvP',")
put('lib/decision.mjs',
 "scoringVersion:'2.1-directional-evidence',warning:",
 "scoringVersion:'2.2-expanded-evidence',warning:")

insert('lib/rotowire.mjs',"import {directionalEvidence} from './edge-v3.mjs';", "import {enhancedEvidence} from './edge-v4.mjs';\n")
put('lib/rotowire.mjs',
 "  const edge=directionalEvidence({...r,v2},{defenseGrade:r.defenseGrade,rotowire});",
 "  const edge=enhancedEvidence({...r,v2},{defenseGrade:r.defenseGrade,rotowire,rest:r.rest,latestOdds:r.latestOdds});")
put('lib/rotowire.mjs',
 "scoreVersion:'RFPP 2.1 · RotoWire directional corroboration (not final verification)'",
 "scoreVersion:'RFPP 2.2 · RotoWire + robust threshold requirement + role stability'")
put('lib/rotowire.mjs',
 "scoringVersion:'2.1-directional-roto'",
 "scoringVersion:'2.2-expanded-directional-roto'")

put('public/index.html',
 'SMART NBA RESEARCH · RFPP 2.1',
 'SMART NBA RESEARCH · RFPP 2.2')
put('public/index.html',
 '<option value="PROMISING">Priority / promising only</option>',
 '<option value="PROMISING">Priority / promising only</option><option value="ALIGNED">Historical + RotoWire agree</option><option value="EXACT_DVP">Exact position matchup available</option>')
put('public/index.html',
 'Separate statistical evidence from verification readiness. Filter promising MORE/LESS props, compare normalized baseline gaps, and see exact-position DvP only when sourced.',
 'Compare median and volatility, minutes and usage proxies, exact PG/SG/SF/PF/C defense, RotoWire agreement and stat combinations. Filter strong evidence without confusing it with verified payout value.')
put('public/clean.js',
 " if(direction==='PROMISING')pool=pool.filter(x=>['PRIORITY','PROMISING'].includes(x.edge?.tier)&&x.state!=='PASS');",
 " if(direction==='PROMISING')pool=pool.filter(x=>['PRIORITY','PROMISING'].includes(x.edge?.tier)&&x.state!=='PASS');\n"
 " if(direction==='ALIGNED')pool=pool.filter(x=>x.edge?.modelAgrees&&x.state!=='PASS');\n"
 " if(direction==='EXACT_DVP')pool=pool.filter(x=>x.defenseGrade?.available&&!x.defenseGrade.proxy&&x.state!=='PASS');")
put('public/clean.js',
 "  ${c.edge?'<h4>Direction separation (not hit probability)</h4><div class=\"tag-row\">'+Object.entries(c.edge.components||{}).map(([k,v])=>'<span class=\"tag\">'+esc(k)+' '+esc(v)+'</span>').join('')+'</div><p class=\"review-note\">'+esc(c.edge.readiness)+' · '+esc((c.edge.warnings||[]).join('; '))+'</p>':''}",
 "  ${c.edge?'<h4>Direction separation (not hit probability)</h4><div class=\"tag-row\">'+Object.entries({...c.edge.components,...c.edge.extraComponents}||{}).map(([k,v])=>'<span class=\"tag\">'+esc(k)+' '+esc(v)+'</span>').join('')+'</div><p class=\"review-note\">'+esc(c.edge.readiness)+' · '+esc((c.edge.additionalReasons||[]).join('; '))+' · '+esc((c.edge.warnings||[]).join('; '))+'</p>':''}")
put('public/clean.js',
 '· exact PG/SG/SF/PF/C DvP only if sourced · scores are NOT probabilities',
 '· position-specific public DvP when successfully refreshed · scores are NOT probabilities')
# The clickable detail modal formerly re-derived a broad G/F/C grade, even
# after the Grade Board obtained exact-position DvP. Prefer board evidence,
# and label a missing exact stat/position grade as pending.
put('public/insight-ui.js',
 "const matchup=d.defenseGrade;const lineup=d.lineup||{};const gradeCard=",
 "const matchup=selected?.defenseGrade?.available&&!selected.defenseGrade.proxy?selected.defenseGrade:{available:false,notes:'Exact position matchup not independently sourced.'};const lineup=d.lineup||{};const gradeCard=")
put('public/insight-ui.js',
 "<small>1 toughest; ${matchup?.totalTeams||30} softest · broad G/F/C proxy</small>",
 "<small>${matchup?.sourceUrl?'Public DvP: #1 MOST allowed; #30 LEAST allowed':'#1 toughest; larger rank softer'}</small>")
put('public/insight-ui.js',
 ' const injury=d.injury;const injuryLine=',
 ' const boardEdge=selected?.edge;const boardDefense=selected?.defenseGrade;\n const boardCard=boardEdge?`<h3>RFPP 2.2 directional evidence for ${esc(selected.side)} <small>not probability</small></h3><div class="insight-kpis"><div><b>${esc(boardEdge.score)}</b><span>EVIDENCE /100</span><small>${esc(boardEdge.tier)} · ${esc(boardEdge.label)}</small></div><div><b>${esc(boardEdge.normalizedMargin??\'—\')}</b><span>BASELINE VOLATILITY UNITS</span><small>Not a hit probability</small></div><div><b>${esc(boardEdge.median10??\'—\')}</b><span>LAST 10 MEDIAN</span><small>Historical box scores</small></div><div><b>${esc(boardEdge.statVolatility??\'—\')}</b><span>STAT STANDARD DEVIATION</span><small>Observed variance</small></div></div><p class="report-disclaimer">${esc(boardEdge.readiness)}. ${esc((boardEdge.additionalReasons||[]).join(\'; \'))}. ${esc((boardEdge.warnings||[]).join(\'; \'))}</p>${boardDefense?.sourceUrl?\'<p class="report-disclaimer">Public position DvP: \'+esc(boardDefense.primary)+\' · fetched \'+esc(fmtDate(boardDefense.updatedAt))+\' · <a href="\'+esc(boardDefense.sourceUrl)+\'" target="_blank" rel="noopener noreferrer">Source</a> (descriptive early-season ranks)</p>\':\'\'}`:\'\';\n const injury=d.injury;const injuryLine=')
put('public/insight-ui.js',
 "$('insightBody').innerHTML=head+inj+teammates+stats+rwSection+context+gradeCard+checkBlock+",
 "$('insightBody').innerHTML=head+boardCard+inj+teammates+stats+rwSection+context+gradeCard+checkBlock+")
put('server.mjs',"version:'2.1.0'","version:'2.2.0'")
put('package.json','"version": "2.1.0"','"version": "2.2.0"')
put('public/index.html','NBA Scout v2.1','NBA Scout v2.2')
put('public/index.html','/clean.css?v=2.1','/clean.css?v=2.2')
put('public/index.html','/clean.js?v=2.1','/clean.js?v=2.2')
print('RFPP 2.2 ready. Run npm test and check deployed /api/status version.')
