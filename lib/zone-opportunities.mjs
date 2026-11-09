/** Pregame, game-specific player-to-defensive-zone fit. No price/line, no P(win).
 * Requires source games strictly BEFORE the selected slate (Chicago local).
 */
import {defenseZoneGrades,ZONE_IDS,ZONE_LABELS,round} from '../public/zone-metrics.mjs';
const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));
const sum=a=>a.reduce((s,x)=>s+x,0);
const mean=a=>a.length?sum(a)/a.length:null;
const std=a=>a.length>=3?Math.sqrt(mean(a.map(x=>(x-mean(a))**2))):null;
const number=x=>x!==null&&x!==undefined&&x!==''&&Number.isFinite(Number(x))?Number(x):null;
export function chicagoGameDay(value){
 const t=Date.parse(value||''); if(!Number.isFinite(t))return null;
 return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(t));
}
export function priorGamesOnly(gameCache,day){
 return Object.values(gameCache||{}).filter(g=>g?.schemaVersion===2&&Array.isArray(g.players)&&chicagoGameDay(g.date)<day).sort((a,b)=>Date.parse(a.date)-Date.parse(b.date));
}
function playerHistory(games){
 const map=new Map();
 for(const g of games||[]){
  const day=chicagoGameDay(g.date);
  for(const p of g.players||[]){
   if(!p.id||!p.team||!p.played||!Number.isFinite(p.minutes)||p.minutes<=0)continue;
   const key=p.team+':'+p.id;
   if(!map.has(key))map.set(key,[]);
   const fga=number(p.box?.fga);
   map.get(key).push({day,minutes:p.minutes,fga});
  }
 }
 return map;
}
function recentContext(rows,day){
 const r=(rows||[]).filter(x=>x.day<day).slice(-10),r5=r.slice(-5);
 const mins=r5.map(x=>x.minutes).filter(Number.isFinite),fga=r5.map(x=>x.fga).filter(Number.isFinite);
 const m5=mean(mins),m10=mean(r.map(x=>x.minutes).filter(Number.isFinite));
 const minSd=std(mins);
 const daysSince=r.length?Math.max(0,Math.round((Date.parse(day+'T12:00:00Z')-Date.parse(r.at(-1).day+'T12:00:00Z'))/86400000)):null;
 const minutesStability=m5!==null&&minSd!==null?clamp(100-8*minSd,25,95):null;
 return {lastPlayed:r.at(-1)?.day||null,daysSince,minutesL5:round(m5,1),minutesL10:round(m10,1),minutesStability:round(minutesStability,0),fgaL5:round(mean(fga),1),games:r.length};
}
function candidate(profile,defGrades,history,offense,opponent,day){
 const gp=number(profile.gp)||0;
 const totalFga=sum(ZONE_IDS.map(z=>Number(profile.zones?.[z]?.fga)||0));
 if(gp<4||totalFga<32)return null;
 const ctx=recentContext(history,day);
 if(ctx.daysSince!==null&&ctx.daysSince>12)return null; // stale role/participation
 if(ctx.minutesL5!==null&&ctx.minutesL5<16)return null;
 const fgaPerGame=totalFga/gp;
 if(fgaPerGame<3.5)return null;
 const zoneGrades=new Map(defGrades.zones.map(z=>[z.id,z]));
 const rows=ZONE_IDS.map(id=>{
  const d=zoneGrades.get(id),n=Number(profile.zones?.[id]?.fga)||0;
  const share=totalFga>0?n/totalFga:0;
  const rawVolume=d.volumeGrade??50,rawEfficiency=d.efficiencyGrade??50;
  const volumeContribution=share*(rawVolume-50);
  const efficiencyContribution=share*(rawEfficiency-50);
  return {id,name:ZONE_LABELS[id],playerZoneShare:share,playerZoneFgaPerGame:n/gp,playerZoneFga:n,
   defenseFga:d.fga,defenseFg:d.fg,leagueFg:d.leagueFg,
   volumeGrade:rawVolume,efficiencyGrade:rawEfficiency,volumeDeltaPP:d.volumeDeltaPP,fgDeltaPP:d.fgDeltaPP,
   contribution:round(.6*volumeContribution+.4*efficiencyContribution,2)};
 });
 const volumeScore=sum(rows.map(z=>z.playerZoneShare*z.volumeGrade));
 const efficiencyScore=sum(rows.map(z=>z.playerZoneShare*z.efficiencyGrade));
 const threeRows=rows.filter(z=>['left','right','above'].includes(z.id));
 const threeShare=sum(threeRows.map(z=>z.playerZoneShare));
 const threePAperGame=sum(threeRows.map(z=>z.playerZoneFgaPerGame));
 const threeVolume=threeShare>0?sum(threeRows.map(z=>z.playerZoneShare*z.volumeGrade))/threeShare:50;
 const threeEfficiency=threeShare>0?sum(threeRows.map(z=>z.playerZoneShare*z.efficiencyGrade))/threeShare:50;
 const threeMatchScore=clamp(.36*threeVolume+.26*threeEfficiency+.27*clamp(35+6*threePAperGame,30,85)+.11*(ctx.minutesL5===null?50:clamp(50+1.5*(ctx.minutesL5-25),26,74)),15,88);
 const topThree=[...threeRows].filter(x=>x.playerZoneFgaPerGame>=.35).sort((a,b)=>b.contribution-a.contribution||b.playerZoneFgaPerGame-a.playerZoneFgaPerGame)[0]||[...threeRows].sort((a,b)=>b.playerZoneFgaPerGame-a.playerZoneFgaPerGame)[0];
 const baseScore=clamp(35+2.3*fgaPerGame,30,84);
 const minuteScore=ctx.minutesL5===null?50:clamp(50+1.5*(ctx.minutesL5-25),26,74);
 const stability=ctx.minutesStability===null?50:ctx.minutesStability;
 // Recent box-score attempt trend is informative but softly weighted, not a projection.
 const form=ctx.fgaL5===null?50:clamp(50+3.5*(ctx.fgaL5-fgaPerGame),28,72);
 const reliability=clamp(Math.min(gp/10,totalFga/100),0,1);
 const raw=.30*volumeScore+.21*efficiencyScore+.22*baseScore+.14*minuteScore+.08*form+.05*stability;
 // Small samples shrink only the match-specific deviation from neutral.
 const score=clamp(50+(raw-50)*(.7+.3*reliability),15,88);
 const top=[...rows].filter(x=>x.playerZoneFgaPerGame>=.35).sort((a,b)=>b.contribution-a.contribution||b.playerZoneFgaPerGame-a.playerZoneFgaPerGame)[0]
   || [...rows].sort((a,b)=>b.playerZoneFgaPerGame-a.playerZoneFgaPerGame)[0];
 const best=top?.contribution>0?top:[...rows].sort((a,b)=>b.playerZoneFgaPerGame-a.playerZoneFgaPerGame)[0];
 const supported=volumeScore>=54&&efficiencyScore>=51&&ctx.minutesL5!==null&&ctx.minutesL5>=23&&reliability>=.45;
 const tier=score>=62&&supported?'BEST ALIGNMENT':score>=54&&volumeScore>=50?'PROMISING':'MIXED';
 const warnings=[];
 if(ctx.minutesL5===null)warnings.push('Recent minutes unavailable; role unverified');
 else if(ctx.minutesL5<23)warnings.push('Limited recent minutes');
 if(ctx.minutesL10!==null&&ctx.minutesL5!==null&&ctx.minutesL10>0&&Math.abs(ctx.minutesL5/ctx.minutesL10-1)>.18)warnings.push('Minutes changing recently');
 if(reliability<.65)warnings.push('Limited season shot-location sample');
 if(ctx.daysSince!==null&&ctx.daysSince>=5)warnings.push('No appearance in the past '+ctx.daysSince+' days');
 warnings.push('Same-day availability and projected role not confirmed');
 return {id:String(profile.id),player:profile.name,team:offense,opponent,gp,totalFga,
  fgaPerGame:round(fgaPerGame,1),threePAperGame:round(threePAperGame,1),
  threeShare:round(threeShare,3),threeMatchScore:round(threeMatchScore,0),
  top3Zone:topThree?.id||null,top3ZoneName:topThree?.name||null,top3ZoneFgaPerGame:round(topThree?.playerZoneFgaPerGame,1),
  top3ZoneVolumeDeltaPP:topThree?.volumeDeltaPP??null,top3ZoneFgDeltaPP:topThree?.fgDeltaPP??null,
  volumeGrade:round(volumeScore,0),efficiencyGrade:round(efficiencyScore,0),score:round(score,0),tier,
  minutesL5:ctx.minutesL5,fgaL5:ctx.fgaL5,minutesStability:ctx.minutesStability,daysSince:ctx.daysSince,
  sample:totalFga>=95&&gp>=8&&ctx.minutesL5!==null?'MODERATE':'LIMITED',
  topZone:best?.id||null,topZoneName:best?.name||null,topZoneSupports:Boolean(top&&top.contribution>0),topZonePlayerFgaPerGame:round(best?.playerZoneFgaPerGame,1),
  topZoneDefFg:best?.defenseFg??null,topZoneVolumeDeltaPP:best?.volumeDeltaPP??null,topZoneFgDeltaPP:best?.fgDeltaPP??null,
  topZoneFgaAllowed:best?.defenseFga??null,warnings,
  methodology:'30% opponent volume fit + 21% opponent FG% fit + 22% player shot volume + 14% recent minutes + 8% recent attempt trend + 5% minute stability. Not P(win).'};
}
/** Player list is validated against current team roster; excludes thin shot samples. */
export function rankGameZoneOpportunities({day,games=[],playerProfiles=[],defense,historyGames=[],rosters={}}={}){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day||''))throw Error('Valid local game date required');
 const teams=new Map((defense?.teams||[]).map(x=>[x.code,x]));
 const h=playerHistory(historyGames);
 const rosterIds=new Map(Object.entries(rosters).map(([team,players])=>[team,new Set((players||[]).map(p=>String(p.id)))]));
 const byTeam=new Map();
 for(const p of playerProfiles||[]){
  if(!rosterIds.get(p.team)?.has(String(p.id)))continue;
  if(!byTeam.has(p.team))byTeam.set(p.team,[]);byTeam.get(p.team).push(p);
 }
 const result=[];
 for(const game of games){
  if(!game?.away||!game?.home||!teams.has(game.away)||!teams.has(game.home))continue;
  const ranked=[];
  for(const [off,def] of [[game.away,game.home],[game.home,game.away]]){
   const grades=defenseZoneGrades(defense,def);if(!grades)continue;
   for(const p of byTeam.get(off)||[]){
    const row=candidate(p,grades,h.get(off+':'+p.id)||[],off,def,day);
    if(row)ranked.push(row);
   }
  }
  ranked.sort((a,b)=>b.score-a.score||b.volumeGrade-a.volumeGrade||a.player.localeCompare(b.player));
  result.push({id:String(game.id||game.away+'-'+game.home),label:game.label||game.away+' @ '+game.home,
   away:game.away,home:game.home,tipoff:game.tipoff||null,state:game.state||'unknown',
   candidates:ranked.slice(0,40),considered:ranked.length});
 }
 return {date:day,asOf:historyGames.length?chicagoGameDay(historyGames.at(-1).date):null,
  source:'ESPN historical box-score minutes and approximate coordinate-derived shot zones',
  gameCount:result.length,games:result,method:'Descriptive alignment research, not a player-prop recommendation, minutes projection, current injury check or betting probability.'};
}
