#!/usr/bin/env python3
"""RFPP 2.5 source-anchored changes: no new GitHub workflows; pretest installs once.
Runs in the existing GitHub Auto-Update workflow (same release ZIP process as v2.4).
No API keys, no external writes or hidden auto-betting actions.
"""
from pathlib import Path
import json, subprocess
ROOT=Path(__file__).resolve().parent

def replace(file, old, new):
    p=ROOT/file
    if not p.exists(): raise RuntimeError(f'{file} absent (expected full repository checkout)')
    s=p.read_text()
    # Single occurrence required; never silently apply a patch to a wrong revision.
    if s.count(old)!=1:raise RuntimeError(f'{file}: missing/ambiguous source anchor, {s.count(old)} occurrences: {old[:115]}')
    p.write_text(s.replace(old,new,1))
    print(f'Patched {file}: {old[:60]}')

# Backend: attach explained verdict to every direction; old research score is
# retained separately so existing API consumers, historical tests are intact.
replace('lib/decision.mjs',
 "import {enhancedEvidence} from './edge-v4.mjs';",
 "import {enhancedEvidence} from './edge-v4.mjs';\nimport {assessProp} from './decision-v25.mjs';")
replace('lib/decision.mjs',
 "  if(injuryCaution&&state!=='PASS')lean='HOLD · QUESTIONABLE';\n  return {...r,score,state,hard,grade:grade(score),lean,defenseGrade,v2,edge,readiness:edge.readiness,",
 "  if(injuryCaution&&state!=='PASS')lean='HOLD · QUESTIONABLE';\n"
 "  // New explanation-first verdict: every row, including the opposite MORE/LESS,\n"
 "  // gets an independent assessment. Missing pricing/role never means BET-READY.\n"
 "  const recommendation=assessProp({...r,state,hard,injuryStatus:injuryCurrent?injury?.status||null:null,lineupStatus:lineup?.lineupStatus||'unverified'},\n"
 "   {defenseGrade,rest,latestOdds:game?.odds});\n"
 "  return {...r,score,state,hard,grade:grade(score),lean,defenseGrade,v2,edge,recommendation,readiness:edge.readiness,")
replace('lib/decision.mjs',
 "  scoringVersion:'2.3-sourced-position-ranges',warning:",
 "  scoringVersion:'2.5-explainable-directional-research',warning:")

replace('lib/rotowire.mjs',
 "import {enhancedEvidence} from './edge-v4.mjs';",
 "import {enhancedEvidence} from './edge-v4.mjs';\nimport {assessProp} from './decision-v25.mjs';")
replace('lib/rotowire.mjs',
 "  const e=r.evidence||{},pending=checks.filter(c=>['pending','unverified','veto'].includes(c.state));\n  return {...r,score,v2,edge,readiness:edge.readiness,",
 "  const e=r.evidence||{},pending=checks.filter(c=>['pending','unverified','veto'].includes(c.state));\n"
 "  const recommendation=assessProp({...r,hard,state,rotowire},{rotowire,defenseGrade:r.defenseGrade,rest:r.rest,latestOdds:r.latestOdds});\n"
 "  return {...r,score,v2,edge,recommendation,readiness:edge.readiness,")

# Frontend: Top 10 is genuinely shortlisted based on strong/lean verdicts rather
# than forcing 10 low-evidence names. Sorting & cards use the same new score.
replace('public/clean.js',
 "function effectiveCandidates(){\n const d=state.data||{},kind=state.side;\n const arr=kind==='MORE'?d.topMore:kind==='LESS'?d.topLess:kind==='WORST'?(d.bottom10||d.unfavorable):d.candidates;\n const list=Array.isArray(arr)?arr:[];\n const games=new Map((d.games||[]).map(g=>[g.id,[g.away,g.home]])),target=state.game==='ALL'?null:games.get(state.game);\n return list.filter(c=>c.state!=='PASS'&&(!target||target.includes(c.team))).slice(0,10);\n}",
 "function effectiveCandidates(){\n"
 " const d=state.data||{},kind=state.side;\n"
 " const list=kind==='WORST'?(d.bottom10||d.unfavorable||[]):Array.isArray(d.all)?d.all:[];\n"
 " const games=new Map((d.games||[]).map(g=>[g.id,[g.away,g.home]])),target=state.game==='ALL'?null:games.get(state.game);\n"
 " if(kind==='WORST')return list.filter(c=>c.state!=='PASS'&&(!target||target.includes(c.team))).slice(0,10);\n"
 " const acceptable=new Set(['STRONG','LEAN']);\n"
 " const rows=list.filter(c=>c.state!=='PASS'&&(!target||target.includes(c.team))&&(kind==='WORST'||((kind==='ALL'||c.side===kind)&&acceptable.has(c.recommendation?.tier))));\n"
 " const tier=x=>x.recommendation?.tier==='STRONG'?2:x.recommendation?.tier==='LEAN'?1:0;\n"
 " rows.sort((a,b)=>tier(b)-tier(a)||(b.recommendation?.score??b.score)-(a.recommendation?.score??a.score));\n"
 " const picked=[],seen=new Set();for(const x of rows){const key=x.player.toLowerCase().trim();if(!seen.has(key)){seen.add(key);picked.push(x)}if(picked.length===10)break}return picked;\n}")
