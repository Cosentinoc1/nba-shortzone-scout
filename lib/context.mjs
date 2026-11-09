/** Public ESPN data for current-day injuries and team game odds. No private API or login. */
import {getPublishedPositions} from './published-positions.mjs';
import {getPublicDvp} from './public-dvp.mjs';
import {normalizeTeam} from './model.mjs';
import {licensedLineupsForDay} from './lineups.mjs';
const BASE='https://site.api.espn.com/apis/site/v2/sports/basketball/nba';
const cache=new Map(),TTL=12*60*1000;
async function fetchJSON(path){
 const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),9000);
 try{const res=await fetch(BASE+path,{signal:ctl.signal,headers:{Accept:'application/json','User-Agent':'NBA-Scout-Research/1.8'}});
  if(!res.ok)throw new Error(`ESPN HTTP ${res.status}`);return await res.json();}finally{clearTimeout(timer)}
}
export function parseInjuries(raw){
 let result=[];for(const team of raw?.injuries||[]){for(const e of team.injuries||[]){const name=e.athlete?.displayName||e.athlete?.fullName;
  const code=normalizeTeam(e.athlete?.team?.abbreviation||team?.abbreviation||team?.displayName||'');
  if(!name||!code)continue;result.push({player:name,team:code,status:e.status||e.type?.description||'Unknown',reason:e.details?.type||e.shortComment||null,updatedAt:e.date||null});
 }}return result;
}
export function parseNews(raw){
 const arr=Array.isArray(raw)?raw:Array.isArray(raw?.headlines)?raw.headlines:Array.isArray(raw?.articles)?raw.articles:[];
 const limitDate=Date.now()-36*3600000;
 return arr.flatMap(x=>{
   const headline=String(x.headline||x.title||'').trim(),link=x.links?.web?.href||x.link||x.url||null;
   const publishedAt=x.published||x.lastModified||x.publishedAt||null;
   const timestamp=Date.parse(publishedAt||'');
   if(!headline||!Number.isFinite(timestamp)||timestamp<limitDate||timestamp>Date.now()+300000)return [];
   const players=[...(x.categories||[])].filter(y=>/athlete|player/i.test(y.type||'')).map(y=>y.description||y.name||'').filter(Boolean);
   return [{headline,url:typeof link==='string'&&/^https?:\/\//.test(link)?link:null,publishedAt,players}];
 }).slice(0,35);
}
export function parseOdds(raw){
 const out=[];for(const ev of raw?.events||[]){const comp=ev.competitions?.[0],away=comp?.competitors?.find(c=>c.homeAway==='away'),home=comp?.competitors?.find(c=>c.homeAway==='home');if(!away||!home)continue;
 const odds=comp.odds?.[0];out.push({id:String(ev.id),away:normalizeTeam(away.team?.abbreviation),home:normalizeTeam(home.team?.abbreviation),tipoff:ev.date,
  odds:odds?{total:odds.overUnder??null,spreadText:odds.details||null,provider:odds.provider?.name||null}:null,source:'ESPN scoreboard'});
 }return out;
}
export async function externalContextForDay(day,teams=[]){
 const now=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 if(day!==now)return {injuries:[],games:[],source:'ESPN current injury data is not applied to historical slates',updatedAt:null,error:'Current injury reports are not valid historical-date evidence'};
 const curr=cache.get(day);if(curr&&Date.now()-curr.at<TTL)return curr.value;
 const [inj,odds,licensed,news]=await Promise.allSettled([fetchJSON('/injuries'),fetchJSON(`/scoreboard?dates=${day.replaceAll('-','')}&limit=50`),licensedLineupsForDay(day,teams),fetchJSON('/news?limit=65')]);
 const errors=[];if(inj.status!=='fulfilled')errors.push('Injuries unavailable: '+inj.reason.message);
 if(odds.status!=='fulfilled')errors.push('Team odds unavailable: '+odds.reason.message);
 const rw=licensed.status==='fulfilled'?licensed.value:{available:false,lineups:{},error:String(licensed.reason)};
 const value={news:news.status==='fulfilled'?parseNews(news.value):[],newsFetched:news.status==='fulfilled',injuries:inj.status==='fulfilled'?parseInjuries(inj.value):[],games:odds.status==='fulfilled'?parseOdds(odds.value):[],injuriesFetched:inj.status==='fulfilled',oddsFetched:odds.status==='fulfilled',lineups:rw.lineups||{},lineupsFetched:Boolean(rw.available),lineupError:rw.error||null,lineupUpdatedAt:rw.updatedAt||null,lineupSource:rw.source||'Licensed lineup source not connected',updatedAt:new Date().toISOString(),source:'ESPN NBA injuries + scoreboard; licensed lineup provider if configured',error:errors.join(' | ')||null};
  const [dvpResult,posResult]=await Promise.allSettled([getPublicDvp({day}),getPublishedPositions({day})]);
  value.publicDvp=dvpResult.status==='fulfilled'?dvpResult.value:{available:false,reason:String(dvpResult.reason)};
  value.publicPositions=posResult.status==='fulfilled'?posResult.value:{available:false,reason:String(posResult.reason)};
  if(inj.status==='fulfilled'||odds.status==='fulfilled')cache.set(day,{at:Date.now(),value});
 return value;
}
