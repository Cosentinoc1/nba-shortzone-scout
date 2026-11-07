'use strict';
const KEYS=['rim','paint','mid','left','right','above'];
const LABELS={rim:'Restricted area',paint:'Paint (non-RA)',mid:'Mid-range',left:'Left corner 3',right:'Right corner 3',above:'Above-break 3'};
const $=id=>document.getElementById(id);
const safe=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const fmt=n=>Number.isFinite(+n)?Number(n).toLocaleString():'—';
const pct=n=>Number.isFinite(n)?(n*100).toFixed(1)+'%':'—';
const signed=n=>Number.isFinite(n)?(n>0?'+':'')+n.toFixed(1)+'pp':'—';
const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]/g,'').toLowerCase();
let selectedDate=null,selectedGameId=null,selectedGameDirection='away',slateRequestSerial=0;
let db=null,rankScope='today',lastGrade=null,requestSerial=0,currentLookup=null,lookupTicker=null;
async function api(url,options){const r=await fetch(url,{cache:'no-store',...options});let body=await r.json();if(!r.ok)throw new Error(body.error||body.reason||'Request failed');return body}
const prop=(p,k)=>(p?.zones?.[k]||{fga:0,fgm:0});
const total=p=>KEYS.reduce((v,k)=>v+(+prop(p,k).fga||0),0);
function rosterItem(){return (db?.rosters?.[$('offense').value]||[]).find(x=>String(x.id)===$('player').value)}
function profileLocal(){let r=rosterItem();if(!r)return null;return db.players.find(p=>p.team===$('offense').value&&normalize(p.name)===normalize(r.name))||null}
function defenseTeam(){return db?.defense?.teams?.find(x=>x.code===$('team').value)}
function league(){return db?.defense?.league}
function choices(select,arr,previous){select.replaceChildren();for(const [value,label] of arr){const o=document.createElement('option');o.value=value;o.textContent=label;select.appendChild(o)}if(previous&&arr.some(x=>x[0]===previous))select.value=previous}
function fillTeams(){const list=[...db.defense.teams].sort((a,b)=>a.name.localeCompare(b.name)).map(t=>[t.code,t.name]);choices($('team'),list,$('team').value||'CHA');choices($('offense'),list,$('offense').value||'BOS');choices($('compare'),[['','None'],...list],$('compare').value)}
function fillPlayers(preferredId){let arr=(db.rosters[$('offense').value]||[]).slice().sort((a,b)=>a.name.localeCompare(b.name));choices($('player'),arr.map(p=>[String(p.id),p.name+(p.pos?' · '+p.pos:'')]),preferredId||$('player').value);if(!arr.length)$('player').innerHTML='<option value="">Roster not available</option>'}
function showCoverage(){let s=db.status,source=s.source||'Saved snapshot';$('coverage').textContent=`${s.rosterProfiles??s.playerProfiles}/${s.rosterPlayers} players with profiles (${s.profileCoveragePct??'?'}%) · 30 rosters`; $('dataAsOf').textContent=`${source} · as of ${s.dataAsOf}`; $('playerLookupBadge').textContent='Server connected';$('syncHealth').textContent=s.refresh?.active?'Syncing':'Server online';}
function shortDayLabel(day){
 try{return new Date(day+'T12:00:00Z').toLocaleDateString('en-US',{timeZone:'UTC',weekday:'long',month:'long',day:'numeric',year:'numeric'})}catch{return day}
}
function gameClock(g){
 if(g.completed)return 'Final';
 if(g.state==='in')return g.statusText||'Live';
 if(!g.tipoff)return 'Tipoff TBD';
 try{return new Intl.DateTimeFormat('en-US',{hour:'numeric',minute:'2-digit',timeZone:'America/Chicago'}).format(new Date(g.tipoff))+' CT'}catch{return 'Tipoff TBD'}
}
function gameScores(g){
 if(g.state!=='post'&&g.state!=='in')return 'AT';
 if(g.awayScore==null||g.homeScore==null)return 'AT';
 return safe(g.awayScore)+' – '+safe(g.homeScore);
}
function favoredRosterId(team){
 const roster=db.rosters[team]||[];
 // Favor a real shooter with verified season attempts over an alphabetical bench player.
 const sorted=[...db.players].filter(p=>p.team===team&&p.gp>=2).sort((a,b)=>total(b)-total(a));
 for(const p of sorted){const r=roster.find(r=>normalize(r.name)===normalize(p.name));if(r&&total(p)>0)return String(r.id)}
 return roster[0]?String(roster[0].id):null;
}
function loadGame(g,direction='away'){
 if(!db||!g||!db.rosters[g.away]||!db.rosters[g.home])return;
 const offense=direction==='home'?g.home:g.away,defense=direction==='home'?g.away:g.home;
 selectedGameId=g.id;selectedGameDirection=direction;
 $('offense').value=offense;$('team').value=defense;
 fillPlayers(favoredRosterId(offense));renderToday();selectChanged();
 $('selectedGameHint').innerHTML=`<b>${safe(g.away)} @ ${safe(g.home)}</b> · Analyzing <b>${safe(offense)} shooters</b> vs <b>${safe(defense)} defense</b>. Choose a different player below to see their individual grade.`;
 $('matchupControls').scrollIntoView({behavior:'smooth',block:'start'});
}
function renderToday(){
 const host=$('todayGames');host.replaceChildren();
 $('dailyTitle').textContent=(selectedDate===db?.status?.date?"Today's Games":'NBA Games')+' · '+shortDayLabel(selectedDate);
 $('gameDate').value=selectedDate;
 const games=db.schedule||[];
 $('gameCount').textContent=games.length?`${games.length} game${games.length===1?'':'s'} · choose any matchup`:'No NBA games listed for this date';
 if(!games.length){host.innerHTML='<div class="slate-empty">No scheduled NBA games were returned for this date. Select another day above.</div>';return}
 for(const g of games){
  const card=document.createElement('article');card.className='slate-game'+(g.id===selectedGameId?' selected':'');card.setAttribute('role','listitem');
  const clock=gameClock(g),status=g.state==='in'?'Live':g.completed?'Final':'Scheduled';
  card.innerHTML=`<div class="game-statusline"><span class="game-status ${g.state==='in'?'live':''}">${safe(status)}</span><span>${safe(clock)}</span></div>
   <div class="game-versus"><div class="game-team"><span class="game-team-code">${safe(g.away)}</span><span class="game-team-role">AWAY</span></div>
    <div class="game-versus-center">${gameScores(g)}</div>
    <div class="game-team"><span class="game-team-code">${safe(g.home)}</span><span class="game-team-role">HOME</span></div></div>
   <div class="game-choices"><button type="button" class="game-pick ${g.id===selectedGameId&&selectedGameDirection==='away'?'active':''}" data-side="away">Analyze ${safe(g.away)}</button><button type="button" class="game-pick ${g.id===selectedGameId&&selectedGameDirection==='home'?'active':''}" data-side="home">Analyze ${safe(g.home)}</button></div>`;
  card.querySelector('[data-side="away"]').addEventListener('click',()=>loadGame(g,'away'));
  card.querySelector('[data-side="home"]').addEventListener('click',()=>loadGame(g,'home'));
  // One tap on a card loads the away offense against the home defense.
  card.addEventListener('click',e=>{if(!e.target.closest('button'))loadGame(g,'away')});
  host.appendChild(card);
 }
}
async function changeDay(day,force=false){
 if(!day||day<'2026-10-20'||day>'2027-04-11')return;
 selectedDate=day;selectedGameId=null;
 db.schedule=[];
 $('selectedGameHint').textContent='Select a game to load its matchup.';
 $('gameCount').textContent='Loading games for '+shortDayLabel(day)+'…';
 $('todayGames').innerHTML='<div class="slate-empty">Loading NBA schedule…</div>';
 $('gameDate').value=day;
 await loadSchedule(force);
}
function moveSlateDay(amount){
 const d=new Date((selectedDate||db.status.date)+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+amount);
 const next=d.toISOString().slice(0,10);changeDay(next);
}
function zoneHeat(def,z,mode,p){const x=def.zones[z],b=league().zones[z];let delta=mode==='fg'?(x.fg-b.fg):x.share-b.share;if(mode==='matchup'&&p){let share=prop(p,z).fga/Math.max(1,total(p));delta=(.68*(x.share-b.share)/.055+.32*(x.fg-b.fg)/.07)*Math.min(1,share/.18)*.11}let t=Math.min(1,Math.abs(delta)/(mode==='fg'?.11:.09));let s=delta>=0?[217,74,98]:[43,142,166];let n=[69,103,127].map((v,i)=>Math.round(v+(s[i]-v)*t));return `rgb(${n.join(',')})`}
function renderCourt(p,grade){let d=defenseTeam();if(!d)return;const m=$('measure').value,t=total(p);
 $('courtTitle').textContent=m==='matchup'?(p?`${p.name} vs ${d.name}`:`${d.name} · awaiting shooter`):`${d.name} · opponent ${m==='fg'?'FG%':'shot frequency'}`;
 $('snapshot').textContent=`Defense: ${db.status.source} · ${db.status.dataAsOf}`;
 for(let k of KEYS){$('zone-'+k).setAttribute('fill',zoneHeat(d,k,m,p));let dz=d.zones[k],pz=prop(p,k),pl=document.querySelector(`.plate[data-key="${k}"]`);
   let line1=LABELS[k],line2=m==='fg'?pct(dz.fg):pct(dz.share);
   if(m==='matchup'&&p){line2=`${pz.fga} FGA · ${pct(pz.fga/t)}`}
   pl.innerHTML=`<b>${safe(line1)}</b><em>${safe(line2)}</em><small>#${dz.rank_share??'—'}</small><i>${m==='matchup'?`Opp. ${pct(dz.share)} · ${pct(dz.fg)} FG`:`${m==='fg'?'Allowed FG%':'Attempts share'} · #${dz.rank_share??'—'} rank`}</i>`;
 }
 $('detailTitle').textContent=p?`${p.name} × ${d.name}`:`${d.name} defensive profile`;
 $('playerFga').textContent=p?fmt(t):'—';$('playerRate').textContent=p?.gp? (t/p.gp).toFixed(1):'—';$('defFga').textContent=fmt(d.attempts||KEYS.reduce((n,k)=>n+(d.zones[k].fga||0),0));
 $('topZone').textContent=p?LABELS[[...KEYS].sort((a,b)=>prop(p,b).fga-prop(p,a).fga)[0]]:'—';
 $('zoneCompare').innerHTML=KEYS.map(k=>{const q=prop(p,k),z=d.zones[k];return `<tr><td>${LABELS[k]}</td><td>${p?fmt(q.fga):'—'}</td><td>${p&&q.fga?pct(q.fgm/q.fga):'—'}</td><td>${pct(z.share)}</td><td>${pct(z.fg)}</td><td>#${z.rank_share??'—'}</td></tr>`}).join('');
 if(grade?.rows?.length){let best=[...grade.rows].sort((a,b)=>b.contribution-a.contribution)[0],worst=[...grade.rows].sort((a,b)=>a.contribution-b.contribution)[0];$('matchupReading').innerHTML=`<p><b>Best overlap:</b> ${safe(best.name)} — the defense allows ${signed(best.shareDeltaPP)} extra shot-share points relative to the league and ${signed(best.fgDeltaPP)} opponent FG% points.</p><p><b>Most restrictive overlap:</b> ${safe(worst.name)} (${signed(worst.shareDeltaPP)} shot share; ${signed(worst.fgDeltaPP)} FG%).</p>`;}
 else $('matchupReading').textContent='No eligible shooter profile yet. Defensive zones are shown, but no player matchup inference is available.';
 $('qualityNote').textContent=p?`Player source: ${p.source||'NBA saved snapshot'} (${p.asof||db.status.dataAsOf}). Defense source: ${db.status.source}. ${p.gp?`Player games: ${p.gp}.`:'Games played unknown.'} ESPN reconstructed coordinates and official NBA zones may differ.`:'No confirmed player six-zone profile. Nothing will be assigned a matchup grade without measured attempts.';
}
function signalLabel(n){if(n>=.2)return 'Favorable';if(n<=-.2)return 'Restrictive';return 'Near neutral'}
function renderGrade(g,p){lastGrade=g;if(!g?.score){$('gradeNumber').textContent='—';$('gradeLetter').textContent=g?.reason||'Not graded';$('gradeStatus').textContent='Insufficient data';$('gradePlayerLabel').textContent=p?.name||'Choose a player';$('gradeConfidence').textContent='Requires actual shooting attempts';$('gradeDrivers').textContent='No matchup grade without a measured shot-zone profile.';$('gradeZoneDetail').textContent='Six-zone profile unavailable.';return}
 $('gradeNumber').textContent=g.score.toFixed(1);$('gradeNumber').style.color=g.score>=58?'#36d6a3':g.score<46?'#fc8d98':'#e8cc80';$('gradeLetter').textContent=`${g.grade} · ${g.score>=58?'Favorable alignment':g.score<46?'Restrictive alignment':'Mixed matchup'}`;
 $('gradeStatus').textContent=g.eligible?'Eligible for rankings':'Provisional grade';$('gradePlayerLabel').textContent=`${p.name} • ${p.team} • ${g.total} FGA in ${g.gp||'?'} games`; $('gradeConfidence').textContent=`Data confidence: ${g.confidence}`;
 for(const [id,bar,val] of [['gradeVolume','volumeTrack',g.volumeSignal],['gradeAccuracy','accuracyTrack',g.efficiencySignal]]){$(id).textContent=`${val>0?'+':''}${val.toFixed(2)} · ${signalLabel(val)}`;$(bar).style.width=(50+val*45)+'%';$(bar).style.background=val>=0?'#3ad8a6':'#ef7d89'}
 $('gradeDrivers').innerHTML=g.drivers.map(x=>`${x.contribution>=0?'▲':'▼'} <b>${safe(x.name)}</b> · ${x.playerFga} FGA (${pct(x.playerShare)} of player's shots), defense ${signed(x.shareDeltaPP)} share / ${signed(x.fgDeltaPP)} FG%.`).join('<div style="margin:6px 0"></div>');
 $('gradeZoneDetail').innerHTML='<div class="grade-zone-row header"><span>ZONE</span><span>PLAYER FGA</span><span>DEF RANK</span><span>FG% GAP</span></div>'+g.rows.map(r=>`<div class="grade-zone-row"><span>${safe(r.name)}</span><span>${r.playerFga}</span><span>#${r.defRank??'—'}</span><span style="color:${r.fgDeltaPP>=0?'#70ddb4':'#ffa6af'}">${signed(r.fgDeltaPP)}</span></div>`).join('');
 $('gradeCaveat').textContent=`Scoring formula: ${g.method} ${g.eligible?'Meets minimum FGA and games sample.':'PROVISIONAL: fewer than four games or 40 shots, so excluded from Top/Worst 6 rankings.'} This does not account for expected minutes, opponent defenders or today's market lines.`;
}
function renderBoard(){let d=db.defense;let columns='<th>Team</th>'+KEYS.map(k=>`<th>${safe(LABELS[k])}<br><small>share • rank</small></th>`).join('');$('columns').innerHTML=columns;
 let by=[...d.teams].sort((a,b)=>a.name.localeCompare(b.name));$('board').innerHTML=by.map(t=>`<tr data-code="${t.code}"><td>${safe(t.name)}</td>${KEYS.map(k=>`<td>${pct(t.zones[k].share)} <span class="bubble">#${t.zones[k].rank_share||'—'}</span></td>`).join('')}</tr>`).join('');
 for(let tr of $('board').querySelectorAll('tr[data-code]'))tr.addEventListener('click',()=>{$('team').value=tr.dataset.code;if($('team').value===$('offense').value){$('offense').value=[...d.teams].find(t=>t.code!==tr.dataset.code).code;fillPlayers()}selectChanged();window.scrollTo({top:0,behavior:'smooth'})});
}
function renderComparison(){let c=$('compare').value;if(!c){$('compareBox').innerHTML='';return}let a=defenseTeam(),b=db.defense.teams.find(t=>t.code===c);$('compareBox').innerHTML=`<strong>${a.name} versus ${b.name}</strong><p class="small">${KEYS.map(z=>`${LABELS[z]}: ${pct(a.zones[z].share)} vs ${pct(b.zones[z].share)}`).join(' · ')}</p>`}
function renderRankItem(r,i){const node=document.createElement('button');node.type='button';node.className='rank-item';node.innerHTML=`<span class="rank-index">${i+1}.</span><span class="rank-main"><b>${safe(r.player)}</b><small>${safe(r.offense)} vs ${safe(r.defense)} · ${safe(r.position)}</small><small>${LABELS[r.topZone]||''} · ${r.attempts} FGA / ${r.games} GP</small></span><span class="rank-score" style="color:${r.score>=58?'#55dfb3':r.score<45?'#ff94a0':'#e5d495'}">${r.score.toFixed(1)}</span>`;
 node.onclick=()=>{if(!db.rosters[r.offense])return;$('team').value=r.defense;$('offense').value=r.offense;let roster=db.rosters[r.offense].find(x=>normalize(x.name)===normalize(r.player));fillPlayers(roster?.id);selectChanged();window.scrollTo({top:0,behavior:'smooth'})};return node;}
async function rankings(){if(!db)return;const section=$('rankCoverage');try{
 const out=await api('/api/rankings?scope='+rankScope+'&date='+encodeURIComponent(selectedDate||db.status.date));
 const total=Number(out.totalRosterSlots)||0,graded=Number(out.eligiblePlayers)||0,measured=Number(out.availableProfiles)||0;
 const low=Number(out.notQualified)||0,missing=Number(out.missingProfiles)||0;
 $('auditEligible').textContent=fmt(graded);$('auditLowSample').textContent=fmt(low);
 $('auditMissing').textContent=fmt(missing);$('auditTotal').textContent=fmt(total);
 $('rankCoverageFill').style.width=total?(100*graded/total).toFixed(1)+'%':'0%';
 const datasetComplete=missing===0,ready=graded>=6;
 $('rankAuditTitle').textContent=total?
  `${graded} / ${total} roster entries grade-eligible (${out.coveragePct}%) · ${measured} with measured profiles`:
  'No usable matchup schedule / roster entries for this ranking scope';
 section.textContent=`${rankScope==='today'?shortDayLabel(selectedDate)+' games':'All hypothetical opponent pairings'} · ${out.pairings} team-vs-defense comparisons · stats through ${out.asof} · ${out.source}.`;
 $('rankAuditWarning').textContent=!total?'No verified games available. Nothing is ranked.':
  `${missing} players lack measured shot-zone profiles; ${low} have profiles but fail the four-game/40-FGA minimum. ${datasetComplete?'All roster entries have profiles, but not all are eligible.':'This is NOT a complete-slate ranking.'} No injury/starting-role verification is included.`;
 $('topSixTitle').textContent=`Top ${Math.min(6,graded)} among ${graded} eligible`;
 $('worstSixTitle').textContent=`Worst ${Math.min(6,graded)} among ${graded} eligible`;
 for(const [name,items] of [['topSix',out.top],['worstSix',out.worst]]){
  const h=$(name);h.replaceChildren();
  if(!items.length){h.innerHTML=`<div class="empty-board">No qualified comparisons available. ${rankScope==='today'?'We need a verified current slate and player shot-zone profiles.':'Missing players are never counted as unfavorable.'}</div>`;}
  else items.forEach((x,i)=>h.appendChild(renderRankItem(x,i)));
 }
 }catch(e){section.textContent=`Could not calculate rankings: ${e.message}`;$('rankAuditWarning').textContent='Rankings currently unavailable; do not use stale results.';}}
async function refreshStatus(){if(!db)return;try{let s=await api('/api/status');let previous=db.status?.refresh?.lastSuccess;db.status=s;showCoverage();let x=s.refresh;if(x.lastSuccess&&x.lastSuccess!==previous){const fresh=await api('/api/bootstrap');db.players=fresh.players;db.defense=fresh.defense;renderBoard();matchup();rankings();runAudit();scheduleResearch();}$('syncHealth').textContent=x.active?'Updating':'Data ready';$('refreshState').textContent=x.stage||'Server online';$('statusBar').textContent=x.error?`Live refresh unavailable: ${x.error}. Serving ${s.source} data as of ${s.dataAsOf}.`:`Source: ${s.source}; as of ${s.dataAsOf}. ${x.active?x.stage:'Last valid snapshot retained.'} ${x.stats?.completedGames?`Games validated ${x.stats.usableGames}/${x.stats.completedGames}; rejected ${x.stats.rejectedGames}.`:''}`;$('statusBar').classList.toggle('source-warning',Boolean(x.error))}catch(e){$('syncHealth').textContent='Server unavailable';$('statusBar').textContent=e.message}}
async function matchup(){if(!db)return;let serial=++requestSerial,defense=$('team').value,offense=$('offense').value,id=$('player').value;if(!id)return;
 if(defense===offense){$('qualityNote').textContent='Choose a different defending team. A team cannot play itself.';return}
 const local=profileLocal();renderCourt(local,null);renderGrade(null,local);renderForecast(null);$('playerLookupStatus').textContent='Checking server for player shot zones…';
 try{let r=await api(`/api/matchup?defense=${defense}&offense=${offense}&playerId=${encodeURIComponent(id)}&expectedMinutes=${encodeURIComponent($('expectedMinutes').value)}&roleVerified=${$('roleVerified').checked}`);if(serial!==requestSerial)return;
  renderCourt(r.profile||local,r.grade);renderGrade(r.grade,r.profile||local);renderForecast(r.forecast);$('playerLookupStatus').textContent=r.profile?`Loaded ${r.profile.name} (${r.profile.source}) — ${r.profile.gp||'?'} games, ${total(r.profile)} classified attempts.`:'No profile saved yet. Fetching this player’s completed team games from ESPN on the server.';
  if(!r.profile||!String(r.profile.source||'').startsWith('ESPN'))requestPlayer(offense,id,serial);
 }catch(e){$('playerLookupStatus').textContent=`Lookup failed: ${e.message}. Saved defensive data stays visible.`}
}
async function requestPlayer(team,id,serial){if(currentLookup===team+':'+id)return;currentLookup=team+':'+id;
 try{await api('/api/player',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({team,id})});}
 catch(e){if(serial===requestSerial)$('playerLookupStatus').textContent='On-demand lookup could not start: '+e.message;currentLookup=null;return}
 let tries=0;if(lookupTicker)clearInterval(lookupTicker);
 lookupTicker=setInterval(async()=>{tries++;if(serial!==requestSerial||tries>15){clearInterval(lookupTicker);currentLookup=null;return}
 try{const r=await api(`/api/matchup?defense=${$('team').value}&offense=${team}&playerId=${encodeURIComponent(id)}&expectedMinutes=${encodeURIComponent($('expectedMinutes').value)}&roleVerified=${$('roleVerified').checked}`);if(String(r.profile?.source||'').startsWith('ESPN')){
 renderCourt(r.profile,r.grade);renderGrade(r.grade,r.profile);renderForecast(r.forecast);$('playerLookupStatus').textContent=`Updated ${r.profile.name} from ESPN through ${r.profile.asof} (${r.profile.gp} GP). Zone boundaries are estimated.`;clearInterval(lookupTicker);currentLookup=null;rankings();
 }else $('playerLookupStatus').textContent=`Checking shot-zone feed for ${rosterItem()?.name||'player'}… ${tries*5}s elapsed. Saved numbers remain visible.`;
 }catch(e){$('playerLookupStatus').textContent='Player update unavailable: '+e.message;clearInterval(lookupTicker);currentLookup=null}
 },5000);
}
function selectChanged(){if(!db)return;$('roleVerified').checked=false;$('expectedMinutes').value=''; if($('offense').value===$('team').value){$('playerLookupStatus').textContent='Select different teams';return;}renderComparison();matchup();scheduleResearch();}
async function loadApp(){try{db=await api('/api/bootstrap');selectedDate=db.status.date;fillTeams();
 if(db.schedule?.length){let a=db.schedule[0];$('team').value=a.home;$('offense').value=a.away;}else{$('team').value='CHA';$('offense').value='BOS';}
 fillPlayers(favoredRosterId($('offense').value));showCoverage();renderToday();renderBoard();renderComparison();await matchup();await rankings();refreshStatus();loadSchedule();runAudit();scheduleResearch();}
 catch(e){document.querySelector('header .sub').textContent='The app backend is unavailable. Run the Node server, or deploy it to a web host. '+e.message;$('syncHealth').textContent='Offline';$('statusBar').textContent=e.message;}}
