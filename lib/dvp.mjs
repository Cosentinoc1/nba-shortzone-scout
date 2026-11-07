/**
 * Pregame ESPN opponent box-score DvP. Exact-position PG/SG/SF/PF/C
 * only when explicitly sourced (e.g. user-uploaded RotoWire position map).
 * G/F/C remains a clearly labeled descriptive proxy and never earns A-F.
 */
import {statValue,STATS} from './research.mjs';
import {keyName,clamp} from './model.mjs';
const GROUPS=new Set(['G','F','C']),EXACT=new Set(['PG','SG','SF','PF','C']);
const dayKey=v=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(v));
const round=n=>Number.isFinite(n)?Math.round(n*10)/10:null;
const upper=s=>String(s||'').trim().toUpperCase();
const pos5=s=>{const v=upper(s);return EXACT.has(v)?v:null};
const grade=n=>n>=80?'A':n>=68?'B':n>=53?'C':n>=40?'D':'F';
const indexRosters=rosters=>Object.fromEntries(Object.entries(rosters).map(([team,list])=>[team,new Map((list||[]).map(p=>[String(p.id),p]))]));
export function buildDvpIndex(gameCache,rosters,day,{positionOverrides=[]}={}){
 const old={},detailed={},ri=indexRosters(rosters),override=new Map();let games=0;
 for(const p of positionOverrides||[]){
  const pos=pos5(p.pos||p.Pos||p.position);
  if(pos&&p.team&&p.name)override.set(upper(p.team)+':'+keyName(p.name),pos);
 }
 for(const g of Object.values(gameCache||{})){
  if(!g?.date||!Array.isArray(g.teams)||!Array.isArray(g.players)||dayKey(g.date)>=day)continue;
  games++;
  for(const p of g.players){
   if(!p.box||!p.played||!(Number(p.minutes)>=10)||!g.teams.includes(p.team))continue;
   const opponent=g.teams.find(t=>t!==p.team);if(!opponent)continue;
   const roster=ri[p.team]?.get(String(p.id));
   const x=pos5(override.get(p.team+':'+keyName(p.name||roster?.name))||p.pos||roster?.pos);
   const rawPos=upper(p.pos||roster?.pos||'');
   const broad=x?(x==='PG'||x==='SG'?'G':x==='C'?'C':'F'):null;
   const group=GROUPS.has(rawPos.slice(0,1))?rawPos.slice(0,1):broad;
   if(!GROUPS.has(group))continue;
   const legacy=old[opponent]??=Object.create(null),bucket=legacy[group]??=Object.create(null);
   const detail=x?(detailed[opponent]??=Object.create(null))[x]??=Object.create(null):null;
   for(const stat of Object.keys(STATS)){
    const value=statValue(p.box,stat);if(!Number.isFinite(value))continue;
    const item=bucket[stat]??={total:0,n:0};item.total+=value;item.n++;
    if(detail){const d=detail[stat]??={total36:0,n:0,games:new Set()};d.total36+=value*36/Number(p.minutes);d.n++;d.games.add(g.id||g.date)}
   }
  }
 }
 // Keep broad G/F/C historical rankings available to legacy reports/tests,
 // but exclude them from a letter grade on the prop decision board.
 const keyTotals={};
 for(const [team,groups] of Object.entries(old))for(const [pos,stats] of Object.entries(groups))for(const [stat,box] of Object.entries(stats)){
  (keyTotals[pos+'_'+stat]??=[]).push({team,average:box.total/box.n,count:box.n});
 }
 const ranking={};for(const [key,arr] of Object.entries(keyTotals)){
  arr.sort((a,b)=>a.average-b.average);
  ranking[key]=new Map(arr.map((a,i)=>[a.team,{...a,rankHardToEasy:i+1,availableTeams:arr.length}]));
 }
 // Exact positions are normalized per 36 minutes and shrunk toward league
 // opponent-player baseline, reducing noise from rotation and early season.
 const exactTotals={};
 for(const [team,groups] of Object.entries(detailed))for(const [pos,stats] of Object.entries(groups))for(const [stat,x] of Object.entries(stats)){
  (exactTotals[pos+'_'+stat]??=[]).push({team,average:x.total36/x.n,count:x.n,games:x.games.size});
 }
 const exactRanking={};for(const [key,all] of Object.entries(exactTotals)){
  const pool=all.filter(x=>x.count>=6&&x.games>=3);
  if(pool.length<8)continue;
  const total=pool.reduce((s,x)=>s+x.average*x.count,0),count=pool.reduce((s,x)=>s+x.count,0);
  const prior=count?total/count:0;
  const entries=pool.map(x=>({...x,shrunk:(x.average*x.count+prior*12)/(x.count+12)})).sort((a,b)=>a.shrunk-b.shrunk);
  exactRanking[key]=new Map(entries.map((x,i)=>[x.team,{...x,rankHardToEasy:i+1,availableTeams:entries.length,leagueBaseline:prior}]));
 }
 return {day,games,ranking,exactRanking,hasPositionOverrides:override.size>0,
  source:'ESPN prior opponent box scores. Exact PG/SG/SF/PF/C requires sourced player-position map; stat-specific per-36 and shrinkage.'};
}
export function defenseMatchup(index,{opponent,pos,stat,zoneScore=null}){
 const position=pos5(pos),group=upper(pos).slice(0,1);
 const exact=position?index?.exactRanking?.[position+'_'+stat]?.get(opponent):null;
 if(exact){
  const percentile=100*(exact.rankHardToEasy-1)/(exact.availableTeams-1);
  const shot=['PTS','3PM','3PA','2PM','FGA'].includes(stat);
  const score=Math.round(clamp(shot&&Number.isFinite(zoneScore)?(.8*percentile+.2*zoneScore):percentile,5,95));
  return {available:true,proxy:false,score,lessScore:100-score,grade:grade(score),lessGrade:grade(100-score),
   rank:exact.rankHardToEasy,totalTeams:exact.availableTeams,allowedAverage:round(exact.average),sample:exact.count,
   games:exact.games,position,stat,opponent,
   primary:`${opponent} exact ${position} #${exact.rankHardToEasy}/${exact.availableTeams} · #1 restrictive`,
   source:index.source,notes:'Exact listed positions from pregame player-position feed, ESPN opposing-player stats per 36 min, 12-observation shrinkage. Screening only; NOT possession/pace adjusted.'};
 }
 const legacy=GROUPS.has(group)?index?.ranking?.[group+'_'+stat]?.get(opponent):null;
 return {available:false,proxy:true,score:null,grade:null,lessScore:null,lessGrade:null,
  position:position||group||null,stat,opponent,legacyGroup:legacy?group:null,
  proxyAllowedAverage:round(legacy?.average),proxyCount:legacy?.count||0,
  reason:position?'Exact position sample insufficient (min 6 observations, 3 games, 8 comparable defenses)':'Only broad G/F/C position is available',
  source:index?.source||null};
}
