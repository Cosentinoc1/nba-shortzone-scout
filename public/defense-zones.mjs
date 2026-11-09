/* NBA Scout Defensive Zone Explorer — observational, source-aware league comparisons.
 * Uses the same backend defense snapshot as the court matchup tool. No new provider.
 */
import {zoneSignalGrade} from './zone-metrics.mjs';
const ZONES = [
  {id:'rim',name:'Restricted area',short:'At rim'},
  {id:'paint',name:'Paint (non-RA)',short:'Paint'},
  {id:'mid',name:'Mid-range',short:'Mid-range'},
  {id:'left',name:'Left corner 3',short:'Left corner'},
  {id:'right',name:'Right corner 3',short:'Right corner'},
  {id:'above',name:'Above-break 3',short:'Above-break 3'},
];
const pct = (n,d=1) => Number.isFinite(n) ? `${(100*n).toFixed(d)}%`:'—';
const pp = n => Number.isFinite(n) ? `${n>=0?'+':''}${(n*100).toFixed(1)} pp`:'—';
const number = n => Number.isFinite(n) ? Math.round(n).toLocaleString('en-US'):'—';
const escapeText = t => String(t??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&quot;',"'":'&#39;'}[ch]));
const asNumber = x => x===null || x===undefined || x==='' ? null : Number.isFinite(Number(x))?Number(x):null;
export {ZONES};

export function summarizeDefenseZones(defense, teamCode) {
  if (!defense || !Array.isArray(defense.teams)) return null;
  const team = defense.teams.find(t=>t.code===teamCode);
  if (!team) return null;
  const league = defense.league?.zones || {};
  const attempts = asNumber(team.attempts) ?? ZONES.reduce((s,z)=>s+(asNumber(team.zones?.[z.id]?.fga)||0),0);
  const zones=ZONES.map(z=>{
    const own=team.zones?.[z.id]||{},avg=league[z.id]||{};
    const fga=asNumber(own.fga),fgm=asNumber(own.fgm);
    const fg=asNumber(own.fg) ?? (fga>0&&fgm!==null?fgm/fga:null);
    const share=asNumber(own.share) ?? (attempts>0&&fga!==null?fga/attempts:null);
    const leagueFg=asNumber(avg.fg),leagueShare=asNumber(avg.share);
    const fgDelta=fg!==null&&leagueFg!==null?fg-leagueFg:null;
    const volumeDelta=share!==null&&leagueShare!==null?share-leagueShare:null;
    const grades=zoneSignalGrade({fga,totalFga:attempts,fg,share,leagueFg,leagueShare});
    const tiny = fga===null||fga<25;
    let flag='MIXED',tone='neutral',why='Mixed volume and accuracy';
    if(tiny){flag='SMALL SAMPLE';tone='caution';why='Not enough zone shots for a reliable label';}
    else if(fgDelta!==null&&volumeDelta!==null){
      if(fgDelta>=.025&&volumeDelta>=.015){flag='WEAK SPOT';tone='weak';why='More attempts and better shooting allowed than league average';}
      else if(fgDelta>=.04){flag='HIGH FG%';tone='weak';why='Opponents shoot noticeably better than league average here';}
      else if(volumeDelta>=.025){flag='HIGH VOLUME';tone='weak';why='Opponents take noticeably more shots here';}
      else if(fgDelta<=-.025&&volumeDelta<=-.015){flag='TOUGH ZONE';tone='strong';why='Fewer attempts and lower FG% than league average';}
      else {flag='MIXED';tone='neutral';why='No clear two-signal advantage for opponents';}
    }
    const strength = !tiny && fgDelta!==null&&volumeDelta!==null
      ? Math.max(0,fgDelta/.03)*.55 + Math.max(0,volumeDelta/.02)*.45 : 0;
    return {id:z.id,name:z.name,short:z.short,fga,fgm,fg,share,leagueFg,leagueShare,fgDelta,volumeDelta,flag,tone,why,strength,...grades};
  });
  return {
    code:team.code,name:team.name,totalFga:attempts,zones,
    weaknesses:zones.filter(z=>z.tone==='weak').sort((a,b)=>b.strength-a.strength),
    isEstimate:String(defense.source||'').toLowerCase().includes('espn'),
    asof:defense.asof||null,source:defense.source||null,
  };
}

const $ = id => document.getElementById(id);
let cached=null, selectedZone='rim', loading=false, lastChecked=null;
function zoneItem(z,selected=false){
 return `<button class="dz-court-zone dz-${escapeText(z.id)} dz-${z.tone}${selected?' active':''}" type="button" data-zone="${escapeText(z.id)}" aria-pressed="${selected}"><span class="dz-small-name">${escapeText(z.short)}</span><strong>${pct(z.fg)}</strong><small>${number(z.fga)} FGA</small></button>`;
}
function rowItem(z){
 const on=z.id===selectedZone;
 return `<button type="button" class="dz-zone-row ${on?'is-selected':''}" data-zone="${escapeText(z.id)}" aria-pressed="${on}">
  <span class="dz-zone-name"><b>${escapeText(z.name)}</b><small>${escapeText(z.flag)}</small></span>
  <span><b>${number(z.fga)}</b><small>FGA allowed · volume grade ${z.volumeGrade??"—"}</small></span>
  <span><b>${pct(z.fg)}</b><small>FG% allowed · accuracy grade ${z.efficiencyGrade??"—"}</small></span>
  <span class="dz-delta ${z.fgDelta!==null&&z.fgDelta>0?'dz-up':z.fgDelta!==null&&z.fgDelta<0?'dz-down':''}"><b>${pp(z.fgDelta)}</b><small>FG% vs league</small></span>
 </button>`;
}
function render() {
 const code=$('dzTeam')?.value, view=summarizeDefenseZones(cached?.defense,code);
 if(!view){if($('dzStatus'))$('dzStatus').textContent='No defensive data for this team.';return;}
 if(!view.zones.some(z=>z.id===selectedZone))selectedZone='rim';
 const active=view.zones.find(z=>z.id===selectedZone);
 $('dzTitle').textContent=`${view.name} · opponent shot zones`;
 $('dzStatus').textContent=`${view.totalFga.toLocaleString('en-US')} total classified opponent FGA · ${cached?.status?.source||view.source||'Source pending'}${cached?.status?.dataAsOf?' · Through '+cached.status.dataAsOf:view.asof?' · Through '+view.asof:''}`;
 $('dzCourt').innerHTML=view.zones.map(z=>zoneItem(z,z.id===selectedZone)).join('');
 $('dzRows').innerHTML=view.zones.map(z=>rowItem(z)).join('');
 $('dzHighlight').innerHTML=`<div class="dz-active-badge dz-${active.tone}">${escapeText(active.flag)}</div><strong>${escapeText(active.name)}</strong><p>${escapeText(active.why)}.</p><div class="dz-focus-metrics"><span><b>${number(active.fga)}</b><small>FGA allowed (total)</small></span><span><b>${pct(active.share)}</b><small>Share of shots allowed</small></span><span><b>${pct(active.fg)}</b><small>FG% allowed</small></span><span><b>${pct(active.leagueFg)}</b><small>League FG%</small></span></div><div class="dz-separate-grade"><div><strong>${active.volumeGrade??'—'}/100</strong><small>VOLUME ALLOWED GRADE</small><p>${escapeText(active.volumeLabel)} · ${pp(active.volumeDelta)} shot share vs league</p></div><div><strong>${active.efficiencyGrade??'—'}/100</strong><small>FG% ALLOWED GRADE</small><p>${escapeText(active.efficiencyLabel)} · ${pp(active.fgDelta)} FG% vs league</p></div></div><p class="dz-compare">50 is league neutral. Values above 50 are more permissive. FG% grades shrink small zone samples (${number(active.fga)} attempts); neither grade is a player's probability of scoring.</p>`;
 const lead=view.weaknesses.slice(0,3);
 $('dzWeaknesses').innerHTML=lead.length?lead.map((z,i)=>`<button class="dz-lead" type="button" data-zone="${escapeText(z.id)}"><small>${i+1} · ${escapeText(z.flag)}</small><strong>${escapeText(z.name)}</strong><span>${pct(z.fg)} FG% allowed · ${number(z.fga)} FGA · ${pp(z.fgDelta)} vs league</span><em>Volume grade ${z.volumeGrade??"—"} · FG% grade ${z.efficiencyGrade??"—"}</em></button>`).join(''):
  '<div class="dz-lead dz-no-lead">No clear weak spot by the current volume/FG% thresholds. Inspect individual zones for mixed signals.</div>';
 $('dzCaveat').textContent=(cached?.status?.officialZonesAreExact===false || view.isEstimate) ? 'Shot zones are ESPN coordinate estimates, not official NBA zone classifications. Total FGA and FG% are descriptive, not a prediction of any individual player prop.' : 'Shot-zone totals are an as-of snapshot; total FGA is not a per-game number. A high opponent FG% alone does not predict an individual player prop.';
 $('dzCourt').querySelectorAll('[data-zone]').forEach(b=>b.onclick=()=>choose(b.dataset.zone));
 $('dzRows').querySelectorAll('[data-zone]').forEach(b=>b.onclick=()=>choose(b.dataset.zone));
 $('dzWeaknesses').querySelectorAll('[data-zone]').forEach(b=>b.onclick=()=>choose(b.dataset.zone));
}
function choose(zone){selectedZone=zone;render();}
function setupTeams(defense){
 const sel=$('dzTeam');if(!sel)return;
 const old=sel.value;
 const teams=[...defense.teams].sort((a,b)=>a.name.localeCompare(b.name));
 sel.innerHTML=teams.map(t=>`<option value="${escapeText(t.code)}">${escapeText(t.name)} (${escapeText(t.code)})</option>`).join('');
 sel.value=teams.some(t=>t.code===old)?old:teams.some(t=>t.code==='OKC')?'OKC':teams[0]?.code||'';
 sel.onchange=()=>{selectedZone='rim';render()};
}
async function load(reload=false){
 if(loading||!$('dzTeam'))return;
 if(cached&&!reload){render();return;}
 loading=true;$('dzStatus').textContent='Loading opponent shooting zones…';
 try{
  const response=await fetch('/api/bootstrap',{cache:'no-store'});
  if(!response.ok)throw new Error(`Dashboard returned HTTP ${response.status}`);
  const data=await response.json();
  if(!Array.isArray(data?.defense?.teams)||data.defense.teams.length===0)throw Error('No team defensive zones found in the current feed');
  cached=data;lastChecked=Date.now();setupTeams(data.defense);render();
 }catch(e){$('dzStatus').textContent=`Could not load zone data: ${e.message}`;}
 finally{loading=false;}
}
if(typeof window!=='undefined'&&typeof document!=='undefined'){
 const start=()=>{
  if(!$('dzTeam'))return;
  $('dzRefresh').onclick=()=>load(true);
  window.addEventListener('scout-zones-open',()=>load(false));
  window.addEventListener('scout-zone-select',async event=>{
   const team=event.detail?.team,zone=event.detail?.zone;
   if(!cached)await load(false);
   if(cached?.defense?.teams?.some(x=>x.code===team)){
    $('dzTeam').value=team;
    selectedZone=ZONES.some(z=>z.id===zone)?zone:'rim';render();
   }
  });
  // Defer a network request until the tab is opened.
  if(!$('zonesPage').hidden)load(false);
 };
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
}