async function loadSchedule(force=false){
 const day=selectedDate,serial=++slateRequestSerial;
 try{const d=await api('/api/schedule?date='+encodeURIComponent(day)+(force?'&fresh=1':''));
  if(serial!==slateRequestSerial)return;
  db.schedule=d.schedule||[];renderToday();$('gameSource').textContent=d.cached?'Cached NBA schedule':'ESPN NBA schedule';
  if(d.warning)$('gameSource').textContent+=' · last verified copy';
  if(rankScope==='today')rankings();
 }catch(e){if(serial!==slateRequestSerial)return;
  db.schedule=[];$('gameCount').textContent='Schedule unavailable';$('todayGames').innerHTML='<div class="slate-empty">Could not load the NBA schedule: '+safe(e.message)+'. Try Refresh schedule.</div>';rankings();
 }
}
$('gamePrev').addEventListener('click',()=>moveSlateDay(-1));
$('gameNext').addEventListener('click',()=>moveSlateDay(1));
$('gameDate').addEventListener('change',e=>changeDay(e.target.value));
$('gameToday').addEventListener('click',()=>changeDay(db.status.date));
$('gameReload').addEventListener('click',()=>changeDay(selectedDate,true));
$('team').addEventListener('change',()=>{if($('team').value===$('offense').value){let alt=db.defense.teams.find(t=>t.code!==$('team').value);$('offense').value=alt.code;fillPlayers()}selectChanged()});
$('offense').addEventListener('change',()=>{if($('team').value===$('offense').value){$('team').value=db.defense.teams.find(t=>t.code!==$('offense').value).code}fillPlayers();selectChanged()});
$('player').addEventListener('change',selectChanged);
$('measure').addEventListener('change',()=>renderCourt(profileLocal(),lastGrade));
$('compare').addEventListener('change',renderComparison);
$('loadPlayer').addEventListener('click',()=>{currentLookup=null;requestPlayer($('offense').value,$('player').value,requestSerial)});
$('scopeToday').addEventListener('click',()=>{rankScope='today';$('scopeToday').classList.add('primary');$('scopeAll').classList.remove('primary');rankings()});
$('scopeAll').addEventListener('click',()=>{rankScope='all';$('scopeAll').classList.add('primary');$('scopeToday').classList.remove('primary');rankings()});
$('refresh').addEventListener('click',async()=>{try{let r=await api('/api/refresh',{method:'POST'});$('statusBar').textContent=r.accepted?'Full-season rebuild started on server. Existing snapshot stays available until verification completes.':r.reason;refreshStatus()}catch(e){$('statusBar').textContent=e.message}});
$('reload').addEventListener('click',loadApp);
setInterval(refreshStatus,12000);
loadApp();

