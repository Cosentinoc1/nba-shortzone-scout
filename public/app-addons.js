'use strict';
(function(){
const zs=['rim','paint','mid','left','right','above'];
const names={rim:'Restricted area',paint:'Paint (non-RA)',mid:'Mid-range',left:'Left corner 3',right:'Right corner 3',above:'Above-break 3'};
const clamp=(x,l,h)=>Math.max(l,Math.min(h,x));
const nf=x=>Number(x||0).toLocaleString();
const percent=x=>Number.isFinite(x)?(100*x).toFixed(1)+'%':'—';
function grade(p,d){
 if(!p||!d||!defData.league?.zones||p.team===d.code)return {eligible:false,reason:'Select a player on the opposing team'};
 const attempts=zs.reduce((n,k)=>n+(Number(p.zones?.[k]?.fga)||0),0);
 if(attempts<30)return {eligible:false,reason:'Only '+attempts+' shot attempts on record. At least 30 required.',attempts};
 if(d.attempts<200)return {eligible:false,reason:'Not enough defensive attempts in the sample',attempts};
 let combined=0,vol=0,accuracy=0,covered=0,details=[];
 for(const k of zs){const shot=p.zones?.[k],team=d.zones?.[k],lg=defData.league.zones?.[k];if(!shot||!team||!lg)continue;
  const made=Number(shot.fgm)||0,fga=Number(shot.fga)||0,w=fga/attempts;
  if(![team.share,lg.share,team.fg,lg.fg].every(Number.isFinite))continue;
  const rs=Math.sqrt((Number(team.fga)||0)/((Number(team.fga)||0)+45));
  const v=Math.tanh((team.share-lg.share)/.055)*rs;
  const c=Math.tanh((team.fg-lg.fg)/.075)*rs;
  const edge=.6*v+.4*c;combined+=w*edge;vol+=w*v;accuracy+=w*c;covered+=w;
  details.push({k,edge,contribution:w*edge,shotShare:w,fga,made,rank:team.rank_share,defShare:team.share,defFg:team.fg,leagueShare:lg.share,leagueFg:lg.fg});
 }
 if(covered<.95)return {eligible:false,reason:'Six-zone data is incomplete',attempts};
 const reliability=clamp(Math.sqrt(attempts/100),.45,1)*clamp(Math.sqrt(d.attempts/600),.65,1);
 const score=Math.round(50+(clamp(50+48*combined,0,100)-50)*reliability);
 const letter=score>=68?'A':score>=59?'B':score>=45?'C':score>=35?'D':'F';
 return {eligible:true,score,letter,attempts,vol,accuracy,confidence:Math.round(100*reliability),details:details.sort((a,b)=>b.contribution-a.contribution),label:score>=59?'Favorable zone overlap':score<=40?'Restrictive zone overlap':'Mixed / neutral overlap'};
}
function cardClass(score){return score>=59?'good':score<=40?'bad':''}
function gradeRender(){
 const panel=document.getElementById('gradeSection');if(!panel)return;
 const d=getTeam(document.getElementById('team').value),p=getPlayer(),g=grade(p,d);
 if(!g.eligible){panel.innerHTML='<div class="rank-skeleton"><b>Not graded</b> · '+safe(g.reason)+'<div class="quality-line">No estimate is issued without actual shot attempts from the selected shooter.</div></div>';return;}
 const plus=g.details.filter(x=>x.contribution>0).slice(0,2),minus=[...g.details].sort((a,b)=>a.contribution-b.contribution).filter(x=>x.contribution<0).slice(0,2);
 const phrase=arr=>arr.length?arr.map(z=>`${names[z.k]} (${nf(z.fga)} FGA, defensive shot-share rank #${z.rank})`).join('; '):'None with a meaningful directional contribution';
 panel.innerHTML=`<div class="grade-layout"><div class="grade-bubble ${cardClass(g.score)}"><b>${g.score}</b><span>Grade ${g.letter} / 100</span></div><div class="grade-desc"><strong>${safe(g.label)}</strong><div>${safe(p.name)} · ${safe(p.team)} vs. ${safe(d.name)}</div><div>Confidence adjustment: ${g.confidence}% · ${nf(g.attempts)} player FGA · ${nf(d.attempts)} opponent attempts in team sample</div><div class="quality-line">This grade is a zone-fit screening score—not a predicted hit rate, point projection, or prop recommendation.</div></div></div><div class="grade-breakdown"><span class="grade-chip">Volume alignment: ${g.vol>=0?'+':''}${(g.vol*100).toFixed(1)}</span><span class="grade-chip">FG%-allowed alignment: ${g.accuracy>=0?'+':''}${(g.accuracy*100).toFixed(1)}</span><span class="grade-chip">Sample: ${nf(g.attempts)} player FGA</span></div><div class="mini-detail"><b>Strongest favorable signals:</b> ${safe(phrase(plus))}</div><div class="mini-detail"><b>Restrictive signals:</b> ${safe(phrase(minus))}</div><p class="quality-line">60% opponent shot-location frequency, 40% opponent FG% allowed, weighted by this player’s zone attempt mix. Small samples are discounted. No positional DvP, minutes, current injury, projected 3PA, or betting line is included in this grade.</p>`;
}
let gamesMap=null,slateStatus='',scope='today';
function makeBoard(){
 const board=document.getElementById('rankBoards');if(!board)return;
 const byCode=Object.fromEntries(defData.teams.map(d=>[d.code,d]));const rows=[];
 for(const p of playerData){const opponents=scope==='today'?gamesMap?.[p.team]?[gamesMap[p.team]]:[]:Object.keys(byCode).filter(x=>x!==p.team);
  for(const code of opponents||[]){const d=byCode[code],g=grade(p,d);if(g.eligible)rows.push({...g,p,d});}
 }
 const best=[...rows].sort((a,b)=>b.score-a.score||b.attempts-a.attempts),worst=[...rows].sort((a,b)=>a.score-b.score||b.attempts-a.attempts);
 const unique=items=>{let ids=new Set;return items.filter(x=>{let key=x.p.id||x.p.name+'_'+x.p.team;if(ids.has(key))return false;ids.add(key);return true}).slice(0,6)};
 const renderRows=(items,isWorst)=>items.length?items.map((r,i)=>`<button type="button" class="rank-row" data-team="${safe(r.d.code)}" data-off="${safe(r.p.team)}" data-name="${safe(r.p.name)}"><span class="rank-number">#${i+1}</span><span class="rank-info"><strong>${safe(r.p.name)}</strong><small>${safe(r.p.team)} vs ${safe(r.d.code)} · ${r.p.pos?safe(r.p.pos)+' · ':''}${nf(r.attempts)} FGA · ${r.label}</small></span><span class="rank-score ${cardClass(r.score)}">${r.score}</span></button>`).join(''):'<div class="rank-skeleton">No qualifying matchups yet. At least 30 classified FGA per player and a verified opposing defense are required. Try the all-pairs exploratory view or refresh the source data.</div>';
 const top=unique(best),bottom=unique(worst);
 board.innerHTML=`<div class="rank-grid"><div class="rank-panel"><h3 style="color:#6de3b3">Top 6 · Most favorable</h3>${renderRows(top,false)}</div><div class="rank-panel"><h3 style="color:#ff9a9d">Worst 6 · Most restrictive</h3>${renderRows(bottom,true)}</div></div><div class="quality-line">${nf(rows.length)} eligible player/opponent comparisons from ${new Set(rows.map(r=>r.p.id||r.p.name)).size} players in the available shooting sample. ${scope==='today'?'Scheduled games only.':'Exploratory all-pairs view; some teams are not playing each other.'} ${safe(slateStatus)}</div>`;
 board.querySelectorAll('button.rank-row').forEach(btn=>btn.onclick=()=>{
  document.getElementById('team').value=btn.dataset.team;
  document.getElementById('offense').value=btn.dataset.off;
  fillPlayers();
  const select=document.getElementById('player');const matched=(ALL_TEAM_ROSTERS[btn.dataset.off]||[]).find(a=>normName(a.name)===normName(btn.dataset.name));
  if(matched){select.value=matched.id;selectedPlayer=matched.id;render();loadSelectedPlayer(false)}
  window.scrollTo({top:0,behavior:'smooth'});
 });
}
async function loadGames(){
 slateStatus='Schedule loading…';makeBoard();
 try{const now=todayCT().replace(/-/g,''),r=await fetch('/api/games?date='+now,{cache:'no-store'});if(!r.ok)throw Error('Schedule feed HTTP '+r.status);
  const result=await r.json();gamesMap=result.matchups||{};slateStatus='Game list: '+result.date+' (ESPN).';
 }catch(e){gamesMap=null;slateStatus='Schedule unavailable ('+e.message+'); no fictitious today rankings.';}
 makeBoard();
}
const oldRender=render;
render=function(){oldRender();gradeRender();if(document.getElementById('rankScope'))makeBoard();};
const select=document.getElementById('rankScope');if(select){select.onchange=()=>{scope=select.value;makeBoard()};}
gradeRender();makeBoard();loadGames();
window.NBAScout={grade,loadGames,rankings:makeBoard};
})();
