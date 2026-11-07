#!/usr/bin/env python3
"""One-use, anchor-checked RFPP 2.4 display patch for NBA Scout v2.3.
All source data and prop ranking logic remain unchanged. No workflows touched.
Runs as npm pretest inside the existing GitHub Auto-Update workflow.
"""
from pathlib import Path
import json
ROOT=Path(__file__).resolve().parent

def change(path,old,new):
    p=ROOT/path
    if not p.exists(): raise RuntimeError(f'{path} missing from existing NBA Scout source')
    data=p.read_text()
    if new in data:
        print('Already patched',path,old[:32]);return
    n=data.count(old)
    if n!=1: raise RuntimeError(f'{path}: expected exactly one source anchor; found {n}: {old[:85]!r}')
    p.write_text(data.replace(old,new,1))
    print('Updated',path,old[:65])

change('public/clean.js',
 'const $=id=>document.getElementById(id);',
 "import {defenseView} from './defense-ui.mjs';\nconst $=id=>document.getElementById(id);")
change('public/insight-ui.js',
 'const $=id=>document.getElementById(id);',
 "import {defenseView} from './defense-ui.mjs';\nconst $=id=>document.getElementById(id);")

# Side-aware card, with a readable verdict and a distinct quality label.
change('public/clean.js',
 '  const ev=c.evidence||{},match=c.defenseGrade||{},directMatch=c.matchupGrade||{},checks=c.sourceChecks||[];',
 '  const ev=c.evidence||{},match=c.defenseGrade||{},directMatch=c.matchupGrade||{},checks=c.sourceChecks||[];\n  const defView=defenseView(match,c.side);')
change('public/clean.js',
 '<div class="grade-band"><span class="matchup-grade">VS DEFENSE <b>${match.available?esc(directMatch.letter||\'—\'):\'—\'}</b><small>${esc(defenseText(match,c.side))}</small></span><span class="grade-status">${esc(c.lean||\'NO LEAN\')}</span></div>',
 '<div class="grade-band"><span class="matchup-grade matchup-${esc(defView.tone)}"><small>DEFENSE MATCHUP FOR ${esc(defView.side)}</small><span class="matchup-result"><b>${esc(defView.letter)}</b><strong>${esc(defView.scoreText)} · ${esc(defView.verdict)}</strong></span><small>${esc(defView.sourceLabel)}</small></span><span class="grade-status">${esc(c.lean||\'NO LEAN\')}</span></div>')
change('public/clean.js',
 '<span class="tag">Opp defense ${esc(ev.defense??\'—\')}/100</span>',
 '<span class="tag">${defView.available?\'Matchup \' + esc(defView.scoreText)+\' for \'+esc(defView.side):\'Matchup not available\'}</span>')
change('public/clean.js',
 '<div class="evidence" hidden><h4>Measured reasons for ranking</h4>',
 '<div class="evidence" hidden><h4>What the matchup means</h4><p class="plain-explanation">${esc(defView.explanation)} ${esc(defView.caution)} This is a defensive trend, not the chance of winning the bet.</p><h4>Measured reasons for ranking</h4>')
change('public/clean.js',
 '  const def=x.defenseGrade||{},direct=x.matchupGrade||{},pos=x.lineupRole||\'\',l10=x.hit10?.sample?`${x.hit10.win}/${x.hit10.sample}`:\'—\';',
 '  const def=x.defenseGrade||{},direct=x.matchupGrade||{},pos=x.lineupRole||\'\',l10=x.hit10?.sample?`${x.hit10.win}/${x.hit10.sample}`:\'—\';\n  const defView=defenseView(def,x.side);')
change('public/clean.js',
 '<small>${esc(x.team)} vs ${esc(x.opponent)} · ${esc(STAT[x.stat]||x.stat)} ${esc(x.line)}${x.rotowire?.matched?\' · RW \'+fmt(x.rotowire.projectedStat)+\' · \'+fmt(x.rotowire.projectedMinutes)+\' min\':\'\'}</small></span>',
 '<small>${esc(x.team)} vs ${esc(x.opponent)} · ${esc(STAT[x.stat]||x.stat)} ${esc(x.line)}${x.rotowire?.matched?\' · RW \'+fmt(x.rotowire.projectedStat)+\' · \'+fmt(x.rotowire.projectedMinutes)+\' min\':\'\'}</small><small class="mobile-matchup matchup-${esc(defView.tone)}">VS DEF ${esc(x.side)}: ${esc(defView.letter)} · ${esc(defView.verdict)} (${esc(defView.sourceLabel)})</small></span>')
