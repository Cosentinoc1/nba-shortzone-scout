/* NBA Scout v1.5: minimal, source-aware, mobile-first research desk. */
const $=id=>document.getElementById(id);
const esc=x=>String(x??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const state={data:null,game:'ALL',side:'ALL',rosters:null,feedMode:'remote',lastFile:null,lines:null};
const blank=(title,body)=>`<div class="empty-state"><div class="empty-icon">⌁</div><h3>${esc(title)}</h3><p>${esc(body)}</p></div>`;
const human=x=>x==null?'—':String(x);
const fmt=(n,d=1)=>Number.isFinite(Number(n))?Number(n).toFixed(d):'—';
const STAT={PTS:'Points',REB:'Rebounds',AST:'Assists','3PM':'Threes',PRA:'PTS + REB + AST',RA:'REB + AST',PA:'PTS + AST',PR:'PTS + REB',FGA:'FGA','3PA':'3PA',FTM:'FT made','2PM':'2PT made'};
const request=async(path,init={})=>{const res=await fetch(path,init);const json=await res.json();if(!res.ok)throw Error(json.error||`Server returned ${res.status}`);return json};
function notify(status,detail,kind='neutral'){$('feedTitle').textContent=status;$('feedDetail').textContent=detail;$('feedCard').dataset.state=kind}
function setTab(name){for(const tab of ['picks','lines','explore']){const on=tab===name;$(tab+'Page').hidden=!on;$(tab+'Page').classList.toggle('active',on);$('tab'+tab[0].toUpperCase()+tab.slice(1)).classList.toggle('active',on);$('tab'+tab[0].toUpperCase()+tab.slice(1)).setAttribute('aria-selected',String(on))}if(name==='explore')loadRoster();if(name==='lines')loadLines()}
function setGames(data){const el=$('slateChips');const games=data?.games||[];let out=`<button class="chip ${state.game==='ALL'?'active':''}" type="button" data-game="ALL">All games</button>`;for(const g of games){if(!g.away||!g.home)continue;const n=`${g.away} @ ${g.home}`;out+=`<button class="chip ${state.game===g.id?'active':''}" type="button" data-game="${esc(g.id)}">${esc(n)}${g.completed?' · Final':''}</button>`}el.innerHTML=out;el.querySelectorAll('button').forEach(btn=>btn.addEventListener('click',()=>{state.game=btn.dataset.game;setGames(state.data);renderPicks()}))}
function effectiveCandidates(){
 const d=state.data||{},kind=state.side;
 const arr=kind==='MORE'?d.topMore:kind==='LESS'?d.topLess:kind==='WORST'?d.unfavorable:d.all;
 const candidates=Array.isArray(arr)?arr:[];
 const knownGames=new Map((d.games||[]).map(g=>[g.id,[g.away,g.home]]));
 const matching=state.game==='ALL'?null:knownGames.get(state.game);
 let filtered=candidates.filter(c=>c.state!=='PASS'&&(kind==='WORST'||c.margin>0)&&(!matching||matching.includes(c.team)));
 let used=new Set(),res=[];for(const c of filtered){const k=c.player.toLowerCase();if(used.has(k))continue;used.add(k);res.push(c);if(res.length>=6)break}return res;
}

function renderPicks(){
 const data=state.data;if(!data)return;
 const filter=effectiveCandidates();$('pickCount').textContent=filter.length;
 const stale=data.freshness?.status==='stale'||data.freshness?.status==='unverified';const observed=data.freshness?.observedAt?new Date(data.freshness.observedAt).toLocaleString():null;
 const source=data.feed?.source||'Imported CSV';const count=Number(data.boardCount)||0;
 if(!count){$('picksGrid').innerHTML=blank('Connect your NBA prop board','Import today’s standard-line CSV, or configure an automatic data source in Render. No lines means no verified picks.');$('pickSummary').textContent=`${(data.games||[]).length} NBA games · waiting for standard lines`;return}
 if(!filter.length){$('picksGrid').innerHTML=blank('No qualified research candidates','No players on this slate have enough pregame history at the supplied standard lines. Check the feed date, upload a new board or change filters.');$('pickSummary').textContent=`${count} standard props · ${data.matched||0} screened sides · ${(data.games||[]).length} NBA games`;return}
 const freshnessNotice=stale?' · STALE / UNVERIFIED — not current picks':'';
 $('pickSummary').textContent=`${count} supported standard lines · ${data.matched} screened directions · ${data.qualified||0} eligible · ${source}${freshnessNotice}`;
 $('listTag').textContent=stale?'Old / unverified lines':state.side==='WORST'?'Not automatic LESS plays':'Research only';
 $('picksGrid').innerHTML=filter.map((c,i)=>{
  const h=c.hit10;const pct=h?.sample?`${fmt(h.winPct,0)}%`:'—';
  const reasons=(c.reasons||[]).slice(0,7);const risks=(c.checks||[]).slice(0,8);const ev=c.evidence||{};
  const labels=[c.zoneScore!=null?`Zone ${fmt(c.zoneScore,0)}/100`:'Zone not scored',c.minutes!=null?`${c.minutes} min L5`:'Minutes missing',`${risks.length} checks pending`];
  return `<article class="pick-card">
    <div class="pick-top"><span class="rank">#${i+1} · ${c.unfavorable?'UNFAVORABLE SHOT-ZONE MATCHUP':'RESEARCH CANDIDATE'}</span><span class="grade">${esc(c.score)}<small>SCREENING SCORE / 100</small></span></div>
    <h3 class="player-name">${esc(c.player)}</h3><div class="matchup">${esc(c.team)} vs ${esc(c.opponent)} · ${esc(STAT[c.stat]||c.stat)}</div>
    <div class="pick-main"><div><span class="line-amount">${esc(c.line)}<span>${esc(STAT[c.stat]||c.stat)} · exact source line</span></span></div><div style="text-align:right"><span class="side-pill ${esc(c.side)}">${c.side==='MORE'?'MORE ↑':'LESS ↓'}</span><div class="stat-name">Baseline ${fmt(c.projected)}</div></div></div>
    <div class="microstats"><div><strong>${pct}</strong><small>L10 TRUE WINS</small></div><div><strong>${fmt(c.margin)}</strong><small>DIRECTIONAL GAP</small></div><div><strong>${fmt(c.minutes)}</strong><small>LAST 5 MIN / G</small></div></div>
    <div class="tag-row">${labels.map((x,j)=>`<span class="tag ${j===2?'warning':''}">${esc(x)}</span>`).join('')}${stale?'<span class="tag warning">SOURCE STALE</span>':''}</div>
    <button class="expand" type="button" aria-expanded="false">Why this ranks here ＋</button>
    <div class="evidence" hidden><h4>Supporting data</h4><ul>${reasons.map(x=>`<li>${esc(x)}</li>`).join('')||'<li>No verified supporting measurements available</li>'}</ul><h4>Evidence grades (not win probabilities)</h4><div class="tag-row"><span class="tag">Baseline ${esc(ev.baseline??'—')}</span><span class="tag">Recent ${esc(ev.hitHistory??'—')}</span><span class="tag">Opportunity ${esc(ev.opportunity??'—')}</span><span class="tag">Matchup ${esc(ev.matchup??'—')}</span><span class="tag">Confidence ${esc(ev.confidence??'—')}</span></div><h4>Still needs checking</h4><ul>${risks.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>
    <h4>Independent final checks</h4><div class="verify"><label><input type="checkbox"> Injuries & starter</label><label><input type="checkbox"> Projected minutes</label><label><input type="checkbox"> Actual opportunity</label><label><input type="checkbox"> Current line & payout</label></div>
    <p class="review-note">${stale?'This line is not fresh. Refresh before considering it.':'No verified betting edge; complete the checks and run a second veto review.'}</p></div>
  </article>`}).join('');
 $('picksGrid').querySelectorAll('.expand').forEach(btn=>btn.addEventListener('click',()=>{const content=btn.nextElementSibling;content.hidden=!content.hidden;btn.setAttribute('aria-expanded',String(!content.hidden));btn.textContent=content.hidden?'Why this ranks here ＋':'Hide evidence −'}));
 $('picksGrid').querySelectorAll('.verify').forEach(group=>group.addEventListener('change',()=>{const check=Array.from(group.querySelectorAll('input')).every(x=>x.checked);const note=group.nextElementSibling;note.textContent=check?'Checklist marked by you — independent second-pass veto and true edge still required.':'Pending: verify injury, role, opportunity, line and price.'}));
}
function showFeed(d){const feed=d.feed||{},fr=d.freshness||{},n=d.boardCount||0;
 if(!feed.configured&&feed.status!=='uploaded'){$('setupNote').hidden=false;notify('No automatic prop feed connected','Use Import CSV now, or connect your approved provider in Render.');}
 else if(feed.error){$('setupNote').hidden=false;notify('Feed connection problem',feed.error,'error')}
 else if(n===0){$('setupNote').hidden=false;notify('No current NBA standard lines',`Connected source: ${feed.source||'unknown'} · nothing available`)}
 else {const stale=fr.status==='stale'||fr.status==='unverified';notify(stale?'Board needs freshness verification':`${n} standard lines loaded`,`${feed.source||'Imported CSV'} · ${fr.observedAt?'Observed '+new Date(fr.observedAt).toLocaleString():'No observation timestamp'}`,stale?'warning':'ok');$('setupNote').hidden=true;}
}
async function loadPicks(){if(state.feedMode==='import'&&state.lastFile)return uploadCsv(state.lastFile,true);
 $('refreshBtn').disabled=true;$('refreshBtn').textContent='Refreshing…';$('picksGrid').innerHTML=blank('Loading today’s board','Reading ESPN game history and the configured prop line feed.');
 try{const date=$('dateInput').value;const data=await request(`/api/picks?date=${encodeURIComponent(date)}`);state.data=data;setGames(data);showFeed(data);renderPicks();$('netStatus').classList.add('ready');$('netStatus').innerHTML='<i></i> Connected';}
 catch(e){notify('Could not load picks',e.message,'error');$('picksGrid').innerHTML=blank('Research board unavailable',e.message)}finally{$('refreshBtn').disabled=false;$('refreshBtn').textContent='↻ Refresh'}
}
async function uploadCsv(contents,silent=false){
 $('refreshBtn').disabled=true;if(!silent)notify('Analyzing imported lines','Matching standard props with NBA slate and boxscore data…');
 try{const data=await request('/api/picks/import',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({date:$('dateInput').value,csv:contents})});state.data=data;state.feedMode='import';state.lastFile=contents;state.game='ALL';setGames(data);showFeed(data);renderPicks();}
 catch(e){notify('Could not read imported CSV',e.message,'error');$('picksGrid').innerHTML=blank('CSV import failed',e.message)}finally{$('refreshBtn').disabled=false}
}
async function loadLines(){
 if(state.lines){renderLines();return}
 $('linesGrid').innerHTML=blank('Checking observed lines','Reading the current provider snapshot…');
 try{state.lines=await request('/api/lines');renderLines()}catch(e){$('linesGrid').innerHTML=blank('Unable to load lines',e.message)}
}
function renderLines(){const d=state.lines;if(!d)return;
 const q=($('lineSearch')?.value||'').trim().toLowerCase(),tier=$('lineTier')?.value||'ALL';
 const offers=Array.isArray(d.offers)?d.offers:[];
 const selected=offers.filter(r=>(tier==='ALL'||r.tier===tier)&&(!q||(r.player+' '+r.market+' '+r.team).toLowerCase().includes(q))).slice(0,250);
 const c=d.coverage||{};
 $('lineCoverage').textContent=`${offers.length} observed offers · ${d.count||0} supported standard lines · ${c.providerRows||'?'} provider rows · ${d.status||'unknown'} · ${c.truncated||c.hasMore?'INCOMPLETE / PAGED':'provider coverage not guaranteed complete'}`;
 $('linesGrid').innerHTML=selected.length?selected.map(r=>`<article class="pick-card"><div class="pick-top"><span class="rank">${esc(r.team||'Unknown team')} · ${esc(r.tier||'unverified')} · ${esc(r.period||'unknown')}</span></div><h3 class="player-name">${esc(r.player)}</h3><div class="matchup">${esc(r.market)}</div><div class="pick-main"><span class="line-amount">${esc(r.line)}</span><span class="stat-name">${esc(r.observedAt?new Date(r.observedAt).toLocaleTimeString():'time unavailable')}</span></div></article>`).join(''):blank('No matching lines','Change the search or tier filter.');
}
async function loadRoster(){if(state.rosters)return;try{const b=await request('/api/bootstrap');state.rosters=b.rosters||{};const teams=Object.keys(state.rosters).sort();$('teamSelect').innerHTML='<option value="">Choose team</option>'+teams.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('');$('defSelect').innerHTML='<option value="">Choose opponent</option>'+teams.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('')}
 catch(e){$('researchResult').innerHTML=blank('Player directory unavailable',e.message)}}
