#!/usr/bin/env python3
"""Install Defensive Zone Weaknesses tab into the current main NBA Scout UI.

Runs after PATCH_SCOUT_31.py. Only a small number of predictable integration
anchors are changed. No changes to player-prop grading rules or saved reviews.
"""
from pathlib import Path
import subprocess
ROOT=Path(__file__).resolve().parent

def replace(filename, old, new):
    target=ROOT/filename
    if not target.exists():raise RuntimeError(f'NBA Scout source missing: {filename}')
    s=target.read_text(encoding='utf-8')
    if new in s:
        print(filename, 'defense-zone integration already installed')
        return
    if s.count(old)!=1:
        raise RuntimeError(f'{filename}: expected one stable integration point, found {s.count(old)}')
    target.write_text(s.replace(old,new,1),encoding='utf-8')
    print(filename, 'defensive-zone section installed')

page='public/index.html'
replace(page,
    '<button id="tabExplore" role="tab" aria-selected="false" data-tab="explore">Player Research</button>',
    '<button id="tabExplore" role="tab" aria-selected="false" data-tab="explore">Player Research</button><button id="tabZones" role="tab" aria-selected="false" data-tab="zones">Defense Zones</button>')
replace(page,
    '  <section class="bottom-panel">',
    '''  <section id="zonesPage" class="page" hidden>
   <div class="dz-heading"><div><div class="overline">DEFENSIVE ZONE WEAKNESSES</div><h2>Where opponents get their shots</h2><p>Choose a defensive team. Tap a zone to see opponent FGA, FG% allowed, and how both compare with the NBA average.</p></div></div>
   <div class="dz-controls"><label for="dzTeam">DEFENDING TEAM<select id="dzTeam" aria-label="Select the NBA defending team"><option value="">Loading teams…</option></select></label><button id="dzRefresh" class="button secondary" type="button">↻ Refresh zones</button></div>
   <div id="dzStatus" class="dz-status" role="status">Open this tab to load the latest zone data.</div>
   <div class="dz-panel"><h3>Most permissive zones</h3><p class="dz-panel-note">These zones show noticeably higher opponent volume, shooting percentage, or both. Tap to inspect.</p><div id="dzWeaknesses" class="dz-weak-grid" aria-live="polite"></div></div>
   <div class="dz-layout">
    <div class="dz-panel"><h3 id="dzTitle">Opponent shooting map</h3><p class="dz-panel-note">Six zones — schematic view, not precise court boundaries.</p><div id="dzCourt" class="dz-court" role="group" aria-label="Selectable opponent shooting zones"></div><div id="dzHighlight" class="dz-focus" aria-live="polite">Choose a team and a zone.</div></div>
    <div class="dz-panel"><h3>All six defensive zones</h3><p class="dz-panel-note">Raw FGA totals and opponent FG% this season. Red FG% difference means more accurate shooting than the league average.</p><div id="dzRows" class="dz-rows" aria-label="Shot zones, attempts and accuracy allowed"></div><div class="dz-guide"><strong>How to read it:</strong> FGA is the total shot attempts the defense allowed in that zone. FG% is the share opponents made. “FG% vs league” measures percentage-point difference in that same zone, not a predicted prop hit rate.</div><p class="dz-caveat" id="dzCaveat"></p></div>
   </div>
  </section>
  <section class="bottom-panel">''')
replace(page,
    '<link rel="stylesheet" href="/clean.css?v=2.7">',
    '<link rel="stylesheet" href="/clean.css?v=2.7"><link rel="stylesheet" href="/defense-zones.css?v=3.5">')
replace(page,
    '<script type="module" src="/clean.js?v=2.7"></script>',
    '<script type="module" src="/clean.js?v=2.7"></script><script type="module" src="/defense-zones.mjs?v=3.5"></script>')
# The app's tabs live in a small private state machine; extend it rather than
# introducing a second global page controller that could break other tabs.
replace('public/clean.js',
    "for(const tab of ['picks','grades','lines','explore'])",
    "for(const tab of ['picks','grades','lines','explore','zones'])")
replace('public/clean.js',
    "if(name==='grades')renderGradeBoard()}",
    "if(name==='grades')renderGradeBoard();if(name==='zones')window.dispatchEvent(new Event('scout-zones-open'))}")
replace('public/clean.js',
    "$('tabExplore').onclick=()=>setTab('explore');$('tabLines').onclick=()=>setTab('lines');",
    "$('tabExplore').onclick=()=>setTab('explore');$('tabLines').onclick=()=>setTab('lines');$('tabZones').onclick=()=>setTab('zones');")
replace('server.mjs',
    "'/review/history.json':'review/history.json'};",
    "'/review/history.json':'review/history.json','/defense-zones.mjs':'defense-zones.mjs','/defense-zones.css':'defense-zones.css'};")
# No new data provider: /api/bootstrap already returns the live/fallback defense.
for f in ['public/clean.js','public/defense-zones.mjs','server.mjs']:
    subprocess.run(['node','--check',str(ROOT/f)],check=True)
print('Defensive Zone Weaknesses installed with existing NBA Scout defense API.')
