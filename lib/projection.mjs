import {ZONES,ZONE_NAMES,clamp,totalShots,matchupGrade} from './model.mjs';

const n = x => Number.isFinite(Number(x)) ? Number(x) : 0;
const round = (x, places=2) => +x.toFixed(places);
const mean = a => a.length ? a.reduce((s,x)=>s+x,0)/a.length : 0;
const numericMinutes = x => Number.isFinite(Number(x)) && +x > 0 ? +x : null;

/**
 * Deliberately conservative shot-volume *heuristic*, not a trained statistical model.
 * Uses only games completed before an event when called by the backtest module.
 */
export function zoneForecast({profile,defenseTeam,league,recentGames=[],expectedMinutes=null,roleVerified=false}){
 if(!profile||!defenseTeam||!league?.zones)return null;
 const gp=n(profile.gp),seasonFga=gp?totalShots(profile)/gp:0;
 const history=recentGames.filter(g=>g&&totalShots(g)>0).slice(-5);
 const minuteObservations=history.map(g=>numericMinutes(g.minutes)).filter(v=>v!==null);
 const typicalMinutes=minuteObservations.length>=2?mean(minuteObservations):null;
 const requestedMinutes=numericMinutes(expectedMinutes);
 const forecastMinutes=requestedMinutes||typicalMinutes;
 const multiplier=typicalMinutes&&forecastMinutes?clamp(forecastMinutes/typicalMinutes,0.65,1.3):1;
 const grade=matchupGrade(profile,defenseTeam,league);
 const zones=ZONES.map(zone=>{
  const p=profile.zones?.[zone]||{},d=defenseTeam.zones?.[zone]||{},l=league.zones?.[zone]||{};
  const season=gp?n(p.fga)/gp:0;
  const recent=history.length>=3?mean(history.map(g=>n(g.zones?.[zone]?.fga))):null;
  const blended=recent===null?season:(.6*recent+.4*season);
  const shareDelta=n(d.share)-n(l.share);
  const matchupMultiplier=clamp(1+1.25*shareDelta,.85,1.15);
  const estimate=round(blended*multiplier*matchupMultiplier);
  const efficiencyGapPP=round(100*(n(d.fg)-n(l.fg)),1);
  return {zone,name:ZONE_NAMES[zone],seasonFga:round(season),recentFga:recent===null?null:round(recent),projectedFga:estimate,efficiencyGapPP,opponentRank:d.rank_share??null,defenseFg:n(d.fg)};
 });
 const target=zones.find(z=>z.zone===grade?.primaryZone)||zones[0];
 const totalProjected=round(zones.reduce((s,z)=>s+z.projectedFga,0));
 const sample=clamp((Math.min(gp,8)/8)*45+(Math.min(totalShots(profile),85)/85)*25,0,70);
 const minutesFactor=minuteObservations.length>=3?16:minuteObservations.length>0?7:0;
 const recentFactor=history.length>=3?10:0;
 // This confidence is data-completeness only. It does not establish injury/lineup status.
 const dataConfidence=Math.round(clamp(sample+minutesFactor+recentFactor,0,96));
 const vetoes=[],reviews=[];
 if(!grade?.eligible)vetoes.push('Insufficient pregame attempts/games to grade this player');
 if(target.efficiencyGapPP<=-5)vetoes.push(`Opposing defense suppresses ${target.name} FG% by ${Math.abs(target.efficiencyGapPP).toFixed(1)} points vs league`);
 if(target.seasonFga>=2&&target.projectedFga<.65*target.seasonFga)vetoes.push('Projected primary-zone attempts are at least 35% below season average');
 else if(target.seasonFga>=2&&target.projectedFga<.8*target.seasonFga)reviews.push('Primary-zone opportunity projects below season average');
 if(forecastMinutes!==null&&forecastMinutes<18)reviews.push('Estimated court time under 18 minutes');
 if(minuteObservations.length<3)reviews.push('Recent playing-time evidence incomplete');
 if(history.length<3)reviews.push('Recent per-game zone evidence incomplete');
 if(!roleVerified)reviews.push('Starting status, injuries and playing-time role not independently confirmed');
 if(!requestedMinutes)reviews.push('Projected minutes are based on recent usage, not an independent pregame minutes feed');
 const status=vetoes.length?'VETO':reviews.length?'REVIEW':'SCOUTING CLEAR';
 const opportunityGrade=grade?.volumeSignal==null?null:round(clamp(50+45*grade.volumeSignal,10,90),1);
 const efficiencyGrade=grade?.efficiencySignal==null?null:round(clamp(50+45*grade.efficiencySignal,10,90),1);
 return {zones,targetZone:target.zone,targetProjectedFga:target.projectedFga,totalProjectedFga:totalProjected,
  seasonFgaPerGame:round(seasonFga),gamesInRecent:history.length,minutesGames:minuteObservations.length,
  typicalMinutes:typicalMinutes===null?null:round(typicalMinutes,1),expectedMinutes:forecastMinutes===null?null:round(forecastMinutes,1),
  minutesSource:requestedMinutes?'User-entered estimate':typicalMinutes?'Last-five observed games':'Unavailable',
  opportunityGrade,efficiencyGrade,dataConfidence,roleVerified:Boolean(roleVerified),
  veto:{status,reasons:vetoes,warnings:reviews,notBetApproved:true},
  method:'60% recent 5 / 40% season zone FGA (or season only when <3 recent games), adjusted ±15% for defensive allowed shot share and scaled by verified/user-entered or recent minutes; heuristic not validated probabilities, not injury or market verified.'};
}