replace('public/clean.js',
 " if(!selected.length){$('picksGrid').innerHTML=blank('No eligible Top 10 candidates','Check the line source, injuries and your date filters. The app does not force a pick when evidence is missing.');return;}",
 " if(!selected.length){$('picksGrid').innerHTML=blank('No approved strong leans at these lines','That is a valid PASS: upload current RotoWire projections, verify lineups and current lines, or review all results on the Grade Board. No forced 10-pick card.');return;}")
replace('public/clean.js',
 "  const defView=defenseView(match,c.side);",
 "  const defView=defenseView(match,c.side);\n  const rec=c.recommendation||{},topWhy=rec.helps?.slice(0,2)||[],topRisk=rec.hurts?.slice(0,1)||[];")
replace('public/clean.js',
 '<span class="grade">${esc(c.score)}<small>DIRECTIONAL EVIDENCE / 100</small></span>',
 '<span class="grade">${esc(rec.score??c.score)}<small>RESEARCH SCORE /100 · NOT WIN %</small></span>')
replace('public/clean.js',
 '<h3 class="player-name">${esc(c.player)}</h3><div class="matchup">',
 '<h3 class="player-name">${esc(c.player)}</h3><div class="decision-banner decision-${esc((rec.tier||"PASS").toLowerCase())}"><strong>${esc(rec.status||"NOT YET GRADED")}</strong><p>${esc(rec.summary||"Check full research before choosing a side.")}</p></div><div class="matchup">')
replace('public/clean.js',
 '<span class="grade-status">${esc(c.lean||\'NO LEAN\')}</span>',
 '<span class="grade-status">${esc(rec.confidence||"EVIDENCE COVERAGE UNKNOWN")}</span>')
replace('public/clean.js',
 '  <button class="expand" type="button" aria-expanded="false">Source evidence & remaining checks ＋</button>',
 '  <div class="plain-why"><strong>WHY THIS SIDE?</strong><ul>${topWhy.map(x=>`<li>✓ ${esc(x)}</li>`).join("")||"<li>No multiple independent supporting reasons yet.</li>"}${topRisk.map(x=>`<li class="risk">! ${esc(x)}</li>`).join("")}</ul></div>\n  <button class="expand" type="button" aria-expanded="false">All reasons, risks & sources ＋</button>')
replace('public/clean.js',
 '<div class="evidence" hidden><h4>What the matchup means</h4>',
 '<div class="evidence" hidden><h4>RFPP 2.5 · Why / Why not / What is missing</h4><div class="reason-columns"><section><b>Supporting signals</b><ul>${(rec.helps||[]).map(x=>`<li>✓ ${esc(x)}</li>`).join("")||"<li>No confirmed supporting edge yet.</li>"}</ul></section><section><b>Risk and contradiction</b><ul>${(rec.hurts||[]).map(x=>`<li>! ${esc(x)}</li>`).join("")||"<li>No measured contradiction; unknowns still apply.</li>"}</ul></section><section><b>To verify before betting</b><ul>${(rec.checks||[]).map(x=>`<li>○ ${esc(x)}</li>`).join("")}</ul></section></div><p class="review-note">${esc(rec.method||"Uncalibrated model; no calculated market edge")}</p><h4>What the matchup means</h4>')
