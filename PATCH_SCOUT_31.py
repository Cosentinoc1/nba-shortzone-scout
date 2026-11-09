#!/usr/bin/env python3
"""Patch the current NBA Scout repo after Actions extracts v3.3.

Idempotent and revision-guarded: fails if a required source anchor drifted.
Keeps research ranking distinct from final-veto / bet-ready status.
"""
from pathlib import Path
import json, shutil, subprocess
ROOT=Path(__file__).resolve().parent

def replace(file, old, new):
    p=ROOT/file
    if not p.is_file(): raise RuntimeError(f'Missing existing NBA Scout source: {file}')
    s=p.read_text(encoding='utf-8')
    if new in s:
        print(f'{file}: already patched'); return
    ct=s.count(old)
    if ct!=1: raise RuntimeError(f'{file}: expected one old anchor but found {ct} ({old[:130]})')
    p.write_text(s.replace(old,new,1),encoding='utf-8')
    print(f'{file}: patched')

assert 'RFPP 2.7' in (ROOT/'lib/research-rank-v27.mjs').read_text(), 'Missing directional ranking module'
replace('lib/decision.mjs',
    "import {assessProp} from './decision-v25.mjs';",
    "import {assessProp} from './decision-v25.mjs';\nimport {rankResearchProp} from './research-rank-v27.mjs';")
replace('lib/decision.mjs',
    "return {...r,score,state,hard,grade:grade(score),lean,defenseGrade,v2,edge,recommendation,readiness:edge.readiness,",
    "return {...r,score,state,hard,grade:grade(score),lean,defenseGrade,v2,edge,recommendation,\n   researchRank:rankResearchProp({...r,state,hard,defenseGrade,rest,latestOdds:game?.odds,\n     lineupStatus:lineup?.lineupStatus||'unverified',injuryStatus:injuryCurrent?injury?.status||null:null},recommendation),\n   readiness:edge.readiness,")
old='''rows.sort((a,b)=>Number(a.state==='PASS')-Number(b.state==='PASS')||b.score-a.score||String(a.player).localeCompare(String(b.player)));
 const eligible=rows.filter(x=>x.state!=='PASS');
 const topMore=chooseUnique(eligible.filter(x=>x.side==='MORE'),limit,{positive:true});
 const topLess=chooseUnique(eligible.filter(x=>x.side==='LESS'),limit,{positive:true});
 const top=chooseUnique(eligible,limit,{positive:true});
 const worst=chooseUnique(eligible.filter(x=>x.side==='MORE'&&x.defenseGrade.available).sort((a,b)=>a.defenseGrade.score-b.defenseGrade.score),limit);'''
new='''// RFPP 2.7: rank research directions using observed L10, opportunity, minutes, DvP
 // and (when actually available) the independent forecast. Missing RW/lineup data
 // lowers evidence coverage, rather than deleting useful research candidates.
 const rankSort=(a,b)=>(b.researchRank?.score??0)-(a.researchRank?.score??0)||String(a.player).localeCompare(String(b.player));
 rows.sort((a,b)=>Number(!a.researchRank?.eligible)-Number(!b.researchRank?.eligible)||rankSort(a,b));
 const eligible=rows.filter(x=>x.researchRank?.eligible===true);
 const topMore=chooseUnique(eligible.filter(x=>x.side==='MORE').sort(rankSort),limit);
 const topLess=chooseUnique(eligible.filter(x=>x.side==='LESS').sort(rankSort),limit);
 const top=chooseUnique([...eligible].sort(rankSort),limit);
 const worst=chooseUnique(rows.filter(x=>x.state!=='PASS'&&x.side==='MORE'&&x.defenseGrade?.available).sort((a,b)=>a.defenseGrade.score-b.defenseGrade.score),limit);'''
replace('lib/decision.mjs',old,new)
replace('lib/decision.mjs',"scoringVersion:'2.6-tail-and-minute-guarded-research'","scoringVersion:'2.7-signal-ranked-research-final-veto-preserved'")
replace('lib/decision.mjs',"all:rows,allCount:rows.length,qualified:eligible.length,sourceStatus:",
    "all:rows,allCount:rows.length,qualified:eligible.length,\n  researchCounts:{priority:eligible.filter(x=>x.researchRank.tier==='PRIORITY').length,lean:eligible.filter(x=>x.researchRank.tier==='LEAN').length,watch:eligible.filter(x=>x.researchRank.tier==='WATCH').length},sourceStatus:")
