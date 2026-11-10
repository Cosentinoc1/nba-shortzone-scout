#!/usr/bin/env python3
"""NBA Scout v3.15 cumulative hotfix; after PATCH_SCOUT_314.
 - Keeps all existing grading/veto rules unchanged.
 - Populates 10/20 completed played games on-demand from ESPN before the slate.
 - Does NOT write .github/workflows, avoiding the v3.14 GitHub permission failure.
"""
from pathlib import Path
import json
R=Path(__file__).resolve().parent

def one(file,old,new):
 p=R/file
 src=p.read_text(encoding='utf8')
 if new in src:return
 n=src.count(old)
 if n!=1:raise RuntimeError(f'{file}: expected unique source anchor; found {n}: {old[:120]}')
 p.write_text(src.replace(old,new,1),encoding='utf8')

def append(file,block,marker):
 p=R/file;s=p.read_text(encoding='utf8')
 if marker not in s:p.write_text(s+'\n'+block+'\n',encoding='utf8')

one('server.mjs',"import {researchPlayer,STATS} from './lib/research.mjs';",
"import {researchPlayer,STATS} from './lib/research.mjs';\nimport {parseHistoryBoxScore} from './lib/espn-history-v315.mjs';")
one('server.mjs','const monthCache=new Map(),slateCache=new Map(),lookups=new Set();',
"const monthCache=new Map(),slateCache=new Map(),lookups=new Set(),historyLookups=new Map();")

hist_function=r'''/** Lightweight historical refresh for player reports. In contrast to the background
 * whole-league shot-zone rebuild, this fetches only the team's latest completed
 * games strictly BEFORE the requested Chicago-local slate date. Box-only games
 * cannot enter shot-zone analytics (schemaVersion 1 vs validated 2).
 */
async function ensureTeamHistory(team,day){
 const key=team+'|'+day;
 if(historyLookups.has(key))return historyLookups.get(key);
 const promise=(async()=>{
  const format=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'});
  const completed=(await seasonEvents()).filter(ev=>
   format.format(new Date(ev.date))<day && (ev.competitions?.[0]?.competitors||[])
    .some(x=>normalizeTeam(x.team?.abbreviation)===team));
  const window=completed.slice(-32);
  let index=0,failures=[],boxOnly=0,validated=0;
  const missing=window.filter(ev=>!Array.isArray(gameCache[String(ev.id)]?.players));
  await Promise.all(Array.from({length:Math.min(4,missing.length)},async()=>{
   while(index<missing.length){
    const ev=missing[index++];
    try{
     const response=await fetchJson(`${BASE}/summary?event=${encodeURIComponent(ev.id)}`,14000);
     try{gameCache[String(ev.id)]=parseESPNGame(ev,response);validated++}
     catch(err){gameCache[String(ev.id)]=parseHistoryBoxScore(ev,response);boxOnly++}
    }catch(err){failures.push(`${ev.id}: ${err.message}`)}
   }
  }));
  if(missing.length!==failures.length)await saveCache();
  return {status:failures.length?'partial':'loaded',team,day,available:window.filter(ev=>Array.isArray(gameCache[String(ev.id)]?.players)).length,
   completedGamesInWindow:window.length,requested:missing.length,validated,boxOnly,failed:failures.length,
   warning:failures.length?'Some ESPN game summaries could not be loaded. The played-game list may be incomplete.':null,
   source:'ESPN final box scores, games strictly before selected slate; non-shot-zone fallback labeled'};
 })();
 historyLookups.set(key,promise);
 try{return await promise}finally{historyLookups.delete(key)}
}
'''
one('server.mjs','async function lookupPlayer(team,id){',hist_function+'\nasync function lookupPlayer(team,id){')
one('server.mjs','    const result=buildPropInsight({gameCache,rosters,players,defense,day,team,opponent,playerName:name,line,market,tier,observedAt,expectedMinutes:minutes,',
'''    let historyFetch=null;
    if((rosters[team]||[]).some(p=>keyName(p.name)===keyName(name))) {
     try{historyFetch=await ensureTeamHistory(team,day)}catch(e){historyFetch={status:'unavailable',warning:e.message}};
    }
    const result=buildPropInsight({gameCache,rosters,players,defense,day,team,opponent,playerName:name,line,market,tier,observedAt,expectedMinutes:minutes,''')
