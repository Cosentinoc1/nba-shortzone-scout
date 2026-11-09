/* Automatic player-to-defense-zone matchups by real daily NBA games.
 * All numbers are descriptive evidence; never represented as current bets.
 */
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=(x,dec=1)=>Number.isFinite(Number(x))&&x!==null?Number(x).toFixed(dec):'—';
const pct=(x)=>x===null||!Number.isFinite(x)?'—':(x*100).toFixed(1)+'%';
const delta=(x)=>x===null||!Number.isFinite(x)?'—':(x>=0?'+':'')+x.toFixed(1)+' pp';
let model=null,loading=false,selectedGame='ALL',mode='overall',lastDay=null;
function rankCompare(a,b){
 const measure=p=>mode==='volume'?p.volumeGrade:mode==='efficiency'?p.efficiencyGrade:mode==='three'?p.threeMatchScore:p.score;
 return measure(b)-measure(a)||b.score-a.score||a.player.localeCompare(b.player);
}
function filterRows(rows){
 return (rows||[]).filter(x=>mode!=='three'||(x.threeShare>=.32&&x.threePAperGame>=2)).sort(rankCompare);
}
function labelTitle(mode){return {overall:'Overall match',volume:'Shot-access match',efficiency:'FG% matchup',three:'3-point-zone match'}[mode]||'Match';}
function playerRow(p,i){
 const note=mode==='three'?p.top3ZoneVolumeDeltaPP>0||p.top3ZoneFgDeltaPP>0:Boolean(p.topZoneSupports);
 const zoneName=mode==='three'?p.top3ZoneName:p.topZoneName;
 const zoneFga=mode==='three'?p.top3ZoneFgaPerGame:p.topZonePlayerFgaPerGame;
 const zoneVolume=mode==='three'?p.top3ZoneVolumeDeltaPP:p.topZoneVolumeDeltaPP;
 const zoneFg=mode==='three'?p.top3ZoneFgDeltaPP:p.topZoneFgDeltaPP;
 const zoneReason=`${zoneName||'Unknown'}: ${fmt(zoneFga)} shots/game in that area · defense ${delta(zoneVolume)} share, ${delta(zoneFg)} FG% vs league`;
 return `<button type="button" class="zo-player" data-defense="${esc(p.opponent)}" data-zone="${esc(mode==='three'?p.top3Zone||'above':p.topZone||'rim')}" aria-label="Inspect ${esc(p.player)} against ${esc(p.opponent)} in ${esc(zoneName||'court')}">
    <span class="zo-rank">${i+1}</span>
    <span class="zo-player-body"><strong>${esc(p.player)} <small>${esc(p.team)} vs ${esc(p.opponent)}</small></strong>
     <span class="zo-zone-line">${note?'Best zone overlap:':'Primary shooting area:'} <b>${esc(zoneName||'Unknown')}</b></span>
     <span class="zo-subline">${esc(zoneReason)}</span>
     <span class="zo-tags"><em>${esc(p.tier)}</em><em>${esc(p.sample)} SAMPLE</em>${p.warnings?.some(x=>x.includes('minutes')||x.includes('Minutes'))?'<em>MINUTES CAUTION</em>':''}</span>
    </span>
    <span class="zo-metrics"><b>${fmt(mode==='volume'?p.volumeGrade:mode==='efficiency'?p.efficiencyGrade:mode==='three'?p.threeMatchScore:p.score,0)}<small>/100 ${mode==='volume'?'shot access':mode==='efficiency'?'FG% fit':mode==='three'?'3PT fit':'match'}</small></b><span><strong>${fmt(p.volumeGrade,0)}</strong><small>Volume</small></span><span><strong>${fmt(p.efficiencyGrade,0)}</strong><small>FG%</small></span><span><strong>${fmt(mode==='three'?p.threePAperGame:p.fgaPerGame)}</strong><small>${mode==='three'?'3PA/g':'FGA/g'}</small></span><span><strong>${fmt(p.minutesL5)}</strong><small>L5 min</small></span></span>
   </button>`;
}
function gameBlock(g){
 const all=filterRows(g.candidates),limit=selectedGame==='ALL'?3:10,rows=all.slice(0,limit);
 return `<section class="zo-game"><div class="zo-game-heading"><div><strong>${esc(g.label)}</strong><small>${esc(g.state==='post'?'Final · historical matchup view':g.state==='in'?'Live game · historical matchup view':'Scheduled game')} · ${all.length} research-eligible players</small></div>
  ${selectedGame==='ALL'?`<button type="button" class="zo-game-open" data-game="${esc(g.id)}">See top ${Math.min(10,all.length)} →</button>`:''}</div>
  ${rows.length?`<div class="zo-list">${rows.map(playerRow).join('')}</div>`:'<p class="zo-empty">No player has enough supported shot-location and minutes history for this view.</p>'}
 </section>`;
}
function render(){
 if(!model)return;
 const select=$('zoGame');if(!select)return;
 const games=selectedGame==='ALL'?model.games:model.games.filter(g=>g.id===selectedGame);
 const total=games.reduce((s,g)=>s+filterRows(g.candidates).length,0);
 const status=$('zoStatus');
 status.textContent=`${model.gameCount} NBA games · ${total} matching player profiles${model.asOf?' · History through '+model.asOf:''} · ${labelTitle(mode)}. No in-app prices, confirmed minutes or injuries.`;
 $('zoResults').innerHTML=games.length?games.map(gameBlock).join(''):
  '<p class="zo-empty">No recognized NBA games for the selected date. Change the game day at the top of NBA Scout.</p>';
 $('zoResults').querySelectorAll('button[data-game]').forEach(b=>b.onclick=()=>{selectedGame=b.dataset.game;select.value=selectedGame;render();});
 $('zoResults').querySelectorAll('button[data-defense]').forEach(b=>b.onclick=()=>{
  window.dispatchEvent(new CustomEvent('scout-zone-select',{detail:{team:b.dataset.defense,zone:b.dataset.zone}}));
  $('dzCourt')?.scrollIntoView({behavior:'smooth',block:'start'});
 });
}
async function load(force=false){
 if(!$('zoStatus')||loading)return;
 const day=$('dateInput')?.value;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day||''))return;
 if(!force&&model&&lastDay===day){render();return;}
 loading=true;$('zoStatus').textContent=`Loading pregame shot profiles for ${day}…`;
 $('zoResults').innerHTML='';
 try{
  const response=await fetch('/api/zone-opportunities?date='+encodeURIComponent(day),{cache:'no-store'});
  const result=await response.json();
  if(!response.ok)throw Error(result.error||`HTTP ${response.status}`);
  if(!Array.isArray(result.games))throw Error('Player opportunity data unavailable');
  model=result;lastDay=day;
  const sel=$('zoGame');const retain=selectedGame;
  sel.innerHTML='<option value="ALL">All games — top 3 each</option>'+model.games.map(g=>`<option value="${esc(g.id)}">${esc(g.label)} — Top 10</option>`).join('');
  selectedGame=model.games.some(g=>g.id===retain)?retain:'ALL';sel.value=selectedGame;
  render();
 }catch(e){$('zoStatus').textContent=`Could not load player matchups: ${e.message}`;
  $('zoResults').innerHTML='<p class="zo-empty">The zone chart remains available. Player rankings need a valid schedule and pregame box-score history.</p>';
 }finally{loading=false;}
}
function boot(){
 if(!$('zoGame'))return;
 $('zoGame').onchange=e=>{selectedGame=e.target.value;render();};
 $('zoMode').onchange=e=>{mode=e.target.value;render();};
 $('zoReload').onclick=()=>load(true);
 $('dateInput')?.addEventListener('change',()=>{model=null;selectedGame='ALL';load(true);});
 window.addEventListener('scout-zones-open',()=>load(false));
 if(!$('zonesPage')?.hidden)load();
}
if(typeof window!=='undefined'&&typeof document!=='undefined'){
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
}
