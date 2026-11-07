import {aggregateGames,matchupGrade,totalShots,keyName} from './model.mjs';
import {zoneForecast} from './projection.mjs';

const toLocalDay = date => new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(date));
const rnd = x => Number.isFinite(x)?+x.toFixed(2):null;
const avg = xs => xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:null;
export function gameLocalDate(game){return toLocalDay(game.date)}
/**
 * At every selected day: scores ALL eligible pregame players on teams playing
 * that day before looking up their actual performance. DNPs stay listed.
 * This avoids selecting winning candidates with postgame knowledge.
 */
export function auditDay(gameCache,day,archived=null){
 const all=Object.values(gameCache||{}).filter(g=>g?.date&&Array.isArray(g.players)&&Array.isArray(g.teams));
 const earlier=all.filter(g=>toLocalDay(g.date)<day).sort((a,b)=>a.date.localeCompare(b.date));
 const onDay=all.filter(g=>toLocalDay(g.date)===day);
 if(!onDay.length)return {date:day,ready:false,reason:'No completed, validated games cached for this date. Refresh season data after games finish.',completedGames:0};
 if(earlier.length<20)return {date:day,ready:false,reason:'Not enough prior games for an independent pregame baseline.',completedGames:onDay.length};
 const pre=aggregateGames(earlier),defBy=Object.fromEntries(pre.defense.teams.map(x=>[x.code,x]));
 const preByTeam=Object.groupBy?Object.groupBy(pre.players,p=>p.team):pre.players.reduce((o,p)=>((o[p.team]??=[]).push(p),o),{});
 const historyByTeam={};for(const g of earlier)for(const t of g.teams)(historyByTeam[t]??=[]).push(g);
 const out=[];
 for(const game of onDay){for(const offense of game.teams){
  const opponent=game.teams.find(x=>x!==offense),d=defBy[opponent];if(!d)continue;
  const actualPlayers=game.players.filter(p=>p.team===offense);
  for(const profile of preByTeam[offense]||[]){
   const grade=matchupGrade(profile,d,pre.defense.league);if(!grade?.eligible)continue;
   const recent=(historyByTeam[offense]||[]).map(g=>g.players.find(x=>x.id===profile.id&&x.team===offense)||g.players.find(x=>x.team===offense&&keyName(x.name)===keyName(profile.name))).filter(Boolean);
   const projection=zoneForecast({profile,defenseTeam:d,league:pre.defense.league,recentGames:recent});
   const target=projection.targetZone;
   const actual=actualPlayers.find(p=>p.id===profile.id)||actualPlayers.find(p=>keyName(p.name)===keyName(profile.name));
   const played=Boolean(actual?.played),actualZone=played?(actual.zones?.[target]||{fga:0,fgm:0}):null;
   const baseline=profile.gp?Number(profile.zones[target]?.fga||0)/profile.gp:0;
   out.push({player:profile.name,offense,defense:opponent,gameId:game.id,played,
    grade:grade.score,targetZone:target,baselineZoneFga:rnd(baseline),projectedZoneFga:projection.targetProjectedFga,
    actualZoneFga:played?actualZone.fga:null,actualZoneFgm:played?actualZone.fgm:null,
    actualZoneFgPct:played&&actualZone.fga?rnd(100*actualZone.fgm/actualZone.fga):null,
    actualTotalFga:played?totalShots(actual):null,projectedTotalFga:projection.totalProjectedFga,
    absoluteZoneError:played?rnd(Math.abs(projection.targetProjectedFga-actualZone.fga)):null,
    absoluteTotalError:played?rnd(Math.abs(projection.totalProjectedFga-totalShots(actual))):null,
    beatBaseline:played?actualZone.fga>=baseline:null,
    beatForecast:played?actualZone.fga>=projection.targetProjectedFga:null,
    minutesEvidence:projection.minutesGames,provisional:projection.veto.status!=='SCOUTING CLEAR'});
  }
 }}
 out.sort((a,b)=>b.grade-a.grade||a.player.localeCompare(b.player));
 const top=out.slice(0,6),worst=[...out].reverse().slice(0,6),playedRows=out.filter(x=>x.played);
 const clearRate=a=>{let eligible=a.filter(x=>x.played);return eligible.length?rnd(100*eligible.filter(x=>x.beatBaseline).length/eligible.length):null};
 return {date:day,ready:true,completedGames:onDay.length,priorGames:earlier.length,
  gradedPlayers:out.length,playedGradedPlayers:playedRows.length,unplayedGradedPlayers:out.length-playedRows.length,
  source:'Strict pregame reconstruction using games completed before the Chicago-local slate date. Scores are ranked BEFORE matching outcomes. DNPs remain in Top/Worst 6; no injury, confirmed lineup or market-line adjustment.',
  hasArchivedBoard:Boolean(archived),archivedAt:archived?.capturedAt||null,
  metrics:{zoneFgaMAE:rnd(avg(playedRows.map(x=>x.absoluteZoneError))),totalFgaMAE:rnd(avg(playedRows.map(x=>x.absoluteTotalError))),
   topSixBaselineRate:clearRate(top),worstSixBaselineRate:clearRate(worst),allBaselineRate:clearRate(out),
   topSixPlayed:top.filter(x=>x.played).length,worstSixPlayed:worst.filter(x=>x.played).length},
  top,worst,details:out};
}
