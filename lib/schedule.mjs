import {normalizeTeam} from './model.mjs';
export const MIN_SLATE_DAY='2026-10-20';
export const MAX_SLATE_DAY='2027-04-11';
export function validSlateDay(day){
 if(typeof day!=='string'||!/^(20\d{2})-(\d{2})-(\d{2})$/.test(day))return false;
 const d=new Date(day+'T12:00:00Z');
 return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===day&&day>=MIN_SLATE_DAY&&day<=MAX_SLATE_DAY;
}
export function scoreboardGames(events,rosters){
 return (events||[]).filter(e=>e.season?.type===2).map(e=>{
  const c=e.competitions?.[0]?.competitors||[];
  const awayTeam=c.find(x=>x.homeAway==='away'),homeTeam=c.find(x=>x.homeAway==='home');
  const away=normalizeTeam(awayTeam?.team?.abbreviation),home=normalizeTeam(homeTeam?.team?.abbreviation);
  const type=e.status?.type||{};
  return {id:String(e.id),away,home,label:`${away} @ ${home}`,tipoff:e.date,
   state:type.state||'pre',statusText:type.shortDetail||type.detail||'',completed:Boolean(type.completed),
   awayScore:awayTeam?.score??null,homeScore:homeTeam?.score??null};
 }).filter(g=>g.id&&rosters[g.away]&&rosters[g.home]);
}