let accuracyReport=null;
function renderForecast(f){
 if(!f){$('forecastSource').textContent='Profile unavailable';$('vetoResult').className='veto-neutral';$('vetoResult').textContent='No verified shooting-zone profile is available.';for(const id of ['opportunityScore','efficiencyScore','confidenceScore','projectedTotal','projectedPrimary','projectedMinutes'])$(id).textContent='—';$('forecastRows').innerHTML='<tr><td colspan="5">Awaiting usable pregame data.</td></tr>';return;}
 $('forecastSource').textContent=f.minutesSource+' · '+f.gamesInRecent+' recent games';
 $('opportunityScore').textContent=f.opportunityGrade??'—';$('efficiencyScore').textContent=f.efficiencyGrade??'—';$('confidenceScore').textContent=f.dataConfidence+'/100';
 $('projectedTotal').textContent=f.totalProjectedFga.toFixed(1);$('projectedPrimary').textContent=(LABELS[f.targetZone]||f.targetZone)+': '+f.targetProjectedFga.toFixed(1);
 $('projectedMinutes').textContent=f.expectedMinutes==null?'Unverified':f.expectedMinutes.toFixed(1)+' min';
 const v=f.veto;$('vetoResult').className=v.status==='VETO'?'veto-stop':v.status==='REVIEW'?'veto-review':'veto-clear';
 const remarks=[...v.reasons.map(x=>'STOP: '+x),...v.warnings.map(x=>'CHECK: '+x)];
 $('vetoResult').textContent=v.status+' · '+(remarks.length?remarks.join(' • '):'All selected scouting checks cleared. Still not a bet approval.');
 $('forecastRows').innerHTML=f.zones.map(z=>`<tr><td>${safe(z.name)}${z.zone===f.targetZone?' ★':''}</td><td>${z.seasonFga.toFixed(1)}</td><td>${z.recentFga===null?'Not enough data':z.recentFga.toFixed(1)}</td><td><b>${z.projectedFga.toFixed(1)}</b></td><td style="color:${z.efficiencyGapPP>=0?'#7ce0bb':'#f7a0a6'}">${signed(z.efficiencyGapPP)}</td></tr>`).join('');
 $('forecastNote').textContent=f.method+' Hard vetoes reflect scouting filters, not a claim of validated gambling performance. Never treat a grade as P(win).';
}
function auditTable(rows){
 if(!rows?.length)return '<div class="empty-board">No graded players with completed game shots found.</div>';
 return `<table class="v13-table"><thead><tr><th>PLAYER / DEFENSE</th><th>GRADE</th><th>EXPECTED ZONE</th><th>ACTUAL</th><th>VS SEASON</th></tr></thead><tbody>${rows.map(x=>`<tr><td><b>${safe(x.player)}</b><div class="small">${safe(x.offense)} vs ${safe(x.defense)} · ${LABELS[x.targetZone]}</div></td><td>${x.grade.toFixed(1)}</td><td>${x.projectedZoneFga.toFixed(1)}</td><td>${x.actualZoneFga===null?'DNP / no minutes':x.actualZoneFga}</td><td style="color:${x.beatBaseline===null?'#b0c6d9':x.beatBaseline?'#72d8ac':'#f4a6aa'}">${x.beatBaseline===null?'N/A':x.beatBaseline?'Met':'Missed'} ${x.baselineZoneFga.toFixed(1)}</td></tr>`).join('')}</tbody></table>`;
}
async function runAudit(){let day=$('auditDate').value;if(!day)return;
 $('auditRun').disabled=true;$('auditMessage').textContent='Calculating pregame-only baselines for '+day+'…';$('auditCsv').disabled=true;
 try{const d=await api('/api/accuracy?date='+encodeURIComponent(day));accuracyReport=d;
  if(!d.ready){$('auditMessage').textContent=d.reason;$('auditStats').hidden=true;$('auditTopTable').innerHTML='';$('auditWorstTable').innerHTML='';return;}
  $('auditStats').hidden=false;$('auditPlayers').textContent=d.playedGradedPlayers+' / '+d.gradedPlayers;$('auditMae').textContent=d.metrics.zoneFgaMAE===null?'—':d.metrics.zoneFgaMAE.toFixed(2);$('auditTopRate').textContent=d.metrics.topSixBaselineRate===null?'—':d.metrics.topSixBaselineRate.toFixed(1)+'%';
  $('auditMessage').textContent=`${d.completedGames} completed games · ${d.priorGames} earlier games as the sole prediction input · Top 6 clearance ${d.metrics.topSixBaselineRate??'—'}% (${d.metrics.topSixPlayed}/6 played), Worst 6 ${d.metrics.worstSixBaselineRate??'—'}% (${d.metrics.worstSixPlayed}/6 played) · ${d.hasArchivedBoard?'A real pregame board was also saved '+d.archivedAt:'Retrospective pregame reconstruction (not a saved pre-tipoff board)'}. Individual role, market lines and minutes not verified.`;
  $('auditTopTable').innerHTML=auditTable(d.top);$('auditWorstTable').innerHTML=auditTable(d.worst);$('auditCsv').disabled=!d.details?.length;
 }catch(e){$('auditMessage').textContent='Postgame audit failed: '+e.message;$('auditStats').hidden=true;}
 finally{$('auditRun').disabled=false;}
}
function exportAudit(){if(!accuracyReport?.details?.length)return;
 const rows=accuracyReport.details,heads=['date','player','offense','defense','grade','target_zone','season_zone_fga','predicted_zone_fga','actual_zone_fga','actual_zone_fgm','predicted_total_fga','actual_total_fga','baseline_met','forecast_met'];
 const csv=[heads.join(','),...rows.map(x=>[accuracyReport.date,x.player,x.offense,x.defense,x.grade,x.targetZone,x.baselineZoneFga,x.projectedZoneFga,x.actualZoneFga,x.actualZoneFgm,x.projectedTotalFga,x.actualTotalFga,x.beatBaseline,x.beatForecast].map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(','))].join('\n');
 const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),link=document.createElement('a'),url=URL.createObjectURL(blob);link.href=url;link.download='nba_shotzone_accuracy_'+accuracyReport.date+'.csv';link.click();URL.revokeObjectURL(url);
}
$('expectedMinutes').addEventListener('change',matchup);
$('roleVerified').addEventListener('change',matchup);
$('auditRun').addEventListener('click',runAudit);
$('auditCsv').addEventListener('click',exportAudit);
(function initializeAuditDate(){const today=new Date();today.setDate(today.getDate()-1);$('auditDate').value=today.toLocaleDateString('en-CA',{timeZone:'America/Chicago'});})();
// Leave the previous grade screen intact. Accuracy is loaded only when requested.