change('public/clean.js',
 '<span class="grade-number"><b>${def.available?esc(direct.letter||\'—\'):\'—\'}</b><small>${def.available?(def.proxy?\'POSITION EST.\':\'EXACT VS DEF\'):\'DVP PENDING\'}</small></span>',
 '<span class="grade-number matchup-cell matchup-${esc(defView.tone)}"><b>${esc(defView.letter)}</b><small>VS DEF ${esc(defView.side)}</small><em>${esc(defView.verdict)}</em></span>')
change('public/clean.js',
 'defense:x.evidence?.defense??-1,baseline:',
 'defense:defenseView(x.defenseGrade,x.side).score??-1,baseline:')
change('public/clean.js',
 "$('gradeSummary').textContent=`${pool.length} research directions · ${pool.filter(x=>['PRIORITY','PROMISING'].includes(x.edge?.tier)).length} statistically promising · ${pool.filter(x=>x.edge?.hasModel).length} with independent RotoWire projection · ${d.sourceStatus?.sourcedExact??0} exact matchup directions · ${d.sourceStatus?.sourcedEligibilityEstimates??0} sourced position estimates · scores are NOT probabilities`;",
 "$('gradeSummary').textContent=`${pool.length} directions · Matchup grades follow each pick's MORE/LESS side (A helps, F hurts) · ${d.sourceStatus?.sourcedExact??0} single-position and ${d.sourceStatus?.sourcedEligibilityEstimates??0} position-estimated grades · evidence scores are not win percentages`;")

# Side-aware full source report (the root of the user's F-versus-LESS screenshot).
change('public/insight-ui.js',
 "const matchup=selected?.defenseGrade?.available?selected.defenseGrade:(d.defenseGrade||{available:false,notes:'No source-backed position DvP available.'});const lineup=d.lineup||{};const gradeCard=",
 "const matchup=selected?.defenseGrade?.available?selected.defenseGrade:(d.defenseGrade||{available:false,notes:'No source-backed position DvP available.'});const chosenSide=selected?.side==='LESS'?'LESS':selected?.side==='MORE'?'MORE':d.lean?.side==='LESS'?'LESS':'MORE';const defView=defenseView(matchup,chosenSide);const lineup=d.lineup||{};const gradeCard=")
change('public/insight-ui.js',
 '<h3>Matchup vs defense & lineup evidence</h3>',
 '<h3>Defense matchup for ${esc(defView.side)} · role evidence</h3>')
change('public/insight-ui.js',
 "<b>${matchup?.available?esc(matchup.grade):'—'}</b><span>DEFENSE MATCHUP GRADE</span><small>${matchup?.available?'MORE '+esc(matchup.score)+'/100 · LESS '+esc(matchup.lessScore)+'/100'+(matchup.positionCandidates?' · eligibility proxy':''):'Not scored'}</small>",
 '<b>${esc(defView.letter)}</b><span>GRADE FOR ${esc(defView.side)}</span><small>${esc(defView.scoreText)} · ${esc(defView.verdict)} · not a win probability</small>')
change('public/insight-ui.js',
 '<p class="report-disclaimer">${esc(matchup?.notes||\'Opponent position comparison needs a sourced position; unavailable scores remain blank.\')}. ${esc(lineup.source||\'Lineup source unavailable\')}; source retrieval time is not a guaranteed lineup update time.</p>',
 '<p class="matchup-direction-note"><b>${esc(defView.verdict)} for ${esc(defView.side)}.</b> ${esc(defView.explanation)} ${esc(defView.sourceLabel)}. ${esc(defView.rangeText)} ${esc(defView.caution)}</p><p class="report-disclaimer">This grade describes opponent position-based allowance, not a prediction that this prop will clear. ${esc(defView.oppositeText)} is the opposite-direction reference score. ${esc(lineup.source||\'Lineup source unavailable\')}; source retrieval time does not confirm a game-day role.</p>')
change('public/insight-ui.js','RFPP 2.2 directional evidence for ${esc(selected.side)}','RFPP 2.4 directional evidence for ${esc(selected.side)}')

# Short legend is visible, while expanded explanation is optional; no massive new forms.
change('public/index.html',
 '   <div id="pickSummary" class="summary-line" aria-live="polite">Loading NBA games and player history…</div>',
 '   <div id="pickSummary" class="summary-line" aria-live="polite">Loading NBA games and player history…</div>\n'
 '   <details class="grade-guide"><summary>How to read these picks and defensive grades</summary><p><b>First read MORE or LESS.</b> The defense grade follows that side. <b>A/B</b> favors the chosen side, <b>C</b> is mixed, and <b>D/F</b> works against it. A strong LESS grade means the defense tends to suppress this stat. <b>Position estimate</b> means the exact game-day matchup is unconfirmed. Research scores are not probabilities; pending checks and payout matter.</p></details>')
