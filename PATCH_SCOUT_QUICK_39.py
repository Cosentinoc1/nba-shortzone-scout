#!/usr/bin/env python3
"""Idempotent source-aware Top 10 quick-pick layer for NBA Scout v3.8+.
Runs in npm pretest after extracting the ZIP. Do not run old installers again.
"""
from pathlib import Path
ROOT=Path(__file__).resolve().parent

def edit(rel, old, new):
    p=ROOT/rel
    if not p.exists(): raise RuntimeError(f'{rel}: missing existing file (requires installed v3.8)')
    s=p.read_text(encoding='utf8')
    if new in s:
        print(rel,': already upgraded')
        return
    count=s.count(old)
    if rel=='server.mjs' and old.startswith('return json(res,{...result,feed:feedStatusOnly(feed)') and count==2:
        p.write_text(s.replace(old,new),encoding='utf8')
        print(rel,': updated 2 pick routes')
        return
    if count!=1:
        raise RuntimeError(f'{rel}: anchor mismatch expected 1 got {count}: {old[:90]}')
    p.write_text(s.replace(old,new,1),encoding='utf8')
    print(rel,': updated')

assert (ROOT/'lib/quick-pick-explainer.mjs').exists(), 'Missing quick-explainer module'
assert (ROOT/'lib/zone-opportunities.mjs').exists(), 'Requires v3.8 game-zone model already installed'

edit('server.mjs',
     "import {priorGamesOnly,rankGameZoneOpportunities} from './lib/zone-opportunities.mjs';",
     "import {priorGamesOnly,rankGameZoneOpportunities} from './lib/zone-opportunities.mjs';\nimport {enrichBoardQuickReads} from './lib/quick-pick-explainer.mjs';")
# Calculate a date-isolated history so no games from the selected date can leak into the scouting report.
edit('server.mjs',
     'async function handler(req,res){',
     '''const quickZoneCache=new Map();
function zoneReportForPicks(day,slate){
 const prior=priorGamesOnly(gameCache,day);
 if(prior.length<20)return null;
 const latest=prior.at(-1)?.date||'',id=day+'|'+prior.length+'|'+latest;
 const cached=quickZoneCache.get(id);if(cached)return cached;
 const historical=aggregateGames(prior);
 const report=rankGameZoneOpportunities({day,games:slate,playerProfiles:historical.players,
    defense:historical.defense,historyGames:prior,rosters});
 if(quickZoneCache.size>8)quickZoneCache.clear();quickZoneCache.set(id,report);
 return report;
}
function quickExplain(board,ctx,slate,day){
 try {return enrichBoardQuickReads(board,{context:ctx,rosters,games:slate,
    zoneReport:zoneReportForPicks(day,slate),now:Date.now()});}
 catch(e){console.warn('Quick-pick explanations unavailable:',e.message);return board;}
}
async function handler(req,res){''')
edit('server.mjs',
     "return json(res,{...result,feed:feedStatusOnly(feed),games:slate,historyGames:Object.keys(gameCache).length});",
     "return json(res,{...quickExplain(result,ctx,slate,day),feed:feedStatusOnly(feed),games:slate,historyGames:Object.keys(gameCache).length});")
# Both standard and RotoWire routes share the same signature; replaced together above.
edit('server.mjs',
     "return json(res,{...result,feed:{configured:false,source:'Uploaded file · local browser session',count:result.boardCount,status:'uploaded'},games:slate,historyGames:Object.keys(gameCache).length});",
     "return json(res,{...quickExplain(result,ctx,slate,day),feed:{configured:false,source:'Uploaded file · local browser session',count:result.boardCount,status:'uploaded'},games:slate,historyGames:Object.keys(gameCache).length});")

# CSS linked to main page; no protected workflow files are touched.
edit('public/index.html',
     '</head>','<link rel="stylesheet" href="/quick-picks.css?v=3.9"></head>')

# Safe addition to the existing Top 10 rendering. Keeps existing expanded evidence.
quick_functions = r'''function renderQuickScan(rows){
 const escShort=x=>esc(String(x||'').slice(0,190));
 return `<section class="qp-scan" aria-label="Top 10 quick scan"><div class="qp-scan-header"><div><span class="overline">60-SECOND PICK REVIEW</span><h3>See the reason before opening a player</h3><p>Ranked research, not bet-ready choices. Tap a row for minutes, injuries, zones and exact-line history.</p></div><span class="qp-counter">${rows.length} research candidates</span></div>
 <div class="qp-scan-list">${rows.map((c,i)=>{const q=c.quickRead||{},h=c.hit10||{},n=(h.win??'—')+'/'+(h.sample??'—');return `<a href="#qp-card-${i}" class="qp-scan-row"><span class="qp-scan-rank">${i+1}</span><span class="qp-scan-person"><b>${escShort(c.player)}</b><small>${escShort(c.team)} vs ${escShort(c.opponent)} · ${escShort(c.side)} ${escShort(c.line)} ${escShort(c.stat)}</small></span><span class="qp-scan-right"><strong class="qp-mini qp-mini-${esc(q.quality||'watch')}">${escShort(q.status||c.researchRank?.tier||'CHECK')}</strong><small>${escShort(n)} L10 wins</small></span></a>`}).join('')}</div></section>`;
}
function renderQuickDecision(c){
 const q=c.quickRead;
 if(!q)return `<div class="qp-empty">Detailed opportunity explanations are temporarily unavailable. Use the sourced checks below before considering this line.</div>`;
 const cls=['priority','lean','watch','hold'].includes(q.quality)?q.quality:'watch';
 const item=f=>`<div class="qp-fact qp-fact-${esc(['support','conditional','veto','caution'].includes(f.strength)?f.strength:'neutral')}"><span class="qp-fact-label">${esc(f.label)}</span><p>${esc(f.detail)}</p><small>${esc(f.source)}</small></div>`;
 return `<section class="qp-decision" aria-label="Fast decision evidence for ${esc(c.player)}"><div class="qp-decision-head"><span class="qp-verdict qp-verdict-${esc(cls)}">${esc(q.status)}</span><span class="qp-verdict-label">Evidence, not predicted hit %</span></div>
 <p class="qp-one-line">${esc(q.oneLine)}</p><div class="qp-fact-grid">${(q.facts||[]).map(item).join('')}</div>
 <details class="qp-risks"><summary>What could make this pick miss? <span>${(q.risks||[]).length} checks</span></summary><ul>${(q.risks||[]).map(t=>`<li>${esc(t)}</li>`).join('')}</ul></details></section>`;
}
'''
edit('public/clean.js','function renderPicks(){',quick_functions+'function renderPicks(){')
edit('public/clean.js',
     "$('picksGrid').innerHTML=selected.map((c,i)=>{",
     "$('picksGrid').innerHTML=renderQuickScan(selected)+selected.map((c,i)=>{")
edit('public/clean.js',
     '<article class="pick-card upgraded-card">',
     '<article class="pick-card upgraded-card" id="qp-card-${i}">')
edit('public/clean.js',
     '  <div class="grade-band"><span class="matchup-grade',
     '  ${renderQuickDecision(c)}\n  <div class="grade-band"><span class="matchup-grade')
edit('server.mjs',
     "'/defense-zones.css':'defense-zones.css'};",
     "'/defense-zones.css':'defense-zones.css','/quick-picks.css':'quick-picks.css'};")
print('NBA Scout 3.9 quick-pick layer ready; existing ranking, review, and zone model untouched.')
