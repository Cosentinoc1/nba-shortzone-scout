/**
 * 2026–27 NBA fantasy POSITION ELIGIBILITY (not confirmed game-day matchup slot).
 * Primary source: NBA.com publishing Dan Titus/Yahoo's September 29, 2026 list.
 * Exact on-court starter slot / licensed position takes precedence elsewhere.
 * Real 250-player dated snapshot is a backup when NBA.com HTML is unreachable.
 * No fabricated player positions, no assigning an arbitrary 'primary' from multi-pos.
 */
import {readFile} from 'node:fs/promises';
import {keyName} from './model.mjs';
const SOURCE_URL='https://www.nba.com/news/nba-fantasy-top-250-points-league-rankings';
const DATE='2026-09-29';
const EXACT=new Set(['PG','SG','SF','PF','C']);
const TEAMS=new Set(['ATL','BOS','BKN','CHA','CHI','CLE','DAL','DEN','DET','GSW','HOU','IND','LAC','LAL','MEM','MIA','MIL','MIN','NOP','NYK','OKC','ORL','PHI','PHX','POR','SAC','SAS','TOR','UTA','WAS']);
const parseName=s=>String(s||'').normalize('NFKC').replace(/<[^>]+>/g,' ').replace(/&(?:nbsp|amp);/g,' ').replace(/\s+/g,' ').trim();
const normalizeTeam=s=>({'NOR':'NOP','NO':'NOP','PHO':'PHX','GS':'GSW','SA':'SAS','NY':'NYK'}[String(s||'').trim().toUpperCase()]||String(s||'').trim().toUpperCase());
const parsePositions=x=>[...new Set(String(x||'').replace(/\s/g,'').toUpperCase().split(',').filter(t=>EXACT.has(t)))];
const key=(team,name)=>normalizeTeam(team)+':'+keyName(name);
export function parsePositionRows(rows){
 const entries={},duplicates=[];let processed=0;
 for(const item of rows){
  const name=parseName(item.name),team=normalizeTeam(item.team),positions=parsePositions(item.positions);
  if(!name||!TEAMS.has(team)||!positions.length)continue;
  const k=key(team,name);if(entries[k]){duplicates.push(k);delete entries[k];continue;}
  entries[k]={name,team,positions};processed++;
 }
 // Duplicates could mean a stale join across teams; never pick one arbitrarily.
 for(const k of duplicates)delete entries[k];
 return {entries,count:Object.keys(entries).length,processed,duplicates};
}
export function parseSnapshotCsv(csv){
 const lines=String(csv||'').trim().split(/\r?\n/).filter(Boolean);
 if(lines[0]?.trim()!=='name|positions|team')throw Error('Unexpected NBA fantasy positions snapshot headers');
 const rows=lines.slice(1).map(line=>{
  const p=line.split('|');return p.length===3?{name:p[0],positions:p[1],team:p[2]}:{};
 });
 return parsePositionRows(rows);
}
export function parsePublishedHtml(html){
 const text=String(html||'');const table=text.match(/<table\b[^>]*>[\s\S]*?<\/table>/i)?.[0];
 if(!table)throw Error('NBA.com published position table not found');
 const rows=[...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(m=>{
  const cells=[...m[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(x=>parseName(x[1]));
  return cells.length===4&&/^\d+$/.test(cells[0])?{name:cells[1],positions:cells[2],team:cells[3]}:{};
 });
 const parsed=parsePositionRows(rows);
 if(parsed.count<175)throw Error('NBA.com published positions table incomplete: '+parsed.count);
 return parsed;
}
let cached=null,cachedAt=0,pending=null;
export async function getPublishedPositions({day,now=Date.now(),fetcher=globalThis.fetch}={}){
 if(!day||day<DATE)return {available:false,reason:'Position source was not published before the requested slate (no future-data leakage)'};
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now));
 if(cached&&now-cachedAt<12*3600000&&day===today)return cached;
 if(pending&&day===today)return pending;
 const load=async()=>{
  const csv=await readFile(new URL('../data/nba_fantasy_positions_2026.csv',import.meta.url),'utf8');
  const fallback=parseSnapshotCsv(csv);
  if(fallback.count<200)throw Error('Bundled source-based 2026 player positions snapshot is incomplete');
  let data=fallback,reason=null,live=false;
  if(day===today&&typeof fetcher==='function'){
   const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),6500);
   try{
    const r=await fetcher(SOURCE_URL,{signal:ctl.signal,headers:{Accept:'text/html','User-Agent':'NBA-Scout/2.3 (position research)'}});
    if(!r.ok)throw Error('NBA.com HTTP '+r.status);
    data=parsePublishedHtml(await r.text());live=true;
   }catch(e){reason='NBA.com live list unavailable; using Sept 29 sourced snapshot ('+String(e?.message||e)+')';}
   finally{clearTimeout(timer)}
  }
  return {available:true,positions:data.entries,count:data.count,source:'NBA.com · Dan Titus / Yahoo fantasy positional eligibility',url:SOURCE_URL,
   publishedAt:DATE,checkedAt:new Date(now).toISOString(),live,reason,
   positionSemantics:'Published fantasy eligibility. Multiple positions do NOT identify the actual position played tonight.'};
 };
 if(day!==today)return load();
 pending=load();try{cached=await pending;cachedAt=now;return cached;}finally{pending=null;}
}
export function publishedMatchup(dvpFeed,positionFeed,{team,player,opponent,stat}={}){
 if(!dvpFeed?.available||!positionFeed?.available)return null;
 const listing=positionFeed.positions?.[key(team,player)];
 if(!listing?.positions?.length)return null;
 // External matchup lives in our previously sourced full-season DvP table.
 const {externalMatchup}=MATCHUPS;
 const results=listing.positions.map(pos=>externalMatchup(dvpFeed,{opponent,pos,stat}));
 // Do not cherry-pick only favorable positions when any eligible role lacks data.
 if(results.some(x=>!x?.available))return null;
 const scores=results.map(x=>x.score),lo=Math.min(...scores),hi=Math.max(...scores),score=Math.round(scores.reduce((a,b)=>a+b,0)/scores.length);
 const grade=v=>v>=80?'A':v>=68?'B':v>=53?'C':v>=40?'D':'F';
 const components=results.flatMap(x=>x.components||[]);
 const allowed=Math.round(results.reduce((s,x)=>s+x.allowedAverage,0)/results.length*10)/10;
 return {available:true,proxy:true,positionBasis:'published fantasy eligibility; actual matchup slot unconfirmed',
  position:listing.positions.join('/'),positionCandidates:listing.positions,
  score,lessScore:100-score,grade:grade(score),lessGrade:grade(100-score),range:{more:[lo,hi],less:[100-hi,100-lo]},
  allowedAverage:allowed,stat,opponent,rank:null,totalTeams:30,components,
  primary:opponent+' vs published '+listing.positions.join('/')+' eligibility',
  source:'NBA House 2026–27 DvP + NBA.com/Yahoo 2026 fantasy eligibility',sourceUrl:dvpFeed.url,
  positionSourceUrl:positionFeed.url,positionSourceDate:positionFeed.publishedAt,updatedAt:dvpFeed.updatedAt,
  notes:'Position-eligibility estimate only. Average of all published eligible positions; range '+lo+'–'+hi+
  ' MORE score. The player may occupy a different game-day role. Verify lineup before submitting. Not a probability.'};
}
// Avoid importing public-dvp.mjs circularly during ESM startup; explicit binding below.
import {externalMatchup as sourceMatchup} from './public-dvp.mjs';
const MATCHUPS={externalMatchup:sourceMatchup};