// v1.4 — evidence-led research desk; browser-only watchlist and user-entered gates.
let researchResult=null,researchSerial=0,researchTimer=null,researchContext='',watchlist=[];
const researchInputs=['researchStat','researchSide','researchLine','researchOdds','researchInjury','researchDvp','researchSpread','researchPace','researchPlayType','researchPlayRank','researchTracking','researchTrackingSource','researchNotes','researchLineChecked','researchRoleChecked','researchDvpChecked','researchUpstreamChecked','researchProjectionChecked','researchMarketChecked','researchVetoChecked'];
try{const stored=JSON.parse(localStorage.getItem('nba-scout-v14-watchlist')||'[]');if(Array.isArray(stored))watchlist=stored.slice(0,150)}catch{}
function saveWatchlist(){try{localStorage.setItem('nba-scout-v14-watchlist',JSON.stringify(watchlist.slice(0,150)))}catch(e){$('researchSummary').textContent='Browser storage unavailable; use CSV export to preserve your research.'}}
function nval(id){const s=$(id)?.value?.trim?.()??'';if(s==='')return null;const n=Number(s);return Number.isFinite(n)?n:null}
function percent(v){return Number.isFinite(v)?v.toFixed(1)+'%':'—'}
function vfmt(v){return Number.isFinite(v)?Number(v).toFixed(1):'—'}
function matchupResearchKey(){return [$('offense').value,$('team').value,$('player').value,selectedDate||''].join(':')}
function resetResearchIfNeeded(){const ctx=matchupResearchKey();if(ctx===researchContext)return;researchContext=ctx;researchResult=null;
 for(const id of researchInputs){if(!$(id))continue;if($(id).type==='checkbox')$(id).checked=false;else if(!['researchStat','researchSide'].includes(id))$(id).value='';}
 $('researchInjury').value='unknown';$('researchPace').value='unknown';$('researchPlayType').value='unknown';}
