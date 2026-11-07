#!/usr/bin/env python3
"""Patch an existing NBA Scout v2.0 checkout without replacing its saved data.

Run from the repository root: python3 UPGRADE_RFPP_2_1.py
Safe to rerun; assertions refuse unknown versions rather than silently damaging files.
"""
from pathlib import Path
import re

ROOT=Path(__file__).resolve().parent

def put(file, old, new):
    path=ROOT/file
    data=path.read_text()
    if new in data:
        return False
    count=data.count(old)
    if count!=1:
        raise RuntimeError(f'{file}: expected one code anchor, found {count}: {old[:90]!r}')
    path.write_text(data.replace(old,new,1))
    print('Updated',file,':',old[:54].replace('\n',' '))
    return True

def insert(file, anchor, before):
    path=ROOT/file
    data=path.read_text()
    if before in data:return False
    if data.count(anchor)!=1:raise RuntimeError(f'{file}: missing unique injection anchor {anchor[:60]}')
    path.write_text(data.replace(anchor,before+anchor,1))
    print('Injected',file)
    return True

assert (ROOT/'lib/edge-v3.mjs').exists(), 'Missing lib/edge-v3.mjs (extract full release first)'
assert (ROOT/'lib/dvp.mjs').exists(), 'Missing lib/dvp.mjs'

# 1. Give the existing verification response direction-aware scoring and keep the
# old v2 hypothesis breakdown for transparency. The score is NOT capped at 63
# merely because readiness checks are outstanding; readiness is separate.
insert('lib/decision.mjs',"const norm=x=>keyName(x||'');", "import {directionalEvidence} from './edge-v3.mjs';\n")
put('lib/decision.mjs',
    'export function applyVerification({board,context={},gameCache={},rosters={},defense={},day,limit=10}){',
    'export function applyVerification({board,context={},gameCache={},rosters={},defense={},day,limit=10,positionOverrides=[]}){')
put('lib/decision.mjs',
    'const dvp=buildDvpIndex(gameCache,rosters,day),injuries=context.injuries||[];',
    'const dvp=buildDvpIndex(gameCache,rosters,day,{positionOverrides}),injuries=context.injuries||[];')
put('lib/decision.mjs',
    "const pos=(rosters[r.team]||[]).find(x=>String(x.id)===String(r.playerId))?.pos||null;",
    "const suppliedPos=positionOverrides.find(x=>x.team===r.team&&norm(x.name)===norm(r.player))?.pos;\n"
    "  const pos=suppliedPos||(rosters[r.team]||[]).find(x=>String(x.id)===String(r.playerId))?.pos||null;")
insert('lib/decision.mjs',
       "  const need=checks.filter(x=>['pending','unverified','veto'].includes(x.state)).length;",
       "  // RFPP 2.1: show useful statistical separation without pretending pending\n"
       "  // role/odds/lineup checks are already cleared.\n"
       "  const edge=directionalEvidence({...r,v2},{defenseGrade});\n"
       "  score=edge.score;\n")
put('lib/decision.mjs',
    "  const validLean=state!=='PASS'&&r.margin>0&&score>=59&&r.hit10?.sample>=5&&!injuryCaution;\n"
    "  let lean=validLean?`${trackingDependent?'WATCH':'PROVISIONAL'} ${r.side}`:(state==='PASS'?'VETO / PASS':'NO STRONG LEAN');",
    "  let lean=state==='PASS'?'VETO / PASS':edge.label;")
put('lib/decision.mjs',
    'return {...r,score,state,hard,grade:grade(score),lean,defenseGrade,v2,',
    'return {...r,score,state,hard,grade:grade(score),lean,defenseGrade,v2,edge,readiness:edge.readiness,')
put('lib/decision.mjs',
    "scoreVersion:v2?'2.0-hypothesis · source-gated':'RFPP v1.8 · contextual evidence not a win probability',",
    "scoreVersion:'RFPP 2.1 · directional evidence + separate readiness gates',")
put('lib/decision.mjs',
    "scoringVersion:'2.0-hypothesis-source-gated',warning:",
    "scoringVersion:'2.1-directional-evidence',warning:")

# 2. RotoWire projection now creates model/historical agreement or an explicit
# conflict. Missing role verification still prevents a final bet recommendation.
insert('lib/rotowire.mjs',
       "const numeric=['MIN'",
       "import {directionalEvidence} from './edge-v3.mjs';\n")
put('lib/rotowire.mjs',
    "  const lean=state==='PASS'?'VETO / PASS':unstableMinutes?'HOLD · MINUTES SHIFT':historyOpposes?'HOLD · MODEL/HISTORY CONFLICT':supported&&score>=60?`ROTO + HISTORY ${r.side}`:'NO STRONG LEAN';",
    "  let lean=state==='PASS'?'VETO / PASS':unstableMinutes?'HOLD · MINUTES SHIFT':historyOpposes?'HOLD · MODEL/HISTORY CONFLICT':supported&&score>=60?`ROTO + HISTORY ${r.side}`:'NO STRONG LEAN';")
insert('lib/rotowire.mjs',
       '  const e=r.evidence||{},pending=checks.filter(c=>[',
       "  const edge=directionalEvidence({...r,v2},{defenseGrade:r.defenseGrade,rotowire});\n"
       "  score=edge.score;\n"
       "  lean=state==='PASS'?'VETO / PASS':unstableMinutes?'HOLD · MINUTES SHIFT':historyOpposes?'HOLD · MODEL/HISTORY CONFLICT':!supported?'HOLD · NEEDS ALIGNMENT':edge.label;\n")
