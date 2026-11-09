/** Shared, sample-aware descriptive grades for how a defense allows shots.
 * 50 is league-neutral. These are not player scoring probabilities or betting edges.
 */
const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));
const finite=n=>n!==null&&n!==undefined&&n!==''&&Number.isFinite(Number(n));
const safe=n=>finite(n)?Number(n):null;
export const ZONE_IDS=['rim','paint','mid','left','right','above'];
export const ZONE_LABELS={rim:'Restricted area',paint:'Paint (non-RA)',mid:'Mid-range',left:'Left corner 3',right:'Right corner 3',above:'Above-break 3'};
export const round=(x,d=1)=>Number.isFinite(x)?Number(x.toFixed(d)):null;
/** Direction: above 50 = a more permissive defense for this particular signal. */
export function zoneSignalGrade({fga,totalFga,fg,share,leagueFg,leagueShare}={}){
 const n=safe(fga),nt=safe(totalFga),a=safe(fg),v=safe(share),la=safe(leagueFg),lv=safe(leagueShare);
 const deltaVolume=v!==null&&lv!==null?v-lv:null;
 const deltaFg=a!==null&&la!==null?a-la:null;
 // Total shot share has more observations than a single zone's FG%; shrink separately.
 const volumeReliability=nt!==null&&nt>0?nt/(nt+225):0;
 const fgReliability=n!==null&&n>0?n/(n+80):0;
 const volumeGrade=deltaVolume===null?null:round(clamp(50+420*deltaVolume*volumeReliability,10,90),0);
 const efficiencyGrade=deltaFg===null?null:round(clamp(50+400*deltaFg*fgReliability,10,90),0);
 const reliability=n===null?'missing':n<25?'thin':n<75?'limited':'moderate';
 const label=n=>n===null?'Unavailable':n>=63?'High allowance':n<=40?'Restrictive':'Mixed';
 return {volumeGrade,efficiencyGrade,volumeLabel:label(volumeGrade),efficiencyLabel:label(efficiencyGrade),
  volumeDeltaPP:round(deltaVolume===null?null:100*deltaVolume,1),fgDeltaPP:round(deltaFg===null?null:100*deltaFg,1),
  reliability,volumeReliability:round(volumeReliability,2),fgReliability:round(fgReliability,2)};
}
export function defenseZoneGrades(defense,code){
 const team=(defense?.teams||[]).find(x=>x.code===code),league=defense?.league?.zones;
 if(!team||!league)return null;
 const totalFga=finite(team.attempts)?Number(team.attempts):ZONE_IDS.reduce((s,z)=>s+(safe(team.zones?.[z]?.fga)||0),0);
 const zones=ZONE_IDS.map(id=>{
  const o=team.zones?.[id]||{},l=league[id]||{};
  const fga=safe(o.fga),fgm=safe(o.fgm);
  const share=finite(o.share)?Number(o.share):totalFga>0&&fga!==null?fga/totalFga:null;
  const fg=finite(o.fg)&&fga>0?Number(o.fg):fga>0&&fgm!==null?fgm/fga:null;
  const lgFg=safe(l.fg),lgShare=safe(l.share);
  return {id,name:ZONE_LABELS[id],fga,fgm,fg,share,leagueFg:lgFg,leagueShare:lgShare,
   ...zoneSignalGrade({fga,totalFga,fg,share,leagueFg:lgFg,leagueShare:lgShare})};
 });
 return {code:team.code,name:team.name,totalFga,zones};
}
