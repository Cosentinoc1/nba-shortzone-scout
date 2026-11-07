/* NBA Scout v1.5: minimal, source-aware, mobile-first research desk. */
const $=id=>document.getElementById(id);
const esc=x=>String(x??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const state={data:null,game:'ALL',side:'ALL',rosters:null,feedMode:'remote',lastFile:null,lines:null,gradeVisible:[],gradeLimit:80};
const blank=(title,body)=>`<div class="empty-state"><div class="empty-icon">⌁</div><h3>${esc(title)}</h3><p>${esc(body)}</p></div>`;
const human=x=>x==null?'—':String(x);
const fmt=(n,d=1)=>Number.isFinite(Number(n))?Number(n).toFixed(d):'—';
const STAT={PTS:'Points',REB:'Rebounds',AST:'Assists','3PM':'Threes',PRA:'PTS + REB + AST',RA:'REB + AST',PA:'PTS + AST',PR:'PTS + REB',FGA:'FGA','3PA':'3PA',FTM:'FT made','2PM':'2PT made'};
const request=async(path,init={})=>{const res=await fetch(path,init);const json=await res.json();if(!res.ok)throw Error(json.error||`Server returned ${res.status}`);return json};
function notify(status,detail,kind='neutral'){$('feedTitle').textContent=status;$('feedDetail').textContent=detail;$('feedCard').dataset.state=kind}
function setTab(name){for(const tab of ['picks','grades','lines','explore']){const on=tab===name;$(tab+'Page').hidden=!on;$(tab+'Page').classList.toggle('active',on);$('tab'+tab[0].toUpperCase()+tab.slice(1)).classList.toggle('active',on);$('tab'+tab[0].toUpperCase()+tab.slice(1)).setAttribute('aria-selected',String(on))}if(name==='explore')loadRoster();if(name==='lines')loadLines();if(name==='grades')renderGradeBoard()}
function setGames(data){const el=$('slateChips');const games=data?.games||[];let out=`<button class="chip ${state.game==='ALL'?'active':''}" type="button" data-game="ALL">All games</button>`;for(const g of games){if(!g.away||!g.home)continue;const n=`${g.away} @ ${g.home}`;out+=`<button class="chip ${state.game===g.id?'active':''}" type="button" data-game="${esc(g.id)}">${esc(n)}${g.completed?' · Final':''}</button>`}el.innerHTML=out;el.querySelectorAll('button').forEach(btn=>btn.addEventListener('click',()=>{state.game=btn.dataset.game;setGames(state.data);renderPicks();renderGradeBoard()}))}
function effectiveCandidates(){
 const d=state.data||{},kind=state.side;
 const arr=kind==='MORE'?d.topMore:kind==='LESS'?d.topLess:kind==='WORST'?(d.bottom10||d.unfavorable):d.candidates;
 const list=Array.isArray(arr)?arr:[];
 const games=new Map((d.games||[]).map(g=>[g.id,[g.away,g.home]])),target=state.game==='ALL'?null:games.get(state.game);
 return list.filter(c=>c.state!=='PASS'&&(!target||target.includes(c.team))).slice(0,10);
}
const checkStyle=x=>x==='veto'?'bad':x==='observed'||x==='confirmed'?'good':x==='expected'||x==='proxy'||x==='partial'||x==='model'||x==='reported'?'soft':'pending';
const checkBadgeText=x=>({veto:'VETO',observed:'SOURCED',confirmed:'CONFIRMED',expected:'EXPECTED',proxy:'PROXY',partial:'PARTIAL',model:'HISTORY',reported:'REPORTED',pending:'PENDING',unverified:'UNVERIFIED'})[x]||String(x).toUpperCase();
function renderPicks(){
 const data=state.data;if(!data)return;
 const selected=effectiveCandidates();$('pickCount').textContent=selected.length;
 const stale=data.freshness?.status==='stale'||data.freshness?.status==='unverified';
 const source=data.feed?.source||'Imported CSV',count=data.boardCount||0;
 $('pickSummary').textContent=`${count} standard lines · ${data.matched||0} scored directions · ${data.qualified||0} eligible · ${source}${stale?' · STALE': ''}`;
 $('listTag').textContent=stale?'STALE LINES':state.side==='WORST'?'Tough defensive matchups · not automatic unders':'Source-aware research · NOT final bets';
 if(!selected.length){$('picksGrid').innerHTML=blank('No eligible Top 10 candidates','Check the line source, injuries and your date filters. The app does not force a pick when evidence is missing.');return;}
 $('picksGrid').innerHTML=selected.map((c,i)=>{
  const ev=c.evidence||{},match=c.defenseGrade||{},directMatch=c.matchupGrade||{},checks=c.sourceChecks||[];
  const l10=c.hit10?.sample?`${fmt(c.hit10.winPct,0)}%`:'—';
  const pending=checks.filter(x=>['pending','unverified','veto'].includes(x.state));
  const primary=checks.filter(x=>['observed','confirmed','expected','reported','proxy','partial'].includes(x.state)).slice(0,4);
  const mismatch=state.side==='WORST';
  return `<article class="pick-card upgraded-card">
  <div class="pick-top"><span class="rank">#${i+1} · ${mismatch?'TOUGH MATCHUP':'RFPP RESEARCH CANDIDATE'}</span><span class="grade">${esc(c.score)}<small>EVIDENCE SCORE / 100</small></span></div>
  <h3 class="player-name">${esc(c.player)}</h3><div class="matchup">${esc(c.team)} vs ${esc(c.opponent)} · ${esc(STAT[c.stat]||c.stat)}</div>
  <div class="pick-main"><div><span class="line-amount">${esc(c.line)}<span>${esc(STAT[c.stat]||c.stat)} · standard line</span></span></div>
  <div class="pick-side"><span class="side-pill ${esc(c.side)}">${esc(c.side)}</span><div class="stat-name">Baseline ${fmt(c.projected)}</div></div></div>
  <div class="microstats"><div><strong>${l10}</strong><small>L10 TRUE WINS</small></div><div><strong>${fmt(c.margin)}</strong><small>BASELINE MARGIN</small></div><div><strong>${fmt(c.minutes)}</strong><small>ACTUAL L5 MIN/G</small></div></div>
  <div class="grade-band"><span class="matchup-grade">VS DEFENSE <b>${match.available?esc(directMatch.letter||'—'):'—'}</b><small>${match.available?esc(c.side)+' · '+esc(match.rank)+'/'+esc(match.totalTeams)+' · G/F/C proxy':'NOT VERIFIED'}</small></span><span class="grade-status">${esc(c.lean||'NO LEAN')}</span></div>
  <div class="tag-row"><span class="tag">Opp defense ${esc(ev.defense??'—')}/100</span><span class="tag">Role: ${esc(c.lineupStatus||'unverified')}</span><span class="tag warning">${pending.length} pending/veto checks</span></div>
  <button class="expand" type="button" aria-expanded="false">Source evidence & remaining checks ＋</button>
  <div class="evidence" hidden><h4>Measured reasons for ranking</h4><ul>${(c.reasons||[]).slice(0,8).map(x=>`<li>${esc(x)}</li>`).join('')||'<li>No measured support available.</li>'}</ul>
  <h4>Evidence grades · not probabilities</h4><div class="tag-row"><span class="tag">Baseline ${esc(ev.baseline??'—')}</span><span class="tag">Recent ${esc(ev.hitHistory??'—')}</span><span class="tag">Opportunity ${esc(ev.opportunity??'—')}</span><span class="tag">Defense ${esc(ev.defense??'—')}</span><span class="tag">Context ${esc(ev.context??'—')}</span><span class="tag">Confidence ${esc(ev.confidence??'—')}</span></div>
  <h4>Automatically sourced checks</h4><div class="source-mini">${primary.map(x=>`<div><span class="source-state ${checkStyle(x.state)}">${esc(checkBadgeText(x.state))}</span><b>${esc(x.name)}</b><small>${esc(x.detail)}</small></div>`).join('')||'<p>Public sources not currently accessible.</p>'}</div>
  <h4>Still pending · must be checked</h4><ul>${pending.slice(0,7).map(x=>`<li>${esc(x.name)} · ${esc(x.detail)}</li>`).join('')||'<li>No unresolved data checks in this view; complete final veto and market price independently.</li>'}</ul>
  <p class="review-note">Source checks are generated from real observations. Expected starters are NOT confirmed; historical minutes are NOT independent projections. No calibrated P(win) or price edge.</p></div>
  <button class="button primary full-report" type="button" data-pick-index="${i}">Open full source report ↗</button>
  </article>`}).join('');
 $('picksGrid').querySelectorAll('.expand').forEach(b=>b.onclick=()=>{const el=b.nextElementSibling;el.hidden=!el.hidden;b.setAttribute('aria-expanded',String(!el.hidden));b.textContent=el.hidden?'Source evidence & remaining checks ＋':'Hide source evidence −'});
 $('picksGrid').querySelectorAll('.full-report').forEach(b=>b.onclick=()=>window.dispatchEvent(new CustomEvent('scout-open-insight',{detail:selected[Number(b.dataset.pickIndex)]})));
}
function renderGradeBoard(){
 const list=$('gradesGrid');if(!list)return;const d=state.data;
 if(!d){list.innerHTML=blank('Rankings loading','Retrieving current prop research.');return;}
 const raw=Array.isArray(d.all)?d.all:[],needle=($('gradeSearch').value||'').toLowerCase().trim();
 const direction=$('gradeDirection').value,stat=$('gradeStat').value,sort=$('gradeSort').value,includePass=$('gradePass').checked;
 let pool=raw.filter(x=>(includePass||x.state!=='PASS')&&(stat==='ALL'||x.stat===stat)&&(!needle||(x.player+' '+x.team+' '+x.stat+' '+x.opponent).toLowerCase().includes(needle))&&(direction==='ALL'||direction==='BEST'||x.side===direction));
 if(direction==='BEST'){
  const best=new Map();for(const x of pool){const k=[x.player,x.stat,x.line,x.team].join('|');const old=best.get(k);if(!old||x.score>old.score)best.set(k,x)}pool=[...best.values()];
 }
 const accessor=x=>({score:x.score,defense:x.evidence?.defense??-1,baseline:x.evidence?.baseline??-1,opportunity:x.evidence?.opportunity??-1,confidence:x.evidence?.confidence??-1,context:x.evidence?.context??-1,last10:x.hit10?.sample?x.hit10.winPct:-1,margin:x.margin??-999})[sort]??-1;
 pool.sort((a,b)=>accessor(b)-accessor(a)||Number(a.state==='PASS')-Number(b.state==='PASS')||String(a.player).localeCompare(String(b.player)));
 state.gradeVisible=pool;
 const shown=pool.slice(0,state.gradeLimit||80);
 $('gradeSummary').textContent=`${pool.length} displayed research directions · sorted by ${$('gradeSort').selectedOptions[0]?.textContent||'score'} · G/F/C defense scores are proxies · scores are not probabilities`;
 list.innerHTML=shown.length?shown.map((x,i)=>{
  const def=x.defenseGrade||{},direct=x.matchupGrade||{},pos=x.lineupRole||'',l10=x.hit10?.sample?`${x.hit10.win}/${x.hit10.sample}`:'—';
  return `<button type="button" class="grade-item" data-grade-index="${i}" aria-label="Open ${esc(x.player)} ${esc(x.stat)} ${esc(x.side)} research"><span class="grade-name"><b>${esc(x.player)}</b><small>${esc(x.team)} vs ${esc(x.opponent)} · ${esc(STAT[x.stat]||x.stat)} ${esc(x.line)}</small></span><span class="grade-direction"><span class="side-pill ${esc(x.side)}">${esc(x.side)}</span><small>${esc(x.lean||'research')}</small></span><span class="grade-number"><b>${esc(x.score)}</b><small>OVERALL</small></span><span class="grade-number"><b>${def.available?esc(direct.letter||'—'):'—'}</b><small>VS DEF</small></span><span class="grade-number"><b>${esc(x.evidence?.opportunity??'—')}</b><small>OPP.</small></span><span class="grade-number"><b>${esc(l10)}</b><small>L10 WINS</small></span><span class="grade-number"><b>${esc(x.pendingCount??'—')}</b><small>PENDING</small></span></button>`;
 }).join(''):blank('No matching props','Adjust the direction, stat, keyword or include-PASS filter.');
 const more=$('gradeMore');more.hidden=pool.length<=shown.length;more.textContent=`Show more (${Math.max(0,pool.length-shown.length)} remaining)`;
 list.querySelectorAll('.grade-item').forEach(row=>row.onclick=()=>window.dispatchEvent(new CustomEvent('scout-open-insight',{detail:shown[Number(row.dataset.gradeIndex)]})));
}

function showFeed(d){const feed=d.feed||{},fr=d.freshness||{},n=d.boardCount||0;
 if(!feed.configured&&feed.status!=='uploaded'){$('setupNote').hidden=false;notify('No automatic prop feed connected','Use Import CSV now, or connect your approved provider in Render.');}
 else if(feed.error){$('setupNote').hidden=false;notify('Feed connection problem',feed.error,'error')}
 else if(n===0){$('setupNote').hidden=false;notify('No current NBA standard lines',`Connected source: ${feed.source||'unknown'} · nothing available`)}
 else {const stale=fr.status==='stale'||fr.status==='unverified';notify(stale?'Board needs freshness verification':`${n} standard lines loaded`,`${feed.source||'Imported CSV'} · ${fr.observedAt?'Observed '+new Date(fr.observedAt).toLocaleString():'No observation timestamp'}`,stale?'warning':'ok');$('setupNote').hidden=true;}
}
async function loadPicks(){if(state.feedMode==='import'&&state.lastFile)return uploadCsv(state.lastFile,true);
 $('refreshBtn').disabled=true;$('refreshBtn').textContent='Refreshing…';$('picksGrid').innerHTML=blank('Loading today’s board','Reading ESPN game history and the configured prop line feed.');
 try{const date=$('dateInput').value;const data=await request(`/api/picks?date=${encodeURIComponent(date)}`);state.data=data;setGames(data);showFeed(data);renderPicks();renderGradeBoard();$('netStatus').classList.add('ready');$('netStatus').innerHTML='<i></i> Connected';}
 catch(e){notify('Could not load picks',e.message,'error');$('picksGrid').innerHTML=blank('Research board unavailable',e.message)}finally{$('refreshBtn').disabled=false;$('refreshBtn').textContent='↻ Refresh'}
}
async function uploadCsv(contents,silent=false){
 $('refreshBtn').disabled=true;if(!silent)notify('Analyzing imported lines','Matching standard props with NBA slate and boxscore data…');
 try{const data=await request('/api/picks/import',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({date:$('dateInput').value,csv:contents})});state.data=data;state.feedMode='import';state.lastFile=contents;state.game='ALL';setGames(data);showFeed(data);renderPicks();renderGradeBoard();}
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
 const selected=offers.filter(r=>(tier==='ALL'||r.tier===tier)&&(!q||(r.player+' '+r.market+' '+r.team).toLowerCase().includes(q))).slice(0,300);
 const c=d.coverage||{};
 $('lineCoverage').textContent=`${offers.length} observed offers · ${d.count||0} supported standard lines · ${c.providerRows||'?'} provider rows · ${d.status||'unknown'} · ${c.truncated||c.hasMore?'INCOMPLETE / PAGED':'provider coverage not guaranteed complete'}`;
 $('linesGrid').innerHTML=selected.length?selected.map((r,i)=>`<article class="pick-card offer-card" role="button" tabindex="0" data-offer-index="${i}" aria-label="Research ${esc(r.player)} ${esc(r.market)} ${esc(r.line)}"><div class="pick-top"><span class="rank">${esc(r.team||'Unknown team')} · ${esc(r.tier||'unverified')} · ${esc(r.period||'unknown')}</span><span class="mini-report">RESEARCH ↗</span></div><h3 class="player-name">${esc(r.player)}</h3><div class="matchup">${esc(r.market.replace(/^player_/,'').replace(/_/g,' '))}</div><div class="pick-main"><span class="line-amount">${esc(r.line)}</span><span class="stat-name">${esc(r.observedAt?new Date(r.observedAt).toLocaleTimeString():'time unavailable')}</span></div><div class="offer-foot">Tap to see last 5 / last 10, lean & live checks ↗</div></article>`).join(''):blank('No matching lines','Change the search or tier filter.');
 const open=el=>window.dispatchEvent(new CustomEvent('scout-open-insight',{detail:selected[Number(el.dataset.offerIndex)]}));
 $('linesGrid').querySelectorAll('.offer-card').forEach(card=>{card.addEventListener('click',()=>open(card));card.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open(card)}})});
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
 $('tabPicks').onclick=()=>setTab('picks');$('tabGrades').onclick=()=>setTab('grades');$('tabExplore').onclick=()=>setTab('explore');$('tabLines').onclick=()=>setTab('lines');$('lineSearch').oninput=renderLines;for(const key of ['gradeSearch','gradeDirection','gradeStat','gradeSort','gradePass']){$(key).addEventListener(key==='gradeSearch'?'input':'change',()=>{state.gradeLimit=80;renderGradeBoard()})}$('gradeMore').onclick=()=>{state.gradeLimit+=80;renderGradeBoard()};$('lineTier').onchange=renderLines;$('refreshBtn').onclick=()=>{state.feedMode='remote';state.lastFile=null;loadPicks()};$('sideFilter').onchange=e=>{state.side=e.target.value;renderPicks()};$('dateInput').onchange=()=>{state.game='ALL';state.lines=null;loadPicks()};$('teamSelect').onchange=onTeam;$('researchBtn').onclick=analyzePlayer;
 $('csvInput').onchange=async e=>{const f=e.target.files?.[0];if(!f)return;if(f.size>350000){notify('CSV too large','Export only the standard NBA props, maximum 350 KB','error');return}const t=await f.text();await uploadCsv(t);e.target.value=''};
 try{const status=await request('/api/status');$('dateInput').value=status.date;$('netStatus').innerHTML='<i></i> Connected';$('netStatus').classList.add('ready')}
 catch{$('dateInput').value=new Date().toISOString().slice(0,10)}
 await loadPicks();
}
boot();
