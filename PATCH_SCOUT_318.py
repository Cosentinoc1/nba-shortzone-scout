#!/usr/bin/env python3
"""NBA Scout 3.18 minimal, repeatable upgrade against installed v3.17.
Never executes old migrations, touches workflows or daily snapshots, or turns
missing data into verified data. Idempotent if run again by npm test.
"""
from pathlib import Path
R=Path(__file__).resolve().parent

def one(filename,old,new):
    target=R/filename
    if not target.exists():raise RuntimeError(f'NBA Scout 3.18 expected file missing: {filename}')
    text=target.read_text('utf-8')
    if new in text:return
    count=text.count(old)
    if count!=1:raise RuntimeError(f'NBA Scout 3.18 {filename}: need exactly one known v3.17 anchor, found {count}: {old[:120]!r}')
    target.write_text(text.replace(old,new,1),'utf-8')

# Install new source-attributed internal game-log audit; no hindsight.
one('server.mjs',
 "import {researchPlayer,STATS} from './lib/research.mjs';",
 "import {researchPlayer,STATS} from './lib/research.mjs';\nimport {auditPlayerHistory} from './lib/history-integrity-v318.mjs';")
one('server.mjs',"version:'3.17.0',dataQuality:checkDataQuality(","version:'3.18.0',dataQuality:checkDataQuality(")
one('server.mjs',
 "'/featured-picks-v316.mjs':'featured-picks-v316.mjs'",
 "'/featured-picks-v316.mjs':'featured-picks-v316.mjs','/simple-dashboard-v318.mjs':'simple-dashboard-v318.mjs','/simple-dashboard-v318.css':'simple-dashboard-v318.css','/roto-name-v318.mjs':'roto-name-v318.mjs'")
one('server.mjs',
 "return json(res,{...result,historyFetch});",
 "return json(res,{...result,historyFetch,historyAudit:result.supported?auditPlayerHistory({gameCache,team,playerName:name,stat:result.stat,day}):null});")
one('server.mjs',
 "return json(res,{...result,dataAsOf,seasonSource:'ESPN box scores · last 10/20 pre-slate player appearances; loaded on demand',historyFetch,cacheGames:",
 "return json(res,{...result,historyAudit:auditPlayerHistory({gameCache,team:offense,playerId:id,playerName:roster.name,stat,day}),dataAsOf,seasonSource:'ESPN box scores · last 10/20 pre-slate player appearances; loaded on demand',historyFetch,cacheGames:")
one('server.mjs',
 "return json(res,{...quickExplain(result,ctx,slate,day),feed:feedStatusOnly(feed),games:slate,historyGames:Object.keys(gameCache).length});\n  }\n  if(pathname==='/api/picks/import'",
 "const enriched=quickExplain(result,ctx,slate,day);\n   return json(res,{...enriched,rotowireStatus:{...enriched.rotowireStatus,uploadedRows:payload.rows.length,ignoredRows:payload.rows.length-projected.length},feed:feedStatusOnly(feed),games:slate,historyGames:Object.keys(gameCache).length});\n  }\n  if(pathname==='/api/picks/import'")

# Attach integrity status to each featured candidate without rewriting a score.
one('server.mjs',
 "featuredPicks:buildFeaturedPicks(enriched,{now:Date.now(),offenseContext:buildOffenseContext(gameCache,day)}),",
 "featuredPicks:buildFeaturedPicks({...enriched,date:day},{now:Date.now(),offenseContext:buildOffenseContext(gameCache,day),gameCache}),")
one('lib/featured-picks-v316.mjs',
 "import {roleFor,roleFact} from './offense-context-v316.mjs';",
 "import {roleFor,roleFact} from './offense-context-v316.mjs';\nimport {auditPlayerHistory} from './history-integrity-v318.mjs';")