function onTeam(){const team=$('teamSelect').value;$('playerSelect').innerHTML='<option value="">Choose player</option>'+(state.rosters?.[team]||[]).map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');let match=(state.data?.games||[]).find(g=>g.home===team||g.away===team);if(match)$('defSelect').value=match.away===team?match.home:match.away}
function rowStat(name,label,value){return `<div class="metric"><b>${esc(value)}</b><small>${esc(label||name)}</small></div>`}
async function analyzePlayer(){const team=$('teamSelect').value,id=$('playerSelect').value,def=$('defSelect').value,line=Number($('lineInput').value),stat=$('statSelect').value,side=$('directionSelect').value;
 if(!team||!id||!def||team===def||$('lineInput').value===''){ $('researchResult').innerHTML=blank('Complete the research fields','Choose different offense and opponent teams, a player and the exact current line.');return}
 $('researchBtn').disabled=true;$('researchResult').innerHTML=blank('Analyzing player','Rebuilding prior-game evidence and shot-zone alignment…');
 try{const q=new URLSearchParams({offense:team,defense:def,playerId:id,line:String(line),stat,side,date:$('dateInput').value});const [res,match]=await Promise.all([request(`/api/research?${q}`),request(`/api/matchup?${new URLSearchParams({offense:team,defense:def,playerId:id})}`)]);
 const h=res.hitRates||{};let label=r=>r?.sample?`${r.win}/${r.sample} true wins · ${r.push} pushes`:'Not enough data';
 $('researchResult').innerHTML=`<article class="research-card"><span class="overline">RESEARCH REPORT</span><h3>${esc(res.player)} · ${esc(STAT[stat]||stat)} ${esc(side)}</h3><div class="matchup">${esc(team)} vs ${esc(def)} · exact line ${esc(line)}</div>
 <div class="metric-row">${rowStat('','LAST 5 AVG',human(res.last5Mean))}${rowStat('','LAST 10 AVG',human(res.last10Mean))}${rowStat('','SEASON AVG',human(res.seasonMean))}${rowStat('','BASELINE (NOT P-WIN)',human(res.projectedBaseline))}</div>
 <div class="metric-row">${rowStat('','LAST 5 HITS',label(h.last5))}${rowStat('','LAST 10 HITS',label(h.last10))}${rowStat('','H2H THIS SEASON',label(h.h2h))}${rowStat('','SHOT-ZONE MATCHUP',match.grade?.eligible?`${fmt(match.grade.score,0)}/100`:'Insufficient')}</div>
 <div class="alert">${esc(res.lean)} · Role, injuries, independent minutes, tracking opportunities, exact live line and pricing still require verification. Shot-zone grade is descriptive.</div>
 <div class="tag-row"><span class="tag">Last 5 FGA ${esc(human(res.opportunity?.fgaL5))}</span><span class="tag">Last 5 3PA ${esc(human(res.opportunity?.tpaL5))}</span><span class="tag">Last 5 minutes ${esc(human(res.opportunity?.minutesL5))}</span></div>
 <h4>Recent games</h4><table class="history-table"><thead><tr><th>Date</th><th>Opponent</th><th>Stat</th><th>Minutes</th></tr></thead><tbody>${(res.recent||[]).map(row=>{let cls=row.stat===line?'push':(side==='MORE'?row.stat>line:row.stat<line)?'ok':'fail';return `<tr><td>${esc(row.date)}</td><td>${esc(row.opponent)}</td><td class="${cls}">${esc(row.stat)}</td><td>${esc(row.minutes)}</td></tr>`}).join('')}</tbody></table>
 <h4>Veto checklist</h4><ul>${(res.notes||[]).map(n=>`<li>${esc(n)}</li>`).join('')}</ul></article>`;
 }catch(e){$('researchResult').innerHTML=blank('Could not complete analysis',e.message)}finally{$('researchBtn').disabled=false}
}
async function boot(){
 $('tabPicks').onclick=()=>setTab('picks');$('tabExplore').onclick=()=>setTab('explore');$('tabLines').onclick=()=>setTab('lines');$('lineSearch').oninput=renderLines;$('lineTier').onchange=renderLines;$('refreshBtn').onclick=()=>{state.feedMode='remote';state.lastFile=null;loadPicks()};$('sideFilter').onchange=e=>{state.side=e.target.value;renderPicks()};$('dateInput').onchange=()=>{state.game='ALL';state.lines=null;loadPicks()};$('teamSelect').onchange=onTeam;$('researchBtn').onclick=analyzePlayer;
 $('csvInput').onchange=async e=>{const f=e.target.files?.[0];if(!f)return;if(f.size>350000){notify('CSV too large','Export only the standard NBA props, maximum 350 KB','error');return}const t=await f.text();await uploadCsv(t);e.target.value=''};
 try{const status=await request('/api/status');$('dateInput').value=status.date;$('netStatus').innerHTML='<i></i> Connected';$('netStatus').classList.add('ready')}
 catch{$('dateInput').value=new Date().toISOString().slice(0,10)}
 await loadPicks();
}
boot();