replace('server.mjs',"version:'2.6.0'","version:'2.7.1'")
# The deployed HTTP server uses an explicit static-file allowlist: include the
# review page AND its nested assets / history, with the correct JSON mime.
replace('server.mjs',
 "const files={'/':'index.html','/index.html':'index.html','/clean.js':'clean.js','/rotowire-upload.js':'rotowire-upload.js','/insight-ui.js':'insight-ui.js','/defense-ui.mjs':'defense-ui.mjs','/clean.css':'clean.css','/classic':'classic.html','/classic.html':'classic.html','/app.js':'app.js','/styles.css':'styles.css'};",
 "const files={'/':'index.html','/index.html':'index.html','/clean.js':'clean.js','/rotowire-upload.js':'rotowire-upload.js','/insight-ui.js':'insight-ui.js','/defense-ui.mjs':'defense-ui.mjs','/clean.css':'clean.css','/classic':'classic.html','/classic.html':'classic.html','/app.js':'app.js','/styles.css':'styles.css','/review.html':'review.html','/review/review.js':'review/review.js','/review/review.css':'review/review.css','/review/history.json':'review/history.json'};")
replace('server.mjs',
 "const type=name.endsWith('.html')?'text/html; charset=utf-8':name.endsWith('.css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8';",
 "const type=name.endsWith('.html')?'text/html; charset=utf-8':name.endsWith('.css')?'text/css; charset=utf-8':name.endsWith('.json')?'application/json; charset=utf-8':'text/javascript; charset=utf-8';")
# The main site UI should show ranked research candidates without calling them bet ready.
p='public/clean.js'
old=''' const acceptable=new Set(['STRONG','LEAN']);
 const rows=list.filter(c=>c.state!=='PASS'&&(!target||target.includes(c.team))&&(kind==='WORST'||((kind==='ALL'||c.side===kind)&&acceptable.has(c.recommendation?.tier))));
 const tier=x=>x.recommendation?.tier==='STRONG'?2:x.recommendation?.tier==='LEAN'?1:0;
 rows.sort((a,b)=>tier(b)-tier(a)||(b.recommendation?.score??b.score)-(a.recommendation?.score??a.score));'''
new=''' const rows=list.filter(c=>c.state!=='PASS'&&c.researchRank?.eligible===true&&(!target||target.includes(c.team))&&(kind==='ALL'||c.side===kind));
 const tier=x=>({PRIORITY:3,LEAN:2,WATCH:1})[x.researchRank?.tier]||0;
 rows.sort((a,b)=>tier(b)-tier(a)||(b.researchRank?.score??0)-(a.researchRank?.score??0));'''
replace(p,old,new)
replace(p,
    "blank('No approved strong leans at these lines','That is a valid PASS: upload current RotoWire projections, verify lineups and current lines, or review all results on the Grade Board. No forced 10-pick card.')",
    "blank('No qualifying research directions for this game day','Check game date and whether the provider has pregame lines for this slate. Priority, Lean and Watch need valid data. Missing RotoWire alone no longer removes researched candidates; no forced ten-pick card.')")
replace(p,
    "const rec=c.recommendation||{},topWhy=rec.helps?.slice(0,2)||[],topRisk=rec.hurts?.slice(0,1)||[];",
    "const rec=c.recommendation||{},rr=c.researchRank||{},topWhy=rr.reasons?.slice(0,2)||rec.helps?.slice(0,2)||[],topRisk=rr.risks?.slice(0,1)||rec.hurts?.slice(0,1)||[];")
replace(p,
    "if(!selected.length){$('picksGrid').innerHTML=blank('No qualifying research directions for this game day','Check game date and whether the provider has pregame lines for this slate. Priority, Lean and Watch need valid data. Missing RotoWire alone no longer removes researched candidates; no forced ten-pick card.');return;}",
    """if(!selected.length){
  $('picksGrid').innerHTML=blank('No qualifying research directions for this game day','Check the selected game date and pregame offers. Missing RotoWire alone no longer deletes research candidates; no forced 10.');
  if(Number(data.skips?.outOfSlate||0)>0 && Number(data.matched||0)===0){
   const d=new Date($('dateInput').value+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+1);
   const next=d.toISOString().slice(0,10);
   if(next<=$('dateInput').max){
    $('picksGrid').innerHTML+=`<div style="text-align:center;margin:12px"><button class="button secondary" id="nextSlateBtn" type="button">Check next game date (${next})</button></div>`;
    $('nextSlateBtn').addEventListener('click',()=>{$('dateInput').value=next;loadPicks()});
   }
  }return;
 }""")