one('lib/featured-picks-v316.mjs',
 "export function buildFeaturedPicks(board,{now=Date.now(),offenseContext=null}={}){",
 "export function buildFeaturedPicks(board,{now=Date.now(),offenseContext=null,gameCache=null}={}){")
one('lib/featured-picks-v316.mjs',
 " const anyApproved=selected.some(x=>x.entryReady);\n return {date:board?.date||null,updatedAt:new Date(now).toISOString(),top2:selected.slice(0,2),top5:selected.slice(0,5),",
 " const audited=gameCache?selected.map(x=>({...x,historyAudit:auditPlayerHistory({gameCache,team:x.team,playerName:x.player,stat:x.stat,day:board?.date||''})})):selected;\n const anyApproved=audited.some(x=>x.entryReady);\n return {date:board?.date||null,updatedAt:new Date(now).toISOString(),top2:audited.slice(0,2),top5:audited.slice(0,5),")

# The existing featured model didn't expose user-uploaded RotoWire values to
# the concise card, although they were applied to its scores. Surface them.
one('lib/featured-picks-v316.mjs',
 "  lastTen:{wins,losses,pushes,resolved,percent:winRate},lastTwenty:h.hitRates?.last20||null,sourceCoverage:covered,",
 "  lastTen:{wins,losses,pushes,resolved,percent:winRate},lastTwenty:h.hitRates?.last20||null,historySample:h.boxscoreGames??null,\n  rotowireMatch:independent?{minutes:pmins,projection:projected,supports:modelFav,opposes:modelOpp}:null,sourceCoverage:covered,")

# Optional RotoWire fields are not mandatory. A missing 3PM or FTM forecast
# remains null, never turns into a fictitious zero or an automatic bet.
one('lib/rotowire.mjs',
 "  let malformed=false;\n  for(const k of numeric){const rawValue=raw[k]??raw[k.toLowerCase()];const n=Number(rawValue);\n   if(rawValue==null||rawValue===''||!Number.isFinite(n)||n<0||n>(k==='MIN'?48:k==='FGA'||k==='3PA'?70:180)){malformed=true;break;}\n   obj[k]=round(n,4);\n  }\n  if(malformed)continue;\n  if(obj.FGA<obj.FGM||obj['3PA']<obj['3PM']||obj.FTA<obj.FTM)continue;",
 "  let malformed=false;const required=new Set(['MIN','PTS','REB','AST','FGA','3PA']);\n  for(const k of numeric){const rawValue=raw[k]??raw[k.toLowerCase()];\n   if(rawValue==null||rawValue===''){obj[k]=null;if(required.has(k))malformed=true;continue;}\n   const value=Number(rawValue);if(!Number.isFinite(value)||value<0||value>(k==='MIN'?48:k==='FGA'||k==='3PA'?70:180)){obj[k]=null;if(required.has(k))malformed=true;continue;}\n   obj[k]=round(value,4);\n  }\n  if(malformed)continue;\n  if(obj.FGM!=null&&obj.FGA<obj.FGM || obj['3PM']!=null&&obj['3PA']<obj['3PM'] || obj.FTA!=null&&obj.FTM!=null&&obj.FTA<obj.FTM)continue;")
one('lib/rotowire.mjs',
 " const x=k=>Number(p[k]);\n const map={PTS:['PTS']",
 " const x=k=>p[k]===null||p[k]===undefined||p[k]===''?null:Number(p[k]);\n const map={PTS:['PTS']")
one('lib/rotowire.mjs',
 " if(stat==='2PM')return round(x('FGM')-x('3PM'),2);\n const keys=map[stat];return keys?round(keys.reduce((a,k)=>a+x(k),0),2):null;",
 " if(stat==='2PM')return x('FGM')!==null&&x('3PM')!==null?round(x('FGM')-x('3PM'),2):null;\n const keys=map[stat];return keys&&keys.every(k=>x(k)!==null)?round(keys.reduce((a,k)=>a+x(k),0),2):null;")