one('server.mjs','    return json(res,result);\n   }\n\n  if(pathname===\'/api/picks\'',
"    return json(res,{...result,historyFetch});\n   }\n\n  if(pathname==='/api/picks'")
one('server.mjs','   const roster=rosterFor(offense,id);\n   const result=researchPlayer(',
'''   const roster=rosterFor(offense,id);
   let historyFetch=null;
   try{historyFetch=await ensureTeamHistory(offense,day)}catch(e){historyFetch={status:'unavailable',warning:e.message}};
   const result=researchPlayer(''')
one('server.mjs',"seasonSource:'ESPN box scores · stats available only after v1.4 history refresh',cacheGames:",
"seasonSource:'ESPN box scores · last 10/20 pre-slate player appearances; loaded on demand',historyFetch,cacheGames:")
# Only fully PBP-validated games may feed shooting-zone models. Box-score-only
# fallbacks are used for prop history but cannot increase shot-zone game counts.
one('server.mjs',
 'const available=events.filter(ev=>gameCache[String(ev.id)]);',
 'const available=events.filter(ev=>gameCache[String(ev.id)]?.schemaVersion===2);')
one('server.mjs',
 'const usable=ev.filter(e=>gameCache[String(e.id)]),coverage=',
 'const usable=ev.filter(e=>gameCache[String(e.id)]?.schemaVersion===2),coverage=')
one('server.mjs',
 "const recent=Object.values(gameCache).filter(g=>g.teams?.includes(offense))",
 "const recent=Object.values(gameCache).filter(g=>g?.schemaVersion===2&&g.teams?.includes(offense))")
one('server.mjs',"version:'3.14.0',dataQuality:checkDataQuality(","version:'3.15.0',dataQuality:checkDataQuality(")

# History: maintain existing recent (exactly 10) for research ranks; add recent20
# as a separate display field so rankings cannot accidentally use a 20-game sample.
one('lib/research.mjs',
 'const last5=data.slice(-5),last10=data.slice(-10),h2h=data.filter(x=>x.opponent===defense),vals=data.map(x=>statValue(x.box,stat));',
 'const last5=data.slice(-5),last10=data.slice(-10),last20=data.slice(-20),h2h=data.filter(x=>x.opponent===defense),vals=data.map(x=>statValue(x.box,stat));')
one('lib/research.mjs',
 'const season=average(vals),l5=average(last5.map(x=>statValue(x.box,stat))),l10=average(last10.map(x=>statValue(x.box,stat)));',
 'const season=average(vals),l5=average(last5.map(x=>statValue(x.box,stat))),l10=average(last10.map(x=>statValue(x.box,stat))),l20=average(last20.map(x=>statValue(x.box,stat)));')
one('lib/research.mjs',
 'last5:hitRates(last5,stat,l,side),last10:hitRates(last10,stat,l,side),season:hitRates(data,stat,l,side)',
 'last5:hitRates(last5,stat,l,side),last10:hitRates(last10,stat,l,side),last20:hitRates(last20,stat,l,side),season:hitRates(data,stat,l,side)')
one('lib/research.mjs',
 'last5: last5.length,last10:last10.length,h2hGames:h2h.length,seasonMean:round(season),last5Mean:round(l5),last10Mean:round(l10)',
 'last5: last5.length,last10:last10.length,last20:last20.length,h2hGames:h2h.length,seasonMean:round(season),last5Mean:round(l5),last10Mean:round(l10),last20Mean:round(l20)')
one('lib/research.mjs',
 "  recent: last10.map(x=>({date:x.date,opponent:x.opponent,stat:statValue(x.box,stat),minutes:round(x.minutes),fga:x.box.fga,fta:x.box.fta,tpa:x.box.tpa,pts:x.box.pts,reb:x.box.reb,ast:x.box.ast})).reverse(),",
 "  recent: last10.map(x=>({date:x.date,opponent:x.opponent,stat:statValue(x.box,stat),minutes:round(x.minutes),fga:x.box.fga,fta:x.box.fta,tpa:x.box.tpa,pts:x.box.pts,reb:x.box.reb,ast:x.box.ast})).reverse(),\n  recent20: last20.map(x=>({date:x.date,opponent:x.opponent,stat:statValue(x.box,stat),minutes:round(x.minutes),fga:x.box.fga,fta:x.box.fta,tpa:x.box.tpa,pts:x.box.pts,reb:x.box.reb,ast:x.box.ast})).reverse(),")

