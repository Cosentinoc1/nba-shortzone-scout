#!/usr/bin/env python3
"""NBA Scout v3.17: corrected installer and explainable Top 2 / Top 5 research cards.

Installed AFTER 3.14 and 3.15. No GitHub workflow mutations, review-history
rewrites, grading weight changes, or hindsight. Idempotent source patches.
"""
from pathlib import Path
R=Path(__file__).resolve().parent

def one(filename,old,new):
 path=R/filename
 if not path.exists():raise RuntimeError(f'Expected existing app file absent: {filename}')
 text=path.read_text('utf8')
 if new in text:return
 if text.count(old)!=1:raise RuntimeError(f'{filename}: expected exactly one anchor, found {text.count(old)}: {old[:90]}')
 path.write_text(text.replace(old,new,1),'utf8')

one('server.mjs',
 "import {enrichBoardQuickReads} from './lib/quick-pick-explainer.mjs';",
 "import {enrichBoardQuickReads} from './lib/quick-pick-explainer.mjs';\nimport {buildFeaturedPicks} from './lib/featured-picks-v316.mjs';\nimport {buildOffenseContext} from './lib/offense-context-v316.mjs';")
one('server.mjs',
 'try {return {...enrichBoardQuickReads(board,{context:ctx,rosters,games:slate,\n    zoneReport:zoneReportForPicks(day,slate),profiles:players,day,now:Date.now()}),\n    dataQuality:checkDataQuality({defense,players,rosters,asOf:dataAsOf,source})};}',
 'try {const enriched=enrichBoardQuickReads(board,{context:ctx,rosters,games:slate,\n    zoneReport:zoneReportForPicks(day,slate),profiles:players,day,now:Date.now()});\n    return {...enriched,featuredPicks:buildFeaturedPicks(enriched,{now:Date.now(),offenseContext:buildOffenseContext(gameCache,day)}),\n    sourcePulse:{newsFetched:Boolean(ctx.newsFetched),teamOddsFetched:Boolean(ctx.oddsFetched)},\n    dataQuality:checkDataQuality({defense,players,rosters,asOf:dataAsOf,source})};}')
one('server.mjs',"version:'3.15.0',dataQuality:checkDataQuality(","version:'3.17.0',dataQuality:checkDataQuality(")
one('server.mjs',
 "'/quick-picks.css':'quick-picks.css'",
 "'/quick-picks.css':'quick-picks.css','/featured-picks-v316.css':'featured-picks-v316.css','/featured-picks-v316.mjs':'featured-picks-v316.mjs'")
one('public/index.html',
 '<link rel="stylesheet" href="/quick-picks.css?v=3.9">',
 '<link rel="stylesheet" href="/quick-picks.css?v=3.9"><link rel="stylesheet" href="/featured-picks-v316.css?v=3.16">')
one('public/index.html',
 '<div class="section-heading"><div><div class="overline">TODAY\'S SHORTLIST</div>',
 '<section id="featuredPicks" aria-label="Best two and five player prop research picks"><div class="fp-loading">Preparing daily research picks...</div></section>\n   <div class="section-heading"><div><div class="overline">TODAY\'S SHORTLIST</div>')
one('public/clean.js',
 "import {defenseView} from './defense-ui.mjs';",
 "import {defenseView} from './defense-ui.mjs';\nimport {renderFeaturedPicks,renderSourcePulse} from './featured-picks-v316.mjs';")
one('public/clean.js',
 " $('listTag').textContent=stale?'STALE LINES':state.side==='WORST'?'Tough defensive matchups · not automatic unders':'Source-aware research · NOT final bets';",
 " $('listTag').textContent=stale?'STALE LINES':state.side==='WORST'?'Tough defensive matchups · not automatic unders':'Source-aware research · NOT final bets';\n renderSourcePulse(data);\n renderFeaturedPicks(data,c=>window.dispatchEvent(new CustomEvent('scout-open-insight',{detail:c}))); ")
one('test/decision-v25-wiring.test.mjs',r"/version:'3\.15\.0'/",r"/version:'3\.17\.0'/")
one('test/decision-v25-wiring.test.mjs',"version,'3.15.0'","version,'3.17.0'")
print('NBA Scout v3.17: Top 2/5 update applied; old installers skipped.')

one('public/index.html',
 '   <div id="setupNote" class="setup-note" hidden>',
 '   <div id="sourcePulse" aria-live="polite"></div>\n   <div id="setupNote" class="setup-note" hidden>')

# Preserve separately frozen Top 2 and Top 5 lists for postgame review. They
# NEVER inflate the existing Top 10 performance rate through double counting.
one('scripts/update-review.mjs',
 '  const pickList = pretipCandidates(board, now);',
 """  const pickList = pretipCandidates(board, now);
  const fromFeatured = list => (Array.isArray(list) ? list : []).filter(p =>
    p?.team && p?.opponent && p?.player && Number.isFinite(Number(p.line)) &&
    ['MORE','LESS'].includes(p.side) && Date.parse(p.gameTipoff||'') > now.getTime()+5*60000
  ).map(p => ({board:'Featured Top 5',player:p.player,team:p.team,opponent:p.opponent,stat:p.stat,
    side:p.side,line:Number(p.line),rank:p.rank||null,detailKey:p.detailKey,
    pregameResearchStatus:p.entryStatus||'NOT APPROVED',quality:p.confidence||null}));
  const featured={top2:fromFeatured(board.featuredPicks?.top2),top5:fromFeatured(board.featuredPicks?.top5)};""")