replace(p,
    '''<span class="grade">${esc(rec.score??c.score)}<small>RESEARCH SCORE /100 · NOT WIN %</small></span>''',
    '''<span class="grade">${esc(rr.score??rec.score??c.score)}<small>RFPP 2.7 SIGNAL SCORE · NOT WIN %</small></span>''')
replace(p,
    '''<div class="decision-banner decision-${esc((rec.tier||"PASS").toLowerCase())}"><strong>${esc(rec.status||"NOT YET GRADED")}</strong><p>${esc(rec.summary||"Check full research before choosing a side.")}</p></div>''',
    '''<div class="decision-banner decision-${esc(rr.tier==='PRIORITY'?'strong':rr.tier==='LEAN'?'lean':rr.tier==='WATCH'?'hold':'pass')}"><strong>${esc(rr.status||"NOT YET GRADED")}</strong><p>${esc(rr.summary||"Check full research before choosing a side.")}</p><small>Final veto: ${esc(rec.status||'Not approved')}</small></div>''')
replace(p,
    '''<span class="grade-status">${esc(rec.confidence||"EVIDENCE COVERAGE UNKNOWN")}</span>''',
    '''<span class="grade-status">${esc(rr.coverage||'LIMITED')} SOURCE COVERAGE · ${esc(rec.confidence||'FINAL CHECKS PENDING')}</span>''')
replace(p,
    '''<div class="plain-why"><strong>WHY THIS SIDE?</strong><ul>${topWhy.map(x=>`<li>✓ ${esc(x)}</li>`).join("")||"<li>No multiple independent supporting reasons yet.</li>"}${topRisk.map(x=>`<li class="risk">! ${esc(x)}</li>`).join("")}</ul></div>''',
    '''<div class="plain-why"><strong>WHY THIS SIDE?</strong><ul>${topWhy.map(x=>`<li>✓ ${esc(x)}</li>`).join("")||"<li>Research support still incomplete.</li>"}${topRisk.map(x=>`<li class="risk">! ${esc(x)}</li>`).join("")}</ul></div>''')
replace(p,
    '''<h4>RFPP 2.6 · Why / Why not / What is missing</h4>''',
    '''<h4>RFPP 2.7 research signals (not a bet recommendation)</h4><p class="review-note">${esc(rr.method||'Signal coverage pending')} · Final veto ${esc(rec.status||'PENDING')}</p><div class="tag-row">${Object.entries(rr.components||{}).map(([k,v])=>`<span class="tag">${esc(k)} ${esc(v)}</span>`).join('')}</div><h4>Final-veto checks and risks</h4>''')
replace(p,
    "if(direction==='PROMISING')pool=pool.filter(x=>x.recommendation?.tier==='STRONG'&&x.state!=='PASS');",
    "if(direction==='PROMISING')pool=pool.filter(x=>x.researchRank?.tier==='PRIORITY'&&x.state!=='PASS');")
replace(p,
    "if(direction==='RESEARCH')pool=pool.filter(x=>['STRONG','LEAN'].includes(x.recommendation?.tier)&&x.state!=='PASS');",
    "if(direction==='RESEARCH')pool=pool.filter(x=>x.researchRank?.eligible===true&&x.state!=='PASS');")
replace(p,
    "if(direction==='ON_HOLD')pool=pool.filter(x=>['HOLD','PASS','VETO'].includes(x.recommendation?.tier));",
    "if(direction==='ON_HOLD')pool=pool.filter(x=>!x.researchRank?.eligible||['HOLD','PASS','VETO'].includes(x.recommendation?.tier));")
replace(p,
    "(x.recommendation?.score??x.score)>(old.recommendation?.score??old.score)",
    "(x.researchRank?.score??x.recommendation?.score??x.score)>(old.researchRank?.score??old.recommendation?.score??old.score)")
replace(p,
    "score:x.recommendation?.score??x.score,defense:",
    "score:x.researchRank?.score??x.recommendation?.score??x.score,defense:")
replace(p,
    "${pool.filter(x=>x.recommendation?.tier==='STRONG').length} strong research candidates · ${pool.filter(x=>x.recommendation?.tier==='LEAN').length} leans · ${pool.filter(x=>['HOLD','VETO'].includes(x.recommendation?.tier)).length} held/vetoed",
    "${pool.filter(x=>x.researchRank?.tier==='PRIORITY').length} priority research · ${pool.filter(x=>x.researchRank?.tier==='LEAN').length} leans · ${pool.filter(x=>x.researchRank?.tier==='WATCH').length} watch candidates · ${pool.filter(x=>!x.researchRank?.eligible).length} held/pass")
