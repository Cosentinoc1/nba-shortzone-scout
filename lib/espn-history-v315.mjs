/** ESPN player-box-score fallback for a recent-history request.
 * Never invents zeroes for missing stats, and never claims verified shot zones.
 * schemaVersion=1 means shot-zone consumers must NOT use this game.
 */
import {normalizeTeam} from './model.mjs';
const numeric=value=>value===null||value===undefined||String(value).trim()===''?null:Number.isFinite(Number(value))?Number(value):null;
const pair=value=>{const m=/^(\d+)-(\d+)$/.exec(String(value??''));return m?[Number(m[1]),Number(m[2])]:[null,null]};
export function parseHistoryBoxScore(event,summary){
 const competitors=event?.competitions?.[0]?.competitors||[];
 const teams=[...new Set(competitors.map(x=>normalizeTeam(x.team?.abbreviation)).filter(x=>/^[A-Z]{2,3}$/.test(x)))];
 if(teams.length!==2)throw Error('Missing official event team identities');
 const players=[];let valid=0;
 for(const group of summary?.boxscore?.players||[]){
  const team=normalizeTeam(group.team?.abbreviation);
  if(!teams.includes(team))continue;
  for(const section of group.statistics||[]){
   const labels=section.labels||section.names||[];
   for(const entry of section.athletes||[]){
    const athlete=entry.athlete||{},id=String(athlete.id||'');if(!id||!athlete.displayName||!Array.isArray(entry.stats))continue;
    const at=label=>{const i=labels.indexOf(label);return i>=0?entry.stats[i]:null};
    const minutesText=String(at('MIN')??'');
    const match=/^(\d+)(?::([0-5]\d))?$/.exec(minutesText);
    const minutes=match?Number(match[1])+(match[2]?Number(match[2])/60:0):null;
    const played=!entry.didNotPlay&&!entry.dnp&&minutes!==null&&minutes>0;
    const [fgm,fga]=pair(at('FG')),[tpm,tpa]=pair(at('3PT')),[ftm,fta]=pair(at('FT'));
    const box={pts:numeric(at('PTS')),reb:numeric(at('REB')),ast:numeric(at('AST')),
      fgm,fga,tpm,tpa,ftm,fta,oreb:numeric(at('OREB')),dreb:numeric(at('DREB'))};
    if(played&&[box.pts,box.reb,box.ast].some(x=>x!==null))valid++;
    players.push({id,name:athlete.displayName,team,pos:athlete.position?.abbreviation||'',
      played,minutes,box,zones:null,historyBoxOnly:true});
   }
  }
 }
 if(valid<2)throw Error('Not enough valid official player box scores');
 return {id:String(event.id),date:event.date,teams,players,schemaVersion:1,
   source:'ESPN final player box scores; shot-zone reconstruction unavailable',historyOnly:true};
}