one('lib/rotowire.mjs',
 "FTA ${p.FTA.toFixed(1)}. Potential assists/rebound chances",
 "FTA ${p.FTA==null?'—':p.FTA.toFixed(1)}. Potential assists/rebound chances")

# The full report had a separate strict string-equality browser projection
# lookup that failed for RotoWire name initials/suffixes and team aliases.
one('public/rotowire-upload.js',
 "const FILE_KEY='nbaScoutRotowireV19';",
 "import {findClientProjection,safeProjectionStat} from './roto-name-v318.mjs';\nconst FILE_KEY='nbaScoutRotowireV19';")
one('public/rotowire-upload.js',
 "function getProjection(team,name){const pack=activeForDate();if(!pack)return null;return pack.rows.find(r=>rosterMatch(r.Team,r.NAME)===rosterMatch(team,name))||null}",
 "function getProjection(team,name){const pack=activeForDate();return pack?findClientProjection(pack.rows,team,name):null}")
one('public/rotowire-upload.js',
 "const projectionStat=(p,stat)=>{\n const map={PTS:['PTS'],REB:['REB'],AST:['AST'],FGA:['FGA'],'3PA':['3PA'],'3PM':['3PM'],FTM:['FTM'],PRA:['PTS','REB','AST'],PR:['PTS','REB'],PA:['PTS','AST'],RA:['REB','AST']};\n if(stat==='2PM')return Number(p.FGM)-Number(p['3PM']);const keys=map[stat]||[];return keys.length?keys.reduce((sum,k)=>sum+Number(p[k]),0):null;\n};",
 "const projectionStat=(p,stat)=>safeProjectionStat(p,stat);")
one('public/rotowire-upload.js',
 "status(`${data.length} RotoWire players imported. Updating the Top 10 grades…`,'ok');",
 "status(`${data.length} RotoWire rows imported for ${date}. Matching today’s NBA props…`,'ok');")

# Homepage: short explanations first, original detailed Top 10 behind one tap.
one('public/clean.js',
 "import {renderFeaturedPicks,renderSourcePulse} from './featured-picks-v316.mjs';",
 "import {renderSimplePicks,renderSimpleSources} from './simple-dashboard-v318.mjs';")
one('public/clean.js',
 " renderSourcePulse(data);\n renderFeaturedPicks(data,c=>window.dispatchEvent(new CustomEvent('scout-open-insight',{detail:c})));",
 " renderSimpleSources(data);\n renderSimplePicks(data,c=>window.dispatchEvent(new CustomEvent('scout-open-insight',{detail:c})));" )
one('public/index.html',
 '<link rel="stylesheet" href="/featured-picks-v316.css?v=3.16">',
 '<link rel="stylesheet" href="/featured-picks-v316.css?v=3.16"><link rel="stylesheet" href="/simple-dashboard-v318.css?v=3.18">')
one('public/index.html',
 '<button id="tabPicks" role="tab" aria-selected="true" class="active" data-tab="picks">Top 10',
 '<button id="tabPicks" role="tab" aria-selected="true" class="active" data-tab="picks">Best Picks')
one('public/index.html',
 '>Grade Board</button><button id="tabLines"',
 '>Compare Props</button><button id="tabLines"')
one('public/index.html',
 '>All Lines</button><button id="tabExplore"',
 '>All Props</button><button id="tabExplore"')
one('public/index.html',
 '>Player Research</button><button id="tabZones"',
 '>Player Stats</button><button id="tabZones"')
one('public/index.html',
 '>Defense Zones</button><a href="/classic"',
 '>Defense Map</button><a href="/classic"')
one('public/index.html',
 '<div class="section-heading"><div><div class="overline">TODAY\'S SHORTLIST</div>',
 '<details class="sd-advanced-panel"><summary>Explore the complete Top 10 and every source check</summary>\n   <div class="section-heading"><div><div class="overline">TODAY\'S SHORTLIST</div>')