# Report: short verdict above dense stats & visible reasons for every direction.
replace('public/insight-ui.js',
 " const boardEdge=selected?.edge;const boardDefense=selected?.defenseGrade;",
 " const rec=selected?.recommendation||null;const summaryCard=rec?`<section class=\"recommendation-panel decision-${esc(rec.tier.toLowerCase())}\"><h3>${esc(rec.status)} <small>RFPP 2.5</small></h3><p>${esc(rec.summary)}</p><div class=\"explanation-cols\"><div><b>WHY ${esc(rec.side)}?</b><ul>${rec.helps.map(x=>`<li>✓ ${esc(x)}</li>`).join('')||'<li>Insufficient corroborating evidence.</li>'}</ul></div><div><b>WHAT COULD FAIL?</b><ul>${rec.hurts.map(x=>`<li>! ${esc(x)}</li>`).join('')||'<li>No measured conflict; availability and price still need checks.</li>'}</ul></div><div><b>WHAT TO VERIFY</b><ul>${rec.checks.slice(0,7).map(x=>`<li>○ ${esc(x)}</li>`).join('')}</ul></div></div><p class=\"report-disclaimer\">Why it scores this way: model projection 30%, history/median 26%, opportunity 18%, defense 10%, minutes 12%, game context 4%. Research weights are untrained hypotheses, not P(win). A strong research candidate is NOT a confirmed positive-value bet.</p></section>`:'';\n const boardEdge=selected?.edge;const boardDefense=selected?.defenseGrade;")
replace('public/insight-ui.js',
 'RFPP 2.4 directional evidence for ${esc(selected.side)}',
 'Earlier RFPP 2.4 audit components for ${esc(selected.side)}')
replace('public/insight-ui.js',
 "$('insightBody').innerHTML=head+boardCard+inj+teammates+stats+rwSection+context+gradeCard+checkBlock+",
 "$('insightBody').innerHTML=head+summaryCard+boardCard+inj+teammates+stats+rwSection+context+gradeCard+checkBlock+")
# Grade Board verdict and sortable scores.
replace('public/clean.js',
 "(includePass||x.state!=='PASS')",
 "(includePass||direction==='ON_HOLD'||x.state!=='PASS')")
replace('public/clean.js',
 "if(direction==='PROMISING')pool=pool.filter(x=>['PRIORITY','PROMISING'].includes(x.edge?.tier)&&x.state!=='PASS');",
 "if(direction==='PROMISING')pool=pool.filter(x=>x.recommendation?.tier==='STRONG'&&x.state!=='PASS');\n"
 " if(direction==='RESEARCH')pool=pool.filter(x=>['STRONG','LEAN'].includes(x.recommendation?.tier)&&x.state!=='PASS');\n"
 " if(direction==='ON_HOLD')pool=pool.filter(x=>['HOLD','PASS','VETO'].includes(x.recommendation?.tier));")
replace('public/clean.js',
 "direction==='ALL'||direction==='BEST'||x.side===direction",
 "direction==='ALL'||direction==='BEST'||direction==='PROMISING'||direction==='RESEARCH'||direction==='ON_HOLD'||direction==='ALIGNED'||direction==='EXACT_DVP'||direction==='ANY_DVP'||x.side===direction")
replace('public/clean.js',
 "if(!old||x.score>old.score)best.set(k,x)",
 "if(!old||(x.recommendation?.score??x.score)>(old.recommendation?.score??old.score))best.set(k,x)")
replace('public/clean.js',
 "score:x.score,defense:",
 "score:x.recommendation?.score??x.score,defense:")
replace('public/clean.js',
 "  const defView=defenseView(def,x.side);",
 "  const defView=defenseView(def,x.side);const rec=x.recommendation||{};")
replace('public/clean.js',
 '<small class="mobile-matchup matchup-${esc(defView.tone)}">',
 '<small class="verdict-row decision-${esc((rec.tier||"PASS").toLowerCase())}">${esc(rec.status||"NO VERDICT")}</small><small class="mobile-matchup matchup-${esc(defView.tone)}">')
replace('public/clean.js',
 'class="grade-item edge-${esc((x.edge?.tier||"NEUTRAL").toLowerCase())}"',
 'class="grade-item edge-${esc((rec.tier||"NEUTRAL").toLowerCase())}"')
replace('public/clean.js',
 '<span class="grade-number"><b>${esc(x.score)}</b><small>EVIDENCE</small></span>',
 '<span class="grade-number"><b>${esc(rec.score??x.score)}</b><small>RFPP 2.5 SCORE</small></span>')
replace('public/clean.js',
 "$('gradeSummary').textContent=`${pool.length} directions · Matchup grades follow each pick's MORE/LESS side (A helps, F hurts) · ${d.sourceStatus?.sourcedExact??0} single-position and ${d.sourceStatus?.sourcedEligibilityEstimates??0} position-estimated grades · evidence scores are not win percentages`;",
 "$('gradeSummary').textContent=`${pool.length} directions · ${pool.filter(x=>x.recommendation?.tier==='STRONG').length} strong research candidates · ${pool.filter(x=>x.recommendation?.tier==='LEAN').length} leans · ${pool.filter(x=>['HOLD','VETO'].includes(x.recommendation?.tier)).length} held/vetoed · no score is a predicted win percentage`;")