function scheduleResearch(){clearTimeout(researchTimer);researchTimer=setTimeout(loadResearch,280)}
async function loadResearch(){if(!db||!$('player').value)return;resetResearchIfNeeded();const serial=++researchSerial;
 const qs=new URLSearchParams({offense:$('offense').value,defense:$('team').value,playerId:$('player').value,stat:$('researchStat').value,side:$('researchSide').value,date:selectedDate||db.status.date});
 const line=nval('researchLine'),minutes=nval('expectedMinutes');if(line!==null&&line>=0&&line<=300)qs.set('line',String(line));if(minutes!==null&&minutes>=1&&minutes<=48)qs.set('expectedMinutes',String(minutes));
 $('researchSummary').textContent='Reading historical box-score evidence and checking data completeness…';
 try{const r=await api('/api/research?'+qs.toString());if(serial!==researchSerial)return;researchResult=r;renderResearch(r)}catch(e){if(serial!==researchSerial)return;researchResult=null;$('researchSummary').textContent='Historical research is unavailable: '+e.message;renderResearch(null)}
}
function researchGate(){const d=researchResult;if(!d)return {status:'WAIT',block:['Player/game history is unavailable'],warnings:[]};
 const stop=[],pending=[],warnings=[];
 if(!d.ready||d.boxscoreGames<5)pending.push('At least 5 games with complete box-score history');
 if(nval('researchLine')===null)pending.push('Enter exact current line');
 if(!$('researchLineChecked').checked)pending.push('Verify line and payout at submission time');
 if($('researchInjury').value==='out')stop.push('Player is OUT');
 else if($('researchInjury').value==='questionable')stop.push('Questionable/uncertain playing-time restriction');
 else if($('researchInjury').value!=='active')pending.push('Confirm active injury status and role');
 if(nval('expectedMinutes')===null||!$('researchRoleChecked').checked)pending.push('Independent minutes and lineup check');
 if(!$('researchDvpChecked').checked||nval('researchDvp')===null)pending.push('Stat-specific DvP and shot-zone corroboration');
 if(!$('researchUpstreamChecked').checked)pending.push('Upstream stat opportunities verified');
 if(['AST','REB','RA','PRA','PA','PR'].includes(d.stat)&&(!nval('researchTracking')||!$('researchTrackingSource').value.trim()))pending.push('Provide sourced tracking for potential assists / rebound chances');
 if(!$('researchProjectionChecked').checked)pending.push('Second independent projection');
 if(!$('researchMarketChecked').checked)pending.push('Odds/market movement review');
 if(!$('researchVetoChecked').checked)pending.push('Independent second-pass veto');
 if(d.lean==='AGAINST SELECTED SIDE')stop.push('Historical/minutes baseline contradicts selected side');
 if(d.lean==='TOO CLOSE TO LINE')warnings.push('Estimated baseline is close to exact line');
 if(d.lean==='NO LEAN')warnings.push('Not enough margin or data to assess side');
 const rank=nval('researchDvp');if(rank!==null&&(rank<1||rank>30))stop.push('DvP rank must be 1–30');
 if(rank!==null&&rank>=1&&rank<=30&&(d.side==='MORE'?rank<=10:rank>=21))warnings.push('Stat-specific DvP does not support this side');
 const playRank=nval('researchPlayRank');if(playRank!==null&&playRank>=1&&playRank<=30&&(d.side==='MORE'?playRank<=10:playRank>=21))warnings.push('Manually entered play-type matchup opposes this side');
 const spread=nval('researchSpread');if(spread!==null&&Math.abs(spread)>=11)warnings.push('Double-digit spread: check blowout and lost-minutes scenario');
 if($('researchPace').value==='slow'&&d.side==='MORE')warnings.push('Slow-pace environment may reduce counting opportunities');
 const status=stop.length?'VETO':pending.length?'INCOMPLETE':warnings.length?'REVIEW':'READY FOR SECOND LOOK';
 return {status,block:stop,pending,warnings};
}
function renderResearch(d){const fields=['researchSeason','researchL5','researchL10','researchProjection'];if(!d){fields.forEach(x=>$(x).textContent='—');$('researchRates').innerHTML='';$('researchOpportunity').innerHTML='';$('researchRecent').innerHTML='';$('researchVeto').className='veto-neutral';$('researchVeto').textContent='No research data loaded.';return}
 $('researchSeason').textContent=vfmt(d.seasonMean);$('researchL5').textContent=vfmt(d.last5Mean);$('researchL10').textContent=vfmt(d.last10Mean);$('researchProjection').textContent=vfmt(d.projectedBaseline);
 const odds=nval('researchOdds'),implied=odds&&Math.abs(odds)>=100?odds>0?100/(odds+100)*100:-odds/(-odds+100)*100:null;
 $('researchSummary').innerHTML=`<b>${safe(d.player)} · ${safe(d.offense)} vs ${safe(d.defense)} · ${safe(d.stat)} ${safe(d.side)} ${d.line??'line missing'}</b><div class="small">${safe(d.lean)} · ${d.boxscoreGames} eligible games · last-ten empirical range ${vfmt(d.observedP20)}–${vfmt(d.observedP80)}${implied!==null?' · market implied '+percent(implied)+' (sportsbook only)':''}</div><div class="small">No calibrated win probability. Data as of ${safe(d.dataAsOf)} · ${d.cacheGames} games processed for expanded box-score history.</div>`;
 if(!d.ready)$('researchSummary').innerHTML+='<p>Complete historical box-score data are loading. Use Refresh on the server to upgrade older game caches.</p>';
 const rates=d.hitRates;if(rates){$('researchRates').innerHTML='<table class="v13-table"><thead><tr><th>Window</th><th>True wins</th><th>Pushes</th><th>Losses</th></tr></thead><tbody>'+[['Last 5',rates.last5],['Last 10',rates.last10],['Season',rates.season],['H2H',rates.h2h]].map(([name,x])=>`<tr><td>${name} (${x.sample})</td><td style="color:#78e5c0">${x.win} (${percent(x.winPct)})</td><td>${x.push} (${percent(x.pushPct)})</td><td style="color:#ffadad">${x.loss}</td></tr>`).join('')+'</tbody></table>';}else $('researchRates').innerHTML='<div class="muted-panel">Enter an exact line for true win/push/loss rates.</div>';
 const o=d.opportunity||{};let opportunityItems=[['Last-5 FGA',o.fgaL5],['Last-10 FGA',o.fgaL10],['Last-5 3PA',o.tpaL5],['Last-5 FTA',o.ftaL5],['Last-5 minutes',o.minutesL5],['Last-10 minutes',o.minutesL10]];
 $('researchOpportunity').innerHTML=opportunityItems.map(([k,v])=>`<div><span>${k}</span><b>${vfmt(v)}</b></div>`).join('')+'<p class="mini">Rebound chances and potential assists: tracking data not connected. Use the sourced manual evidence field if available.</p>';
 $('researchRecent').innerHTML='<table class="v13-table"><thead><tr><th>Date</th><th>Opponent</th><th>Stat</th><th>Minutes</th><th>FGA</th><th>3PA</th></tr></thead><tbody>'+d.recent.map(g=>`<tr><td>${safe(g.date)}</td><td>${safe(g.opponent)}</td><td><b>${g.stat}</b></td><td>${g.minutes??'—'}</td><td>${g.fga??'—'}</td><td>${g.tpa??'—'}</td></tr>`).join('')+'</tbody></table>';
 renderResearchGate();}