change('public/index.html',
 '  <div id="gradeSummary" class="summary-line">Loading all graded props…</div>',
 '  <div id="gradeSummary" class="summary-line">Loading all graded props…</div>\n'
 '  <details class="grade-guide"><summary>What do A–F, evidence score, and position estimate mean?</summary><p><b>VS DEF:</b> A/B supports that row’s MORE or LESS direction; C is mixed; D/F is unfavorable. The separate <b>overall evidence score</b> combines history, opportunity and projected role, and is not a predicted win %. Position estimates use published fantasy eligibility and can differ from the real matchup. A high grade is not permission to skip the final injury, minutes, exact-line and payout checks.</p></details>')
change('public/index.html','SMART NBA RESEARCH · RFPP 2.3','SMART NBA RESEARCH · RFPP 2.4')
change('public/index.html','NBA Scout v2.2 · RotoWire Projections & Top 10','NBA Scout v2.4 · Clear MORE / LESS Grades')
change('public/index.html','/clean.css?v=2.2','/clean.css?v=2.4')
change('public/index.html','/clean.js?v=2.2','/clean.js?v=2.4')
change('public/index.html','/insight-ui.js?v=2.0','/insight-ui.js?v=2.4')

# Add styles without removing user's theme.
style='''
/* RFPP 2.4: matchup grades are readable and explicitly oriented to chosen side. */
.grade-guide{margin:10px 0 15px;border:1px solid var(--stroke);border-radius:12px;padding:10px 13px;background:rgba(255,255,255,.018);color:var(--muted)}
.grade-guide summary{font-size:12px;font-weight:800;color:#d7e5fa;cursor:pointer}
.grade-guide p{margin:8px 0 3px;font-size:12px;line-height:1.65}
.matchup-grade{display:flex;flex-direction:column;align-items:flex-start;gap:3px;max-width:100%}
.matchup-grade .matchup-result{display:flex;align-items:baseline;gap:11px;flex-wrap:wrap}
.matchup-grade .matchup-result strong{font-size:12px;color:var(--txt)}
.matchup-grade.matchup-good,.mobile-matchup.matchup-good{border-color:rgba(167,239,128,.5)}
.matchup-grade.matchup-good b,.matchup-cell.matchup-good b,.mobile-matchup.matchup-good{color:#b5f969}
.matchup-grade.matchup-mixed b,.matchup-cell.matchup-mixed b,.mobile-matchup.matchup-mixed{color:#f8d58f}
.matchup-grade.matchup-bad{border-color:rgba(255,142,151,.5);background:rgba(255,142,151,.045)}
.matchup-grade.matchup-bad b,.matchup-cell.matchup-bad b,.mobile-matchup.matchup-bad{color:#ff969e}
.matchup-grade.matchup-missing b,.matchup-cell.matchup-missing b,.mobile-matchup.matchup-missing{color:#a9b5c6}
.grade-item .matchup-cell em{font-size:10px;line-height:1.3;color:var(--muted);font-style:normal;text-align:center}
.mobile-matchup{font-weight:700;color:var(--muted);white-space:normal}
.plain-explanation{font-size:12px;line-height:1.65;color:var(--muted);margin:4px 0 11px}
.matchup-direction-note{font-size:13px;line-height:1.7;color:#c7d5e7;border-top:1px solid var(--stroke);padding-top:12px}
@media(min-width:901px){.mobile-matchup{display:none}}
@media(max-width:900px){.grade-item .matchup-cell em{display:none}}
'''
p=ROOT/'public/clean.css'
if not p.exists(): raise RuntimeError('public/clean.css missing')
if '/* RFPP 2.4: matchup grades' not in p.read_text(): p.write_text(p.read_text()+style)

change('server.mjs',
 "'/insight-ui.js':'insight-ui.js','/clean.css':'clean.css'",
 "'/insight-ui.js':'insight-ui.js','/defense-ui.mjs':'defense-ui.mjs','/clean.css':'clean.css'")
change('server.mjs',"version:'2.3.0'","version:'2.4.0'")
p=ROOT/'package.json'; info=json.loads(p.read_text());info['version']='2.4.0';info.setdefault('scripts',{}).pop('pretest',None);p.write_text(json.dumps(info,indent=2)+'\n')
# Syntax gate before the test suite, so the installer cannot commit broken browser code.
import subprocess
if not (ROOT/'SYNTHETIC_TEST_FIXTURE').exists():
    for f in ['public/clean.js','public/insight-ui.js','public/defense-ui.mjs']:
        subprocess.run(['node','--check',str(ROOT/f)],check=True)
print('RFPP 2.4 clarity patch applied; browser syntax checked. Running full npm suite.')