replace(p,
    '''const defView=defenseView(def,x.side);const rec=x.recommendation||{};''',
    '''const defView=defenseView(def,x.side);const rec=x.recommendation||{},rr=x.researchRank||{};''')
replace(p,
    '''${esc(rec.status||"NO VERDICT")}''',
    '''${esc(rr.status||rec.status||"NO VERDICT")} · FINAL ${esc(rec.tier||'PENDING')}''')
replace(p,
    '''<b>${esc(rec.score??x.score)}</b><small>RFPP 2.6 SCORE</small>''',
    '''<b>${esc(rr.score??rec.score??x.score)}</b><small>RFPP 2.7 RESEARCH</small>''')
# The navigation installation is repeatable, no dependence on old tab-specific script.
nav='<a href="/review.html" class="review-nav-link" style="border:1px solid #53638f;border-radius:10px;padding:9px 12px;white-space:nowrap">Performance Review</a>'
for filename in ['public/index.html','public/classic.html']:
    p=ROOT/filename
    if not p.exists(): continue
    content=p.read_text(encoding='utf-8')
    if 'href="/review.html"' not in content:
        anchor='<div class="segmented"'
        if anchor in content:
            start=content.index(anchor)
            end=content.find('>',start)
            content=content[:end+1]+nav+content[end+1:]
        elif '<nav class="quick-nav"' in content:
            # Legacy /classic page uses <nav>, not the main dashboard's tabs.
            start=content.index('<nav class="quick-nav"')
            end=content.find('>',start)
            content=content[:end+1]+nav+content[end+1:]
        elif '<main' in content:
            start=content.find('>',content.index('<main'))
            content=content[:start+1]+f'<div style="padding:12px">{nav}</div>'+content[start+1:]
        else: raise RuntimeError(f'{filename}: no safe navigation insertion point')
    content=content.replace('RFPP 2.6','RFPP 2.7').replace('?v=2.6','?v=2.7')
    p.write_text(content,encoding='utf-8')
# Keep v3.1 review styling, but revise wording to distinguish watchlists / bets.
p=ROOT/'public/review.html'
content=p.read_text(encoding='utf-8')
content=content.replace('No changes to numeric RFPP weights based on one slate. Instead, require verified role, reasonable minutes, player/game identity and stat-specific opportunity. Missing proof → PASS. Compare grade bands across multiple fully pre-tip slates before recalibrating.',
    'RFPP 2.7 adds a separate, softer six-signal research ranking: history, recent clearance, opportunity, minutes, opponent defense and independent forecast. Missing RotoWire is neutral rather than an automatic deletion. Missing confirmation still blocks final bet approval. Compare research score bands, verified status and hit rates across several slates before adjusting the weights.')
content=content.replace('A Top 10 is not automatically 10 bets. When verification is incomplete, showing no qualified picks is the intended behavior.',
    'PRIORITY / LEAN / WATCH are research labels, not bet approvals. The Top 10 can be shorter than 10 when real lines or safe historical evidence are missing. Final veto and market price checks remain separate.')
p.write_text(content,encoding='utf-8')
# Seed is created only the first time: future zip releases must not clobber accumulated audits.
p=ROOT/'public/review/history.json';p.parent.mkdir(parents=True,exist_ok=True)
if not p.exists(): shutil.copyfile(ROOT/'data/review-seed.json',p)
# Set package version. Test script is supplied in this release ZIP.
p=ROOT/'package.json';d=json.loads(p.read_text(encoding='utf-8'))
d['version']='2.7.1';d['description']='NBA Scout RFPP 2.7 ranked research + daily Performance Review'
d.setdefault('scripts',{})['pretest']='python3 PATCH_SCOUT_31.py'
d['scripts']['test']='node --test test/*.test.mjs'
p.write_text(json.dumps(d,indent=2)+'\n',encoding='utf-8')
for f in ['lib/decision.mjs','lib/decision-v25.mjs','lib/research-rank-v27.mjs','server.mjs','public/clean.js','public/review/review.js','scripts/update-review.mjs']:
    subprocess.run(['node','--check',str(ROOT/f)],check=True)
print('RFPP 2.7 rank upgrade and Performance Review installed. Run node --test test/*.test.mjs before committing.')
# v3.5 adds a read-only team defensive-zone explorer without altering prop grading.
subprocess.run(['python3',str(ROOT/'PATCH_SCOUT_ZONES_35.py')],check=True)
