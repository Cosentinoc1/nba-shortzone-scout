#!/usr/bin/env python3
"""Install RFPP shot-zone game player matchups and separate defensive signals.

Additive, repeatable; runs AFTER PATCH_SCOUT_ZONES_35.py. Avoid protected
.github/workflows changes and avoid overwriting saved historical reviews.
"""
from pathlib import Path
import subprocess
ROOT=Path(__file__).resolve().parent

def replace(filename,old,new):
    p=ROOT/filename
    if not p.exists():raise RuntimeError(f'Missing NBA Scout source {filename}')
    s=p.read_text(encoding='utf-8')
    if new in s:
        print(f'{filename}: matchup patch already installed');return
    n=s.count(old)
    if n!=1:raise RuntimeError(f'{filename}: expected one safe integration anchor; got {n}: {old[:100]}')
    p.write_text(s.replace(old,new,1),encoding='utf-8')
    print(f'{filename}: matchup patch installed')

replace('server.mjs',
    "import {auditDay} from './lib/audit.mjs';",
    "import {auditDay} from './lib/audit.mjs';\nimport {priorGamesOnly,rankGameZoneOpportunities} from './lib/zone-opportunities.mjs';")
replace('server.mjs',
    "  if(pathname==='/api/bootstrap')return json(res,{defense,players,rosters,schedule,status:status()});",
    '''  if(pathname==='/api/bootstrap')return json(res,{defense,players,rosters,schedule,status:status()});
  if(pathname==='/api/zone-opportunities'&&req.method==='GET'){
   const day=u.searchParams.get('date')||localDate();
   if(!validSlateDay(day))return json(res,{error:'Select a valid 2026-27 NBA game date'},400);
   let slate;
   try{slate=await getSchedule(false,day)}catch(e){return json(res,{error:'NBA game schedule unavailable',detail:e.message},503)}
   // Strictly PRE-slate history, including a Chicago-local cutoff for late UTC starts.
   // This prevents same-day results from influencing the pregame ranking.
   const prior=priorGamesOnly(gameCache,day);
   if(prior.length<20)return json(res,{date:day,gameCount:slate.length,games:[],
      error:'Insufficient previous regular-season games for a reliable zone matchup ranking',
      historyCount:prior.length,source:'ESPN pregame box scores'},503);
   const hist=aggregateGames(prior);
   const result=rankGameZoneOpportunities({day,games:slate,playerProfiles:hist.players,
      defense:hist.defense,historyGames:prior,rosters});
   return json(res,{...result,historyCount:prior.length,modelVersion:'zone-fit-1.0',
      sourceDataAsOf:hist.asof||null});
  }''')
replace('server.mjs',
    "  const name=files[pathname];if(!name)return json(res,{error:'Not found'},404);",
    "  const zoneAssets={'/zone-metrics.mjs':'zone-metrics.mjs','/zone-opportunity-ui.mjs':'zone-opportunity-ui.mjs'};\n  const name=files[pathname]||zoneAssets[pathname];if(!name)return json(res,{error:'Not found'},404);")
replace('public/index.html',
    '<div class="dz-controls">',
    '''<div class="dz-panel zo-panel" id="zoPanel">
    <div class="zo-panel-head"><div><div class="overline">AUTO-MATCHED PLAYER OPPORTUNITIES</div>
     <h3>Top player vs. defensive-zone matches for every game</h3>
     <p>Automatically ranks players by their usual shot locations, the defense's allowed shot volume and FG%, recent FGA, and recent minutes. No player-by-player selection needed.</p></div></div>
    <div class="zo-controls"><label for="zoGame">GAME<select id="zoGame"><option>Loading today's NBA games…</option></select></label>
     <label for="zoMode">WHAT TO RANK<select id="zoMode"><option value="overall">Best overall alignment</option><option value="volume">More shot-access opportunity</option><option value="efficiency">Higher FG% matchup</option><option value="three">Three-point opportunities</option></select></label>
     <button class="button secondary" id="zoReload" type="button">↻ Update matches</button></div>
    <div id="zoStatus" role="status" aria-live="polite">Open the Defense Zones tab to load each game's best player matches.</div>
    <div id="zoResults" aria-label="Ranked game-specific defensive-zone matching players"></div>
    <p class="zo-note">Match grades are descriptive evidence, <strong>not predicted hit rates, projected FGA, or bet approvals</strong>. ESPN shot locations are approximations. Availability, projected minutes, current player role, exact PrizePicks line and market price must still be verified. Ranking weighs defense shot volume 30%, defense FG% 21%, player FGA 22%, minutes 14%, recent attempts 8%, and stability 5%. Tap any player to inspect the relevant defensive zone.</p>
   </div>
   <div class="dz-controls">''')
