/**
 * RFPP 2.2 external exact-position defensive allowance. Source: public
 * NBA House 2026-27 season-to-date PG/SG/SF/PF/C DvP tables, when accessible.
 * No subscriber access, credentials, estimates, or fabricated fallback values.
 * Do not reuse current DvP for historical pregame audits (look-ahead leakage).
 */
const POS=['PG','SG','SF','PF','C'];
const STATS=['PTS','REB','AST','3PM'];
const NAMES={
 'Atlanta Hawks':'ATL','Boston Celtics':'BOS','Brooklyn Nets':'BKN','Charlotte Hornets':'CHA',
 'Chicago Bulls':'CHI','Cleveland Cavaliers':'CLE','Dallas Mavericks':'DAL','Denver Nuggets':'DEN',
 'Detroit Pistons':'DET','Golden State Warriors':'GSW','Houston Rockets':'HOU','Indiana Pacers':'IND',
 'Los Angeles Clippers':'LAC','Los Angeles Lakers':'LAL','Memphis Grizzlies':'MEM','Miami Heat':'MIA',
 'Milwaukee Bucks':'MIL','Minnesota Timberwolves':'MIN','New Orleans Pelicans':'NOP','New York Knicks':'NYK',
 'Oklahoma City Thunder':'OKC','Orlando Magic':'ORL','Philadelphia 76ers':'PHI','Phoenix Suns':'PHX',
 'Portland Trail Blazers':'POR','Sacramento Kings':'SAC','San Antonio Spurs':'SAS','Toronto Raptors':'TOR',
 'Utah Jazz':'UTA','Washington Wizards':'WAS'
};
const strip=x=>String(x).replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim();
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
const chicagoDate=d=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(d));
const valueKey=(team,pos,stat)=>team+'|'+pos+'|'+stat;
let cache=null,at=0, inflight=null;

export function parsePositionPage(html,stat){
 if(!STATS.includes(stat))throw new Error('Unsupported stat');
 const table=String(html).match(/<table\b[^>]*>[\s\S]*?<\/table>/i)?.[0];
 if(!table)throw new Error('Exact-position defense table not found');
 const rows=[...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)];
 const parsed=new Map();
 for(const row of rows){
  const cells=[...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(x=>strip(x[1]));
  if(cells.length!==6)continue;
  const team=NAMES[cells[0]];if(!team)continue;
  POS.forEach((pos,i)=>{
   const match=cells[i+1].match(/^(-?\d+(?:\.\d+)?)\s*#\s*(\d+)\b/);
   if(match&&Number(match[2])>=1&&Number(match[2])<=30)
    parsed.set(valueKey(team,pos,stat),{value:Number(match[1]),rankMostAllowed:Number(match[2]),position:pos,stat,team});
  });
 }
 // Reject truncated, wrong-year, consent, and changed-layout pages.
 if(parsed.size<135)throw new Error('Only '+parsed.size+'/150 expected positional DvP entries');
 return parsed;
}

export async function getPublicDvp({day,now=Date.now(),fetcher=globalThis.fetch}={}){
 if(!day||day<chicagoDate(now))return {available:false,reason:'Historical-day exact DvP snapshot unavailable; current stats would leak future results',source:'No hindsight'};
 if(cache&&now-at<6*3600000)return cache;
 if(inflight)return inflight;
 inflight=(async()=>{
  const parsed=new Map(),failures=[];
  const pulls=await Promise.allSettled(STATS.map(async stat=>{
   const uri='https://www.nbahouse.net/defense-vs-position?stat='+encodeURIComponent(stat)+'&tf=season';
   const control=new AbortController();const timer=setTimeout(()=>control.abort(),7000);
   try{
    const response=await fetcher(uri,{signal:control.signal,headers:{Accept:'text/html','User-Agent':'NBA-Scout/2.2 (+research; source credited)'}});
    if(!response.ok)throw new Error('HTTP '+response.status);
    return parsePositionPage(await response.text(),stat);
   }finally{clearTimeout(timer)}
  }));
  pulls.forEach((r,i)=>{
   if(r.status==='fulfilled')for(const [k,v] of r.value)parsed.set(k,v);
   else failures.push(STATS[i]+': '+String(r.reason?.message||r.reason));
  });
  if(!parsed.size){if(cache)return {...cache,stale:true,reason:failures.join('; ')};return {available:false,reason:failures.join('; '),source:'NBA House public DvP — unavailable'};}
  cache={available:true,values:Object.fromEntries(parsed),source:'NBA House public DvP by exact position; full 2026-27 season-to-date',url:'https://www.nbahouse.net/defense-vs-position',updatedAt:new Date(now).toISOString(),statsLoaded:[...new Set([...parsed.values()].map(x=>x.stat))],failure:failures};
  at=now;return cache;
 })();
 try{return await inflight}finally{inflight=null;}
}

/** Counts from public table: rank 1 MOST allowed, rank 30 LEAST allowed.
 * For combinations, blend available components using their league mean share.
 * Missing components do NOT turn into a supposedly complete matchup grade.
 */
export function externalMatchup(feed,{opponent,pos,stat}={}){
 const p=String(pos||'').toUpperCase();
 const combine={PRA:['PTS','REB','AST'],PR:['PTS','REB'],PA:['PTS','AST'],RA:['REB','AST']};
 const parts=combine[stat]||[stat];
 if(!feed?.available||!POS.includes(p)||parts.some(x=>!STATS.includes(x)))return null;
 const entries=parts.map(s=>feed.values?.[valueKey(opponent,p,s)]);
 if(entries.some(x=>!x))return null;
 const weights=entries.map(e=>Math.max(.25,e.value));const total=weights.reduce((a,b)=>a+b,0);
 // Position rank #1 most allowed translates to MORE defense ease 95; #30 -> 5.
 const more=entries.reduce((sum,e,i)=>sum+(95-90*(e.rankMostAllowed-1)/29)*weights[i]/total,0);
 const score=Math.round(clamp(more,5,95));
 const letter=v=>v>=80?'A':v>=68?'B':v>=53?'C':v>=40?'D':'F';
 return {available:true,proxy:false,score,lessScore:100-score,grade:letter(score),lessGrade:letter(100-score),
  rank:null,totalTeams:30,allowedAverage:Math.round(total*10)/10,sample:null,position:p,stat,opponent,source:feed.source,
  sourceUrl:feed.url,updatedAt:feed.updatedAt,statsLoaded:feed.statsLoaded,components:entries.map(e=>({stat:e.stat,value:e.value,rankMostAllowed:e.rankMostAllowed})),
  primary:opponent+' vs '+p+' · '+entries.map(e=>e.stat+' #'+e.rankMostAllowed+' most allowed').join(', '),
  notes:'2026-27 public season DvP ranks, source labels #1 MOST allowed. Combo weights from source average, NOT an expected player output. Public season early sample and positions may differ from player role.'};
}