put('lib/rotowire.mjs',
    'return {...r,score,v2,grade:',
    'return {...r,score,v2,edge,readiness:edge.readiness,grade:')
put('lib/rotowire.mjs',
    "scoreVersion:v2?'2.0-hypothesis · RotoWire source-gated':'RFPP 1.9 · RotoWire single-source directional corroboration'",
    "scoreVersion:'RFPP 2.1 · RotoWire directional corroboration (not final verification)'")
put('lib/rotowire.mjs',
    "scoringVersion:'2.0-hypothesis-rotowire'",
    "scoringVersion:'2.1-directional-roto'" )

# 3. The one-slate user-uploaded position mapping supplies PG/SG/SF/PF/C
# only when it actually exists; no provider match means NO exact DvP letter.
put('server.mjs',
    "const verified=applyVerification({board:{...base,games:slate},context:ctx,gameCache,rosters,defense,day,limit:10});",
    "const verified=applyVerification({board:{...base,games:slate},context:ctx,gameCache,rosters,defense,day,limit:10,positionOverrides:projected});")

# 4. Keep every current tab, chart, player report, and import control intact.
# Add a meaningful filter, explicit readiness, and readable score labels.
put('public/index.html',
    '<option value="BEST">Best-supported side per prop</option>',
    '<option value="BEST">Best-supported side per prop</option><option value="PROMISING">Priority / promising only</option>')
put('public/index.html',
    'SMART NBA RESEARCH · V1.8',
    'SMART NBA RESEARCH · RFPP 2.1')
put('public/index.html',
    'Sort all supported standard props by overall grade, defense, opportunity, confidence, recent results, or baseline gap.',
    'Separate statistical evidence from verification readiness. Filter promising MORE/LESS props, compare normalized baseline gaps, and see exact-position DvP only when sourced.')
put('public/clean.js',
    " if(direction==='BEST'){",
    " if(direction==='PROMISING')pool=pool.filter(x=>['PRIORITY','PROMISING'].includes(x.edge?.tier)&&x.state!=='PASS');\n if(direction==='BEST'){")
put('public/clean.js',
    "$('gradeSummary').textContent=`${pool.length} displayed research directions · sorted by ${$('gradeSort').selectedOptions[0]?.textContent||'score'} · G/F/C defense scores are proxies · scores are not probabilities`;",
    "$('gradeSummary').textContent=`${pool.length} research directions · ${pool.filter(x=>['PRIORITY','PROMISING'].includes(x.edge?.tier)).length} statistically promising · ${pool.filter(x=>x.edge?.hasModel).length} with independent RotoWire projection · exact PG/SG/SF/PF/C DvP only if sourced · scores are NOT probabilities`;" )
put('public/clean.js',
    'class="grade-item" data-grade-index="${i}"',
    'class="grade-item edge-${esc((x.edge?.tier||"NEUTRAL").toLowerCase())}" data-grade-index="${i}"')
put('public/clean.js',
    "<small>OVERALL</small></span>",
    "<small>EVIDENCE</small></span>")
put('public/clean.js',
    "<small>VS DEF</small></span>",
    "<small>${def.available?'EXACT VS DEF':'DVP PENDING'}</small></span>")
put('public/clean.js',
    "<small>${esc(x.lean||'research')}</small></span>",
    "<small>${esc(x.lean||'research')} · ${esc(x.edge?.normalizedMargin??'—')}σ</small></span>")
put('public/clean.js',
    "<small>EVIDENCE SCORE / 100</small>",
    "<small>DIRECTIONAL EVIDENCE / 100</small>")
# Give the actual formula and reliability gate to each clickable research card.
put('public/clean.js',
    "  <h4>Automatically sourced checks</h4>",
    "  ${c.edge?'<h4>Direction separation (not hit probability)</h4><div class=\"tag-row\">'+Object.entries(c.edge.components||{}).map(([k,v])=>'<span class=\"tag\">'+esc(k)+' '+esc(v)+'</span>').join('')+'</div><p class=\"review-note\">'+esc(c.edge.readiness)+' · '+esc((c.edge.warnings||[]).join('; '))+'</p>':''}\n  <h4>Automatically sourced checks</h4>")

# Highlight statistically promising edges without implying final clearance.
cssfile=ROOT/'public/clean.css'
css=cssfile.read_text()
marker='/* RFPP 2.1 directional shortlist */'
if marker not in css:
    cssfile.write_text(css+"\n"+marker+"\n"+"""
.grade-item.edge-priority {border-color:#93cf59; box-shadow:inset 3px 0 #93cf59;}
.grade-item.edge-promising {border-color:#648f56; box-shadow:inset 3px 0 #82be56;}
.grade-item.edge-conflict, .grade-item.edge-opposed {opacity:.76;}
.grade-item.edge-neutral {border-color:var(--stroke);}
.grade-item.edge-priority .grade-number:first-of-type b,
.grade-item.edge-promising .grade-number:first-of-type b {color:#b9ed70;}
""")
    print('Updated public/clean.css')
# Version bump and cache-busted front-end assets make the change visible.
put('server.mjs',
    "version:'1.9.0'",
    "version:'2.1.0'")
put('package.json',
    '"version": "2.0.0"',
    '"version": "2.1.0"')
put('public/index.html',
    'NBA Scout v2.0',
    'NBA Scout v2.1')
put('public/index.html',
    '/clean.css?v=2.0',
    '/clean.css?v=2.1')
put('public/index.html',
    '/clean.js?v=2.0',
    '/clean.js?v=2.1')
print('RFPP 2.1 patch is in place. Run npm test, then deploy.')