one('scripts/update-review.mjs',
 'snapshot:{capturedAt:now.toISOString(), qualified, picks:pickList, gameCount:timing.games,',
 'snapshot:{capturedAt:now.toISOString(), qualified, picks:pickList, featured, gameCount:timing.games,')
one('scripts/update-review.mjs',
 '  for (const p of day.snapshot.picks) {',
 """  const featuredInput=Array.isArray(day.snapshot.featured?.top5)?day.snapshot.featured.top5:[];
  for (const p of [...day.snapshot.picks,...featuredInput]) {""")
one('scripts/update-review.mjs',
 """  const pending = picks.some(p => ['PENDING','UNVERIFIED'].includes(p.result));
  day.audit = {gradedAt:new Date().toISOString(),source:'ESPN official final NBA box scores',
    picks,summary:summaries(picks),allGamesFinal:events.every(e=>e.status?.type?.completed)};""",
 """  const featuredResults=picks.filter(p=>p.board==='Featured Top 5');
  const originalResults=picks.filter(p=>p.board!=='Featured Top 5');
  const top2Keys=new Set((day.snapshot.featured?.top2||[]).map(p=>p.detailKey));
  const featuredTop2=featuredResults.filter(p=>top2Keys.has(p.detailKey));
  const pending = picks.some(p => ['PENDING','UNVERIFIED'].includes(p.result));
  day.audit = {gradedAt:new Date().toISOString(),source:'ESPN official final NBA box scores',
    picks:originalResults,summary:summaries(originalResults),
    featured:{top2:featuredTop2,top5:featuredResults,
      resultsOnly:true,pregameVerified:day.snapshot?.pretipVerified===true},
    allGamesFinal:events.every(e=>e.status?.type?.completed)};""")
one('public/review.html',
 '<p class="muted" id="dailySource"></p>',
 '<div id="featuredReview" aria-live="polite"></div><p class="muted" id="dailySource"></p>')
one('public/review/review.js',
 'function renderDetail(){',
 """function featureSummary(xs){if(!xs.length)return 'Awaiting official audit';const wins=xs.filter(p=>p.result==='WIN').length,losses=xs.filter(p=>p.result==='LOSS').length,push=xs.filter(p=>p.result==='PUSH').length,voids=xs.filter(p=>p.result==='VOID').length;return `${wins} W / ${losses} L · ${push} push · ${voids} void`;}
function renderFeature(d){const node=$('featuredReview');if(!node)return;
 const f=d.audit?.featured,snap=d.snapshot?.featured;
 if(!snap?.top5?.length&&!snap?.top2?.length){node.innerHTML='<p class="muted">Featured Top 2/5: no timestamped pregame snapshot recorded on this slate.</p>';return;}
 const rows=f?.top5||[];
 node.innerHTML=`<section class="panel"><h3>Featured Top 2 / Top 5 · frozen pregame</h3><p class="muted">Separate tracking; these results are NOT added to the Top 10 denominator. Not a record of submitted wagers.</p><div class="row"><b>Top 2: ${esc(featureSummary(f?.top2||[]))}</b><b>Top 5: ${esc(featureSummary(rows))}</b></div><div class="table-wrap"><table><thead><tr><th>Player</th><th>Prop</th><th>Actual</th><th>Result</th></tr></thead><tbody>${rows.map(p=>`<tr><td>${esc(p.player)}</td><td>${esc(p.side)} ${esc(p.line)} ${esc(p.stat)}</td><td>${esc(p.actual)}</td><td>${esc(p.result)}</td></tr>`).join('')||'<tr><td colspan="4">Games not graded yet</td></tr>'}</tbody></table></div></section>`;
}
function renderDetail(){""")
one('public/review/review.js',
 " $('dailySource').textContent=`Source:",
 " renderFeature(d);\n $('dailySource').textContent=`Source:")

# ESPN six-stat fantasy production components; never convert missing values to zero.
one('lib/model.mjs',
 "box:{pts:at('PTS'),reb:at('REB'),ast:at('AST'),fgm:",
 "box:{pts:at('PTS'),reb:at('REB'),ast:at('AST'),stl:at('STL'),blk:at('BLK'),tov:at('TO'),fgm:")
one('lib/espn-history-v315.mjs',
 "const box={pts:numeric(at('PTS')),reb:numeric(at('REB')),ast:numeric(at('AST')),\n      fgm,",
 "const box={pts:numeric(at('PTS')),reb:numeric(at('REB')),ast:numeric(at('AST')),\n      stl:numeric(at('STL')),blk:numeric(at('BLK')),tov:numeric(at('TO')),\n      fgm,")