# The individual player modal: game-by-game window buttons and a genuinely
# complete L20 table rather than repeating the L10 sample.
one('public/insight-ui.js',
 'function recentChart(d){const history=d.history?.more?.recent||[];',
 'function recentChart(d,count=10){const history=d.history?.more?.recent20||d.history?.more?.recent||[];')
one('public/insight-ui.js',
 'const values=[...history].reverse().slice(-10),max=',
 'const values=[...history].slice(0,count).reverse(),max=')
one('public/insight-ui.js',
 "<span>LAST 10 AVG</span><small>${esc(rateText(last10))}</small></div><div><b>${n(a.seasonMean)}",
 "<span>LAST 10 AVG</span><small>${esc(rateText(last10))}</small></div><div><b>${n(a.last20Mean)}</b><span>LAST 20 AVG</span><small>${esc(rateText(a.hitRates?.last20))}</small></div><div><b>${n(a.seasonMean)}")
one('public/insight-ui.js',
 '  <h3>Game-by-game results <small>latest 10 completed games before the slate</small></h3>${recentChart(d)}\n  <div class="stat-table"><table>',
 '''  <h3>Game-by-game results <small id="insightHistoryCaption">Last 10 played games (or all available before the slate)</small></h3>
  <div class="history-window-actions"><button type="button" data-history-count="10" aria-pressed="true">Last 10</button><button type="button" data-history-count="20" aria-pressed="false">Last 20</button></div>
  <div id="insightHistoryChart">${recentChart(d,10)}</div>
  <div id="insightHistoryRows" class="stat-table"><table>''')
one('public/insight-ui.js',
 '<tbody>${(a.recent||[]).map((x,i)=>`<tr class="${i<5?',
 '<tbody>${(a.recent20||a.recent||[]).slice(0,10).map((x,i)=>`<tr class="${i<5?')
# Attach change handler to modal content, preserving existing minutes recalculation.
one('public/insight-ui.js',
 " const minutesBtn=$('minutesApply');if(minutesBtn){",
 ''' const historyBtns=$('insightBody').querySelectorAll('[data-history-count]');
 historyBtns.forEach(btn=>btn.addEventListener('click',()=>{
  const count=Number(btn.dataset.historyCount),all=a?.recent20||a?.recent||[],rows=all.slice(0,count);
  historyBtns.forEach(b=>b.setAttribute('aria-pressed',String(b===btn)));
  const caption=$('insightHistoryCaption');if(caption)caption.textContent=`Last ${rows.length} of up to ${count} completed played games before the slate`;
  const chart=$('insightHistoryChart');if(chart)chart.innerHTML=recentChart(d,count);
  const table=$('insightHistoryRows')?.querySelector('tbody');
  if(table)table.innerHTML=rows.map((x,i)=>`<tr class="${i<5?'latest':''}"><td>${esc(x.date)}</td><td>${esc(x.opponent)}</td><td>${esc(x.stat)}</td><td>${esc(x.minutes)}</td><td>${esc(x.fga??'—')}</td><td>${esc(x.tpa??'—')}</td></tr>`).join('')||'<tr><td colspan="6">No completed player appearances available</td></tr>';
 }));
 const initialCaption=$('insightHistoryCaption');if(initialCaption)initialCaption.textContent=`Last ${(a?.recent20||a?.recent||[]).slice(0,10).length} completed played games before the slate`;
 const minutesBtn=$('minutesApply');if(minutesBtn){''')
one('public/insight-ui.js',
 " const rwSection=rw?",
 " const historyNotice=d.historyFetch?.warning?`<p class=\"report-disclaimer\">History source warning: ${esc(d.historyFetch.warning)}</p>`:'';\n const rwSection=rw?")
one('public/insight-ui.js',
 '+stats+rwSection+context+gradeCard+checkBlock+',
 ' +stats+historyNotice+rwSection+context+gradeCard+checkBlock+')

