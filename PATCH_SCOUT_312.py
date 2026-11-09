#!/usr/bin/env python3
"""v3.12 one-upload cumulative integrity + market-gate patch. Runs AFTER v3.11.
Every source edit is exact and repeat-safe. Abort safely on unknown baseline.
"""
from pathlib import Path
ROOT=Path(__file__).resolve().parent
# The next cumulative release supersedes our exact v3.12 anchors. A repeated
# npm test on an already-upgraded checkout must not reapply prior patches.
_status=ROOT/'server.mjs'
if _status.exists() and "version:'3.13.0',dataQuality:checkDataQuality(" in _status.read_text(encoding='utf8'):
 print('NBA Scout v3.12 functionality already installed by v3.13; no reapplication.')
 raise SystemExit(0)

def edit(rel,old,new,expected=1):
 p=ROOT/rel
 if not p.exists():raise RuntimeError(f'{rel} missing: earlier install required')
 s=p.read_text(encoding='utf-8')
 # v3.12 adds the observed-line fact inside the market block; the enlarged
 # segment no longer equals the earlier exact replacement byte-for-byte.
 if rel=='lib/quick-pick-explainer.mjs' and old.strip()=='const ng=upgraded.newsZone||{};' and 'const market=auditMarket(' in s:
  print(f'{rel}: market audit already installed');return
 if new in s:
  print(f'{rel}: already v3.12');return
 count=s.count(old)
 if count!=expected:raise RuntimeError(f'{rel}: expected {expected} exact anchors, got {count} - refusing unvalidated patch {old[:100]}')
 p.write_text(s.replace(old,new,expected),encoding='utf8')
 print(f'{rel}: updated')

for file in ['lib/data-quality-v312.mjs','lib/market-gate-v312.mjs','public/zone-league-v311.mjs','public/correlation-v312.mjs','lib/line-movement-v312.mjs']:
 if not (ROOT/file).exists():raise RuntimeError('Missing new module '+file)

# A transparent data-quality endpoint and status. This checks arithmetic + coverage, NOT live NBA verification.
edit('server.mjs',
 "import {enrichBoardQuickReads} from './lib/quick-pick-explainer.mjs';",
 "import {enrichBoardQuickReads} from './lib/quick-pick-explainer.mjs';\nimport {checkDataQuality} from './lib/data-quality-v312.mjs';")
edit('server.mjs',
 "version:'3.11.0',researchCacheGames:",
 "version:'3.12.0',dataQuality:checkDataQuality({defense,players,rosters,asOf:dataAsOf,source}),researchCacheGames:")
edit('server.mjs',
 "if(pathname==='/api/status')return json(res,status());",
 "if(pathname==='/api/status')return json(res,status());\n  if(pathname==='/api/data-quality')return json(res,checkDataQuality({defense,players,rosters,asOf:dataAsOf,source}));")
edit('server.mjs',
 "return enrichBoardQuickReads(board,{context:ctx,rosters,games:slate,\n    zoneReport:zoneReportForPicks(day,slate),profiles:players,day,now:Date.now()});}",
 "return {...enrichBoardQuickReads(board,{context:ctx,rosters,games:slate,\n    zoneReport:zoneReportForPicks(day,slate),profiles:players,day,now:Date.now()}),\n    dataQuality:checkDataQuality({defense,players,rosters,asOf:dataAsOf,source})};}")

# Don't reward unadjusted recent hit rates as strongly as opportunity and independent minutes.
edit('lib/research-rank-v27.mjs',
 "const W=Object.freeze({history:24,recentClearance:14,opportunity:18,minutes:17,defense:15,independentProjection:12});",
 "const W=Object.freeze({history:12,recentClearance:8,opportunity:24,minutes:24,defense:16,independentProjection:16});")
edit('lib/research-rank-v27.mjs',
 "dt<=120*60000", "dt<=75*60000")

# Show market evidence as a distinct, unverified gate. Never compute EV without full price and payout.
edit('lib/quick-pick-explainer.mjs',
 "import {gradeNewsZone} from './news-zone-v311.mjs';",
 "import {gradeNewsZone} from './news-zone-v311.mjs';\nimport {auditMarket} from './market-gate-v312.mjs';")
edit('lib/quick-pick-explainer.mjs',
 "  const ng=upgraded.newsZone||{};",
 """  const ng=upgraded.newsZone||{};
  const market=auditMarket(upgraded,{quotes:context.marketQuotes||[],now});
  quick.market=market;
  quick.facts.push({label:'PRICE, LINE MOVEMENT & VALUE',detail:market.text+' There is no reliable historical line movement or independent fair-value quote until a sourced market feed is connected.',
    strength:market.status==='STALE LINE'?'caution':'unknown',source:market.source});
  if(market.status==='STALE LINE'){quick.status='HOLD · EXACT LINE STALE';quick.quality='hold';}
  quick.risks.push('Top 10 research score is not betting EV. Confirm the current payout and independently priced line before submitting.');""")

# Observe line changes only when we have two real, timestamped platform rows.
edit('server.mjs',
 "import {checkDataQuality} from './lib/data-quality-v312.mjs';",
 "import {checkDataQuality} from './lib/data-quality-v312.mjs';\nimport {observePlatformLines} from './lib/line-movement-v312.mjs';")
edit('server.mjs',
 "function quickExplain(board,ctx,slate,day){",
 "function quickExplain(board,ctx,slate,day){\n ctx.lineMovements=observePlatformLines(board.all||[],day);")