replace('public/index.html',
    '<script type="module" src="/defense-zones.mjs?v=3.5"></script>',
    '<script type="module" src="/defense-zones.mjs?v=3.5"></script><script type="module" src="/zone-opportunity-ui.mjs?v=3.7"></script>')

replace('public/defense-zones.mjs',
    'const ZONES = [',
    "import {zoneSignalGrade} from './zone-metrics.mjs';\nconst ZONES = [")
replace('public/defense-zones.mjs',
    '    const tiny = fga===null||fga<25;',
    '    const grades=zoneSignalGrade({fga,totalFga:attempts,fg,share,leagueFg,leagueShare});\n    const tiny = fga===null||fga<25;')
replace('public/defense-zones.mjs',
    'fgDelta,volumeDelta,flag,tone,why,strength};',
    'fgDelta,volumeDelta,flag,tone,why,strength,...grades};')
replace('public/defense-zones.mjs',
    '<span><b>${number(z.fga)}</b><small>FGA allowed</small></span>',
    '<span><b>${number(z.fga)}</b><small>FGA allowed · volume grade ${z.volumeGrade??"—"}</small></span>')
replace('public/defense-zones.mjs',
    '<span><b>${pct(z.fg)}</b><small>FG% allowed</small></span>',
    '<span><b>${pct(z.fg)}</b><small>FG% allowed · accuracy grade ${z.efficiencyGrade??"—"}</small></span>')
replace('public/defense-zones.mjs',
    '<p class="dz-compare">Volume vs league: <strong>${pp(active.volumeDelta)}</strong> · FG% vs league: <strong>${pp(active.fgDelta)}</strong></p>`;',
    '''<div class="dz-separate-grade"><div><strong>${active.volumeGrade??'—'}/100</strong><small>VOLUME ALLOWED GRADE</small><p>${escapeText(active.volumeLabel)} · ${pp(active.volumeDelta)} shot share vs league</p></div><div><strong>${active.efficiencyGrade??'—'}/100</strong><small>FG% ALLOWED GRADE</small><p>${escapeText(active.efficiencyLabel)} · ${pp(active.fgDelta)} FG% vs league</p></div></div><p class="dz-compare">50 is league neutral. Values above 50 are more permissive. FG% grades shrink small zone samples (${number(active.fga)} attempts); neither grade is a player's probability of scoring.</p>`;''')
replace('public/defense-zones.mjs',
    '<span>${pct(z.fg)} FG% allowed · ${number(z.fga)} FGA · ${pp(z.fgDelta)} vs league</span></button>',
    '<span>${pct(z.fg)} FG% allowed · ${number(z.fga)} FGA · ${pp(z.fgDelta)} vs league</span><em>Volume grade ${z.volumeGrade??"—"} · FG% grade ${z.efficiencyGrade??"—"}</em></button>')
replace('public/defense-zones.mjs',
    "window.addEventListener('scout-zones-open',()=>load(false));",
    '''window.addEventListener('scout-zones-open',()=>load(false));
  window.addEventListener('scout-zone-select',async event=>{
   const team=event.detail?.team,zone=event.detail?.zone;
   if(!cached)await load(false);
   if(cached?.defense?.teams?.some(x=>x.code===team)){
    $('dzTeam').value=team;
    selectedZone=ZONES.some(z=>z.id===zone)?zone:'rim';render();
   }
  });''')
for f in ['server.mjs','lib/zone-opportunities.mjs','public/defense-zones.mjs','public/zone-opportunity-ui.mjs','public/zone-metrics.mjs']:
    subprocess.run(['node','--check',str(ROOT/f)],check=True)
print('Zone Matchups v3.7 installed. No workflow changes; no changes to RFPP betting approval. Run full npm test.')
