/** Transparent ESPN box-score defense vs broad G/F/C, not commercial exact-position DvP.
 * Opposing PLAYER game averages; not normalized for matchup quality or player minutes.
 */
import {statValue,STATS} from './research.mjs';
import {keyName,clamp} from './model.mjs';
const POS=new Set(['G','F','C']);
const dayKey=value=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
const round=n=>Number.isFinite(n)?Math.round(n*10)/10:null;
const rosterIndex=rosters=>Object.fromEntries(Object.entries(rosters).map(([code,ps])=>[code,new Map(ps.map(p=>[String(p.id),p.pos]))]));
export function buildDvpIndex(gameCache,rosters,day){
 const index={},rindex=rosterIndex(rosters);let games=0;
 for(const g of Object.values(gameCache||{})){
  if(!g?.date||!g?.teams?.length||!Array.isArray(g.players)||dayKey(g.date)>=day)continue;games++;
  for(const p of g.players){
   if(!p.box||!p.played||!(p.minutes>=10)||!g.teams.includes(p.team))continue;
   const opp=g.teams.find(t=>t!==p.team);if(!opp)continue;
   const pos=String(p.pos||rindex[p.team]?.get(String(p.id))||'').toUpperCase().slice(0,1);
   if(!POS.has(pos))continue;
   const entry=index[opp]??=(Object.create(null));
   const bucket=entry[pos]??=Object.create(null);
   for(const stat of Object.keys(STATS)){
    const v=statValue(p.box,stat);if(v===null||!Number.isFinite(v))continue;
    const a=bucket[stat]??={total:0,n:0};a.total+=v;a.n++;
   }
  }
 }
 const keyTotals={};for(const [team,groups] of Object.entries(index))for(const [pos,stats]of Object.entries(groups))for(const [stat,box] of Object.entries(stats)){
  const k=`${pos}_${stat}`; (keyTotals[k]??=[]).push({team,average:box.total/box.n,count:box.n});
 }
 const ranking={};for(const [key,arr] of Object.entries(keyTotals)){
  arr.sort((a,b)=>a.average-b.average);
  ranking[key]=new Map(arr.map((a,i)=>[a.team,{...a,rankHardToEasy:i+1,availableTeams:arr.length}]));
 }
 return {day,games,ranking,source:'ESPN pregame opposing-player box scores · broad G/F/C proxy (not FantasyPros PG/SG/SF/PF/C)'};
}
function grade(x){return x>=80?'A':x>=68?'B':x>=53?'C':x>=40?'D':'F';}
export function defenseMatchup(index,{opponent,pos,stat,zoneScore=null}){
 const group=String(pos||'').toUpperCase().slice(0,1),entry=index?.ranking?.[`${group}_${stat}`]?.get(opponent);
 if(!entry||entry.count<8||entry.availableTeams<12)return {available:false,score:null,grade:null,side:null,proxy:true,source:index?.source||null};
 const percentile=entry.availableTeams===1?50:100*(entry.rankHardToEasy-1)/(entry.availableTeams-1);
 // League rank 1 = fewest to position (tough); rank N = most (soft).
 const moreScore=zoneScore!=null&&['PTS','3PM','3PA','2PM','FGA'].includes(stat)
 ?clamp(.65*percentile+.35*zoneScore,0,100):percentile;
 const score=Math.round(moreScore),lessScore=100-score;
 return {available:true,score,grade:grade(score),lessScore,lessGrade:grade(lessScore),rank:entry.rankHardToEasy,
  totalTeams:entry.availableTeams,allowedAverage:round(entry.average),sample:entry.count,position:group,stat,opponent,
  primary:`${opponent} #${entry.rankHardToEasy}/${entry.availableTeams} (1 toughest · ${entry.availableTeams} softest)`,
  zoneScore:zoneScore==null?null:round(zoneScore),proxy:true,source:index.source,notes:'G/F/C position-group opponent per-player averages: descriptive matchup opportunity, not expected player output or betting probability'};
}