function renderResearchGate(){const gate=researchGate(),v=$('researchVeto');v.className=gate.status==='VETO'?'veto-stop':gate.status==='READY FOR SECOND LOOK'?'veto-clear':'veto-review';
 v.textContent=gate.status+' · '+[...gate.block.map(t=>'STOP: '+t),...(gate.pending||[]).map(t=>'REQUIRES: '+t),...gate.warnings.map(t=>'CAUTION: '+t)].join(' • ');
}
function evidenceText(){const d=researchResult;if(!d)return 'No research evidence loaded';const gate=researchGate();const rank=nval('researchDvp');const lines=[`NBA SHOT-ZONE SCOUT v1.4 — RESEARCH ONLY`,`${d.day}: ${d.player} (${d.offense}) vs ${d.defense}` ,`${d.stat} ${d.side} ${d.line??'LINE MISSING'}`,`Estimated baseline: ${vfmt(d.projectedBaseline)} | Season ${vfmt(d.seasonMean)} | Last 5 ${vfmt(d.last5Mean)} | Last 10 ${vfmt(d.last10Mean)}`,`H2H this season: ${d.h2hGames} games | DvP source rank: ${rank??'missing'}/30`, `Recent FGA ${vfmt(d.opportunity.fgaL5)} | 3PA ${vfmt(d.opportunity.tpaL5)} | FTA ${vfmt(d.opportunity.ftaL5)} | minutes ${vfmt(d.opportunity.minutesL5)}`];
 if(d.hitRates)for(const [name,r] of Object.entries(d.hitRates))lines.push(`${name}: ${r.win} wins, ${r.push} pushes, ${r.loss} losses (n=${r.sample})`);
 lines.push(`STATUS: ${gate.status}`, ...gate.block.map(x=>'STOP: '+x),...(gate.pending||[]).map(x=>'PENDING: '+x),...gate.warnings.map(x=>'CAUTION: '+x),`Notes: ${$('researchNotes').value.trim()}`,`Sources: ESPN game box scores and ESPN-coordinate approximated zone data; other inputs user-entered`,`Not independently validated probability or betting edge.`);return lines.join('\n');}