# Main Research Desk toggle (not just the offer modal).
one('public/clean.js',
 'async function analyzePlayer(){',
 '''function researchHistoryRows(res,line,side,count){
 const rows=(res.recent20||res.recent||[]).slice(0,count);
 return rows.map(row=>{const cls=row.stat===line?'push':(side==='MORE'?row.stat>line:row.stat<line)?'ok':'fail';
  return `<tr><td>${esc(row.date)}</td><td>${esc(row.opponent)}</td><td class="${cls}">${esc(row.stat)}</td><td>${esc(row.minutes)}</td></tr>`;
 }).join('')||'<tr><td colspan="4">No completed player appearances before the selected slate</td></tr>';
}
async function analyzePlayer(){''')
one('public/clean.js',
 "${rowStat('','LAST 10 AVG',human(res.last10Mean))}${rowStat('','SEASON AVG'",
 "${rowStat('','LAST 10 AVG',human(res.last10Mean))}${rowStat('','LAST 20 AVG',human(res.last20Mean))}${rowStat('','SEASON AVG'")
one('public/clean.js',
 "${rowStat('','LAST 10 HITS',label(h.last10))}${rowStat('','H2H THIS SEASON'",
 "${rowStat('','LAST 10 HITS',label(h.last10))}${rowStat('','LAST 20 HITS',label(h.last20))}${rowStat('','H2H THIS SEASON'")
one('public/clean.js',
 ''' <h4>Recent games</h4><table class="history-table"><thead><tr><th>Date</th><th>Opponent</th><th>Stat</th><th>Minutes</th></tr></thead><tbody>${(res.recent||[]).map(row=>{let cls=row.stat===line?'push':(side==='MORE'?row.stat>line:row.stat<line)?'ok':'fail';return `<tr><td>${esc(row.date)}</td><td>${esc(row.opponent)}</td><td class="${cls}">${esc(row.stat)}</td><td>${esc(row.minutes)}</td></tr>`}).join('')}</tbody></table>''',
 ''' <h4>Recent played games <small id="researchHistoryCaption">Last 10 (before selected slate)</small></h4>
 <div class="history-window-actions"><button type="button" data-research-count="10" aria-pressed="true">Last 10</button><button type="button" data-research-count="20" aria-pressed="false">Last 20</button></div>
 ${res.historyFetch?.warning?`<p class="alert">Some ESPN historical games could not load: ${esc(res.historyFetch.warning)}</p>`:''}
 <table class="history-table"><thead><tr><th>Date</th><th>Opponent</th><th>Stat</th><th>Minutes</th></tr></thead><tbody id="researchHistoryRows">${researchHistoryRows(res,line,side,10)}</tbody></table>''')
one('public/clean.js',
 "</ul></article>`;\n }catch(e){$('researchResult').innerHTML=blank('Could not complete analysis',e.message)}finally{",
 '''</ul></article>`;
 const historyBtns=$('researchResult').querySelectorAll('[data-research-count]');
 historyBtns.forEach(btn=>btn.addEventListener('click',()=>{
  const count=Number(btn.dataset.researchCount);
  historyBtns.forEach(b=>b.setAttribute('aria-pressed',String(b===btn)));
  $('researchHistoryRows').innerHTML=researchHistoryRows(res,line,side,count);
  $('researchHistoryCaption').textContent=`Last ${Math.min(count,(res.recent20||res.recent||[]).length)} played games before the slate`;
 }));
 $('researchHistoryCaption').textContent=`Last ${Math.min(10,(res.recent20||res.recent||[]).length)} played games before the slate`;
 }catch(e){$('researchResult').innerHTML=blank('Could not complete analysis',e.message)}finally{''')

append('public/clean.css', '''/* v3.15: actual last 10 / last 20 game selectors, works on narrow phones */
.history-window-actions{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0 14px}
.history-window-actions button{background:#17253c;color:#dce8f6;border:1px solid #455b78;border-radius:9px;padding:9px 14px;min-height:40px;font:inherit;cursor:pointer}
.history-window-actions button[aria-pressed="true"]{background:#315b94;color:#fff;border-color:#7fb1f5;font-weight:700}
.history-window-actions button:focus-visible{outline:2px solid #9fd1ff;outline-offset:2px}
''','/* v3.15: actual last 10 / last 20 game selectors')

# Existing daily-review code from 3.14 is carried over, versioned to v3.15;
# workflow schedule intentionally remains separate as manual GitHub user upload.
one('test/decision-v25-wiring.test.mjs',r"/version:'3\.14\.0'/",r"/version:'3\.15\.0'/")
one('test/decision-v25-wiring.test.mjs',"version,'3.14.0'","version,'3.15.0'")
print('NBA Scout v3.15: history + L10/L20 selectors + source fallback installed; no workflow auto-push attempted.')
