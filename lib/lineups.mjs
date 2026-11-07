/** Optional licensed starting-lineup adapter. No RotoWire scraping or credential sharing.
 * RotoWire expressly restricts automated collection without written permission.
 */
import {keyName} from './model.mjs';
const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9 ]/g,' ').replace(/\s+/g,' ').trim().toLowerCase();
export function lookupLineup(teamLineup,roster,playerName){
 if(!teamLineup?.players?.length)return null;
 const playerNorm=normalize(playerName),last=playerNorm.split(' ').at(-1),matches=[];
 for(const p of teamLineup.players){
  const name=normalize(p.name),parts=name.split(' ');
  if(name===playerNorm|| (parts.at(-1)===last && (parts[0]===playerNorm.split(' ')[0]||parts[0]?.[0]===playerNorm[0])))matches.push(p);
 }
 if(matches.length!==1)return null;
 return {...matches[0],lineupStatus:teamLineup.status};
}
/** Validate a provider's documented licensed JSON schema, not generic webpage HTML. */
export function parseLicensedLineups(payload,day,teams=[]){
 if(payload?.date!==day||!payload.teams||typeof payload.teams!=='object')return {};
 const allowed=new Set(teams),result={};
 for(const [team,entry] of Object.entries(payload.teams)){
  if(!allowed.has(team)||!['expected','confirmed'].includes(entry?.status)||!Array.isArray(entry.players))continue;
  const players=entry.players.filter(p=>p&&typeof p.name==='string'&&['PG','SG','SF','PF','C'].includes(p.pos)).slice(0,5);
  if(players.length!==5||new Set(players.map(p=>p.pos)).size!==5)continue;
  result[team]={status:entry.status,players:players.map(p=>({name:p.name.slice(0,95),pos:p.pos,tag:null})),team};
 }
 return result;
}
let cache={id:'',at:0,result:null};
export async function licensedLineupsForDay(day,teams=[],fetcher=fetch,now=Date.now()){
 const url=process.env.LICENSED_LINEUPS_URL?.trim();
 if(!url)return {available:false,source:'No licensed lineup provider configured',updatedAt:null,lineups:{},error:'RotoWire website scraping is not authorized. See external lineup link or connect a licensed lineup JSON feed.'};
 try{
  const parsed=new URL(url);if(parsed.protocol!=='https:'||parsed.username||parsed.password)throw Error('Lineup provider URL must be HTTPS without credentials embedded in the URL');
  const id=day+'|'+url;
  if(cache.id===id&&now-cache.at<5*60000)return cache.result;
  const ac=new AbortController(),timer=setTimeout(()=>ac.abort(),6500);
  try{
   const headers={Accept:'application/json'};if(process.env.LICENSED_LINEUPS_API_KEY)headers['Authorization']='Bearer '+process.env.LICENSED_LINEUPS_API_KEY;
   const response=await fetcher(url,{signal:ac.signal,headers});if(!response.ok)throw Error(`Licensed lineup provider HTTP ${response.status}`);
   const body=await response.text();if(body.length>240000)throw Error('Lineup JSON exceeds maximum permitted size');
   const lineups=parseLicensedLineups(JSON.parse(body),day,teams);
   if(!Object.keys(lineups).length)throw Error('Provider returned no verified lineups for this date');
   const result={available:true,source:'User-configured licensed lineup provider',lineups,updatedAt:new Date(now).toISOString(),error:null};
   cache={id,at:now,result};return result;
  }finally{clearTimeout(timer)}
 }catch(e){const result={available:false,source:'Licensed lineup provider unavailable',lineups:{},updatedAt:null,error:e.message};cache={id:day+'|'+url,at:now,result};return result}
}
