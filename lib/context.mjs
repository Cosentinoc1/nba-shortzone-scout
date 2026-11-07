/** Public ESPN data for current-day injuries and team game odds. No private API or login. */
import {normalizeTeam} from './model.mjs';
const BASE='https://site.api.espn.com/apis/site/v2/sports/basketball/nba';
const cache=new Map(),TTL=12*60*1000;
async function fetchJSON(path){
 const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),9000);
 try{const res=await fetch(BASE+path,{signal:ctl.signal,headers:{Accept:'application/json','User-Agent':'NBA-Scout-Research/1.7'}});
  if(!res.ok)throw new Error(`ESPN HTTP ${res.status}`);return await res.json();}finally{clearTimeout(timer)}
}
export function parseInjuries(raw){
 let result=[];for(const team of raw?.injuries||[]){for(const e of team.injuries||[]){const name=e.athlete?.displayName||e.athlete?.fullName;
  const code=normalizeTeam(e.athlete?.team?.abbreviation||team?.abbreviation||team?.displayName||'');
  if(!name||!code)continue;result.push({player:name,team:code,status:e.status||e.type?.description||'Unknown',reason:e.details?.type||e.shortComment||null,updatedAt:e.date||null});
 }}return result;
}
export function parseOdds(raw){
 const out=[];for(const ev of raw?.events||[]){const comp=ev.competitions?.[0],away=comp?.competitors?.find(c=>c.homeAway==='away'),home=comp?.competitors?.find(c=>c.homeAway==='home');if(!away||!home)continue;
 const odds=comp.odds?.[0];out.push({id:String(ev.id),away:normalizeTeam(away.team?.abbreviation),home:normalizeTeam(home.team?.abbreviation),tipoff:ev.date,
  odds:odds?{total:odds.overUnder??null,spreadText:odds.details||null,provider:odds.provider?.name||null}:null,source:'ESPN scoreboard'});
 }return out;
}
export async function externalContextForDay(day){
 const now=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 if(day!==now)return {injuries:[],games:[],source:'ESPN current injury data is not applied to historical slates',updatedAt:null,error:'Current injury reports are not valid historical-date evidence'};
 const curr=cache.get(day);if(curr&&Date.now()-curr.at<TTL)return curr.value;
 const [inj,odds]=await Promise.allSettled([fetchJSON('/injuries'),fetchJSON(`/scoreboard?dates=${day.replaceAll('-','')}&limit=50`)]);
 const errors=[];if(inj.status!=='fulfilled')errors.push('Injuries unavailable: '+inj.reason.message);
 if(odds.status!=='fulfilled')errors.push('Team odds unavailable: '+odds.reason.message);
 const value={injuries:inj.status==='fulfilled'?parseInjuries(inj.value):[],games:odds.status==='fulfilled'?parseOdds(odds.value):[],injuriesFetched:inj.status==='fulfilled',oddsFetched:odds.status==='fulfilled',updatedAt:new Date().toISOString(),source:'ESPN NBA injuries and NBA scoreboard',error:errors.join(' | ')||null};
 if(inj.status==='fulfilled'||odds.status==='fulfilled')cache.set(day,{at:Date.now(),value});
 return value;
}