function renderWatchlist(){const h=$('researchWatchlist');if(!watchlist.length){h.innerHTML='<div class="muted-panel">Nothing saved. A watchlist is a research log, not an entry slip.</div>';return}
 h.innerHTML=watchlist.map((p,i)=>`<div class="watchlist-item"><b>${safe(p.player)} · ${safe(p.stat)} ${safe(p.side)} ${p.line??'—'}</b><p>${safe(p.offense)} vs ${safe(p.defense)} · ${safe(p.date)}<br>Baseline ${vfmt(p.baseline)} · ${safe(p.gate)}<br>${safe((p.notes||'').slice(0,120))}</p><small>Saved ${safe(p.savedAt)} · source checks user-entered</small><p><button type="button" data-watch-remove="${i}">Remove</button></p></div>`).join('');
 h.querySelectorAll('button[data-watch-remove]').forEach(btn=>btn.addEventListener('click',()=>{const i=Number(btn.dataset.watchRemove);watchlist.splice(i,1);saveWatchlist();renderWatchlist()}));}
function addResearch(){if(!researchResult){$('researchSummary').textContent='Research a player first.';return}const d=researchResult,gate=researchGate();if(d.line===null){$('researchSummary').textContent='Enter the exact line before adding a player to your watchlist.';return}
 const row={player:d.player,offense:d.offense,defense:d.defense,date:d.day,stat:d.stat,side:d.side,line:d.line,baseline:d.projectedBaseline,gate:gate.status,notes:$('researchNotes').value.trim(),dvp:nval('researchDvp'),odds:nval('researchOdds'),savedAt:new Date().toISOString(),evidence:evidenceText()};
 watchlist.unshift(row);watchlist=watchlist.slice(0,150);saveWatchlist();renderWatchlist();$('researchSummary').textContent=`Added ${d.player} ${d.stat} ${d.side} ${d.line} to your research watchlist. ${gate.status}. This does NOT submit a bet.`;}