# Prefer clear defaults; the list still supports all directions and no hidden bets.
replace('public/index.html',
 '<option value="PROMISING">Priority / promising only</option>',
 '<option value="PROMISING">Strong research candidates</option><option value="RESEARCH">Strong + lean (actionable shortlist)</option><option value="ON_HOLD">Hold / Pass / Veto (why not)</option>')
replace('public/index.html',
 '<option value="score">Overall evidence grade</option>',
 '<option value="score">RFPP 2.5 research score (not win %)</option>')
replace('public/index.html',
 'Compare median and volatility, minutes and usage proxies, exact PG/SG/SF/PF/C defense, RotoWire agreement and stat combinations.',
 'See STRONG MORE, STRONG LESS, LEAN, HOLD and PASS with clear reasons. Compare minutes, projected output, historical volatility, offensive opportunities, and exact/opponent position defense.')
replace('public/index.html',
 'SMART NBA RESEARCH · RFPP 2.4',
 'SMART NBA RESEARCH · RFPP 2.5')
replace('public/index.html',
 'NBA Scout v2.4 · Clear MORE / LESS Grades',
 'NBA Scout v2.5 · Explainable MORE / LESS Research')
for old,new in [('/clean.css?v=2.4','/clean.css?v=2.5'),('/clean.js?v=2.4','/clean.js?v=2.5'),('/insight-ui.js?v=2.4','/insight-ui.js?v=2.5')]:replace('public/index.html',old,new)
# Existing site CSS, no extra image assets or UI framework.
css='''
/* RFPP 2.5: decision-first, readable on Android and desktop. */
.decision-banner{border:1px solid #40536b;border-left:4px solid #7794b5;background:#1b2a3b;border-radius:11px;margin:12px 0;padding:11px 12px}
.decision-banner strong{display:block;letter-spacing:.3px;font-size:13px}
.decision-banner p{margin:4px 0 0;font-size:12px;color:#c6d2e2;line-height:1.6}
.decision-strong{border-color:#50783c;background:#1a2d24}
.decision-strong strong,.decision-strong .verdict-row{color:#cbfca7}
.decision-lean{border-color:#927748;background:#302c1d}
.decision-lean strong{color:#f8da9a}
.decision-hold,.decision-veto{border-color:#a35b60;background:#312128}
.decision-hold strong,.decision-veto strong{color:#ffabb2}
.decision-pass{border-color:#3a4357;background:#172034}
.plain-why{margin:12px 0;padding:10px 12px;border:1px solid #354c57;border-radius:11px;background:rgba(144,186,156,.035)}
.plain-why>strong{font-size:11px;letter-spacing:.6px;color:#c2dfca}
.plain-why ul{padding-left:18px;margin:6px 0 0;color:#cdd8e9;font-size:11px;line-height:1.7}
.plain-why li.risk{color:#e7bac0}
.reason-columns,.explanation-cols{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
.reason-columns section,.explanation-cols>div{padding:12px;border-radius:10px;background:#18253a;border:1px solid #2d4357}
.reason-columns b,.explanation-cols b{font-size:12px;color:#d8e5f7}
.reason-columns ul,.explanation-cols ul{padding-left:17px;font-size:11px;line-height:1.75;color:#b9cadd}
.recommendation-panel{border:1px solid #465a75;border-left:4px solid #647a9f;padding:14px;margin:14px 0;border-radius:12px;background:#13213a}
.recommendation-panel h3{font-size:18px;margin:0 0 6px}
.recommendation-panel h3 small{font-size:11px;color:#a5b4ca}
.recommendation-panel>p{font-size:13px;color:#cad5e6;line-height:1.6}
.verdict-row{display:block;color:#ccf1bd;font-size:10px;font-weight:800;text-transform:uppercase;white-space:normal}
@media(max-width:730px){.reason-columns,.explanation-cols{grid-template-columns:1fr}.decision-banner p{font-size:12px}}
'''
p=ROOT/'public/clean.css'
if '/* RFPP 2.5: decision-first' not in p.read_text():p.write_text(p.read_text()+css)
# Preserve existing workflow: only package version; no installs that mutate GitHub workflows.
replace('server.mjs',"version:'2.4.0'","version:'2.5.0'")
p=ROOT/'package.json';d=json.loads(p.read_text());d['version']='2.5.0';d.setdefault('scripts',{}).pop('pretest',None);p.write_text(json.dumps(d,indent=2)+'\n')
for f in ['lib/decision-v25.mjs','lib/decision.mjs','lib/rotowire.mjs','public/clean.js','public/insight-ui.js']:
    subprocess.run(['node','--check',str(ROOT/f)],check=True)
print('RFPP 2.5 patched; Node syntax checks passed. Running all tests via npm test.')