one('public/index.html',
 '   <p class="footnote">Research scores are <b>not win probabilities</b>. A high score does not mean a profitable pick. Payout, line movement and independent minutes/injury projections remain mandatory final checks.</p>\n  </section>',
 '   <p class="footnote">Research scores are <b>not win probabilities</b>. A high score does not mean a profitable pick. Payout, line movement and independent minutes/injury projections remain mandatory final checks.</p>\n   </details>\n  </section>')

# Full player report: prominent source and L10/L20 summary, old long analysis
# inside one accessible expansion. Never hide missing projections as verified.
one('public/insight-ui.js',
 " $('insightBody').innerHTML=head+summaryCard+boardCard+inj+teammates +stats+historyNotice+rwSection+context+gradeCard+checkBlock+",
 " const audit=d.historyAudit;\n const selectedHistory=chosenSide==='LESS'?b:a;const recentHit=selectedHistory?.hitRates?.last10;const sampleCount=recentHit?.sample??0;\n const quickHero=`<section class=\"sd-modal-summary\"><b>Quick read · ${esc(chosenSide)} ${esc(d.line)} ${esc(d.stat)}</b><p>Last ${sampleCount} played games: ${esc(recentHit?.win??'—')} wins for ${esc(chosenSide)}, ${esc(recentHit?.loss??'—')} losses, ${esc(recentHit?.push??0)} pushes at this line.</p><p><b>RotoWire:</b> ${rw?`${esc(rw.MIN)} projected minutes · ${rwStat===null?'stat projection unavailable':esc(rwStat)+' '+esc(d.stat)}`:'No matched player projection for the selected game day'}. <b>Defense:</b> ${esc(defView.verdict||'Unverified')} (${esc(defView.letter||'—')}) for ${esc(chosenSide)}.</p><p><b>Historical data:</b> ${esc(audit?.status||'Source audit not available')} · ${esc(audit?.last10??a?.last10??0)}/10 recent games · ${esc(audit?.last20??a?.last20??0)}/20 available${audit?.warning?' · '+esc(audit.warning):''}. These are completed appearances, not predictions.</p></section>`;\n $('insightBody').innerHTML=head+quickHero+'<details class=\"sd-modal-deep\"><summary>Full breakdown · last 10/20 games, injuries, minutes and all sources</summary>'+summaryCard+boardCard+inj+teammates +stats+historyNotice+rwSection+context+gradeCard+checkBlock+'<p class=\"report-disclaimer\">ESPN source audit is internal consistency only. Confirm official results and current availability independently.</p></details>'+" )
# Validate mode change without accidentally discarding full report disclaimer.
one('public/index.html',
 '<script type="module" src="/clean.js?v=2.7"></script>',
 '<script type="module" src="/clean.js?v=3.18"></script>')
one('public/index.html',
 '<script type="module" src="/insight-ui.js?v=2.7"></script>',
 '<script type="module" src="/insight-ui.js?v=3.18"></script>')
one('public/index.html',
 '<script type="module" src="/rotowire-upload.js?v=2.0"></script>',
 '<script type="module" src="/rotowire-upload.js?v=3.18"></script>')

# Old strict tests must refer to the *new* version and installer once upgraded.
one('test/decision-v25-wiring.test.mjs',r"/version:'3\.17\.0'/",r"/version:'3\.18\.0'/")
one('test/decision-v25-wiring.test.mjs',"version,'3.17.0'","version,'3.18.0'")
one('test/install-order-v317.test.mjs',"assert.equal(pkg.version,'3.17.0');","assert.equal(pkg.version,'3.18.0');")
one('test/install-order-v317.test.mjs',"assert.equal(pkg.scripts.pretest,'python3 PATCH_SCOUT_317.py');","assert.equal(pkg.scripts.pretest,'python3 PATCH_SCOUT_318.py');")
print('NBA Scout v3.18: focused layout, RotoWire diagnostics and player-log integrity installed. Previous installers skipped.')