function exportResearch(){if(!watchlist.length)return;const headers=['date','player','offense','defense','stat','side','line','baseline','status','dvp','market_odds','notes','saved_at'];const vals=watchlist.map(p=>[p.date,p.player,p.offense,p.defense,p.stat,p.side,p.line,p.baseline,p.gate,p.dvp,p.odds,p.notes,p.savedAt]);
 const field=v=>{let s=String(v??'');if(/^[=+@-]/.test(s)&&!/^-?\d+(\.\d+)?$/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"'};
 const csv=[headers.map(field).join(','),...vals.map(r=>r.map(field).join(','))].join('\r\n');const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),href=URL.createObjectURL(blob),a=document.createElement('a');a.href=href;a.download='nba_research_watchlist_'+(selectedDate||'today')+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(href),1000);}
$('researchStat').addEventListener('change',loadResearch);$('researchSide').addEventListener('change',loadResearch);
$('researchLine').addEventListener('input',()=>{$('researchLineChecked').checked=false;scheduleResearch()});
$('researchOdds').addEventListener('input',()=>{$('researchMarketChecked').checked=false;if(researchResult)renderResearch(researchResult)});
for(const id of ['researchInjury','researchDvp','researchSpread','researchPace','researchPlayType','researchPlayRank','researchTracking','researchTrackingSource','researchLineChecked','researchRoleChecked','researchDvpChecked','researchUpstreamChecked','researchProjectionChecked','researchMarketChecked','researchVetoChecked'])$(id).addEventListener('change',renderResearchGate);
$('expectedMinutes').addEventListener('change',scheduleResearch);
$('researchAdd').addEventListener('click',addResearch);
$('researchCopy').addEventListener('click',async()=>{const msg=evidenceText();try{await navigator.clipboard.writeText(msg);$('researchSummary').textContent='Evidence report copied. Keep source timestamps when sharing.'}catch{$('researchSummary').textContent='Clipboard unavailable; use Export CSV or copy the research notes manually.'}});
$('researchExport').addEventListener('click',exportResearch);
$('researchClear').addEventListener('click',()=>{if(!watchlist.length)return;if(!confirm('Clear your local research watchlist?'))return;watchlist=[];saveWatchlist();renderWatchlist()});
renderWatchlist();