edit('lib/quick-pick-explainer.mjs',
 "import {auditMarket} from './market-gate-v312.mjs';",
 "import {auditMarket} from './market-gate-v312.mjs';\nimport {explainPlatformMove} from './line-movement-v312.mjs';")
edit('lib/quick-pick-explainer.mjs',
 "  quick.market=market;",
 "  quick.market=market;\n  quick.facts.push(explainPlatformMove(upgraded,context.lineMovements||{}));")

# Sample-size labels must agree with the stricter ranking gate; 36 shots do not establish a strong FG% weakness.
edit('public/defense-zones.mjs',
 "const tiny = fga===null||fga<25;",
 "const tiny = fga===null||fga<60;")
edit('public/defense-zones.mjs',
 "const shooters=opposite3paLeaders({team:code,schedule:cached.schedule||[],players:cached.players||[],rosters:cached.rosters||{}});",
 "const shooters=opposite3paLeaders({team:code,schedule:cached.schedule||[],players:cached.players||[],rosters:cached.rosters||{},asOf:cached.status?.dataAsOf||view.asof,slateDay:$('dateInput')?.value||cached.status?.date||null});")
edit('public/defense-zones.mjs',
 "const heading=shooters.opponent?`${shooters.opponent} · opponent 3-point attempt leaders`:'Opponent 3-point attempt leaders';",
 "const heading=shooters.opponent?`${shooters.opponent} · ${shooters.coverageComplete?'opponent 3-point attempt leaders':'known 3-point shooters (partial)'}`:'Opposing team 3-point shooters';")
edit('public/defense-zones.mjs',
 "(shooters.players.length?`<div class=\"dz-311-shooters\">",
 "(shooters.players.length?`<p class=\"dz-311-note\">${escapeText(shooters.message)}</p><div class=\"dz-311-shooters\">")
edit('public/defense-zones.mjs',
 " $('dzCaveat').textContent=(cached?.status?.officialZonesAreExact===false || view.isEstimate) ?",
 """ const q=cached?.status?.dataQuality;
 const auditEl=$('dzDataQuality');
 if(auditEl){
  const cls=!q?'warning':!q.structuralOk?'error':q.playerLeaderboardsComplete?'ok':'warning';
  auditEl.className='dz-data-audit '+cls;
  auditEl.innerHTML='<strong>DATA QUALITY · '+escapeText(!q?'PENDING':q.structuralOk?'INTERNAL TOTALS RECONCILED':'SOURCE TOTALS CONFLICT')+'</strong>'+escapeText(q?`${q.teamCount}/30 defense teams · ${q.teamFga.toLocaleString('en-US')} classified FGA · ${q.playerTeamCoverage}/30 player teams · ${q.validPlayerProfiles} profiles with valid GP · snapshot ${q.asOf||'unknown'}`:'Waiting for source diagnostics')+'<p>'+escapeText(q?(q.issues[0]||q.warnings.filter(x=>!/independent live NBA/i.test(x)).slice(0,2).join(' · ')||'No arithmetic errors found'):'No current diagnostic report')+'</p><small>Arithmetic consistency is NOT independent verification against NBA official box scores.</small>';
 }
 $('dzCaveat').textContent=(cached?.status?.officialZonesAreExact===false || view.isEstimate) ?""")
edit('public/index.html',
 '<div id="dzStatus" class="dz-status" role="status">Open this tab to load the latest zone data.</div>',
 '<div id="dzStatus" class="dz-status" role="status">Open this tab to load the latest zone data.</div><div id="dzDataQuality" class="dz-data-audit warning">Checking source totals and player coverage…</div>')
edit('public/index.html',
 '<link rel="stylesheet" href="/zone-v311.css?v=3.11">',
 '<link rel="stylesheet" href="/zone-v311.css?v=3.12">')
edit('public/index.html',
 '<script type="module" src="/defense-zones.mjs?v=3.11"></script>',
 '<script type="module" src="/defense-zones.mjs?v=3.12"></script>')

# Same-game overlap is shown as a ticket-risk warning, not a computed correlation probability.
edit('server.mjs',
 "'/zone-league-v311.mjs':'zone-league-v311.mjs'};",
 "'/zone-league-v311.mjs':'zone-league-v311.mjs','/correlation-v312.mjs':'correlation-v312.mjs'};")
edit('public/clean.js',
 "const checkStyle=x=>",
 "import {describeSharedGames} from './correlation-v312.mjs';\nconst checkStyle=x=>")
edit('public/clean.js',
 "</strong><small>${escShort(n)} L10 wins</small></span></a>",
 "</strong><small>${escShort(n)} L10 wins</small>${describeSharedGames(c,rows)?`<small class=\"qp-312-market\">${escShort(describeSharedGames(c,rows))}</small>`:''}</span></a>")

# Quick-scan source health and no unchecked 'bet-ready' language.
edit('public/clean.js',
 "${stale?' · STALE': ''}`;",
 "${stale?' · STALE': ''}${data.dataQuality?.structuralOk===false?' · DEFENSIVE DATA INCONSISTENT':data.dataQuality?.playerTeamCoverage<30?' · PLAYER ZONES PARTIAL': ''}`;")
# Prior v3.5 test assumed 28 FGA was enough to call a zone TOUGH; v3.12 now explicitly labels it SMALL SAMPLE.
edit('test/defense-zones.test.mjs',
 "assert.ok(out.zones.slice(1).every(z=>z.flag==='TOUGH ZONE'));",
 "assert.ok(out.zones.slice(1).every(z=>z.flag==='SMALL SAMPLE'));")
print('NBA Scout v3.12 installer completed; run npm test and check /api/data-quality.')
