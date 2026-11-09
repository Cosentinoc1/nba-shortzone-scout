#!/usr/bin/env node
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {summaries,pretipCandidates,gradePick,extractESPNPlayers,matchPlayer,dateInChicago} from './review-lib.mjs';
const HISTORY = new URL('../public/review/history.json', import.meta.url);
const SITE=process.env.NBA_SCOUT_URL||'https://nba-shotzone-scout.onrender.com';
const cmd=process.argv[2]||'capture';
const target=process.argv.find(x=>/^\d{4}-\d{2}-\d{2}$/.test(x))||dateInChicago(new Date(Date.now()-(cmd==='grade'?86400000:0)));
const now=new Date();
async function fetchJson(url){const r=await fetch(url,{headers:{'Accept':'application/json','Cache-Control':'no-cache'},signal:AbortSignal.timeout(25000)});if(!r.ok)throw Error(`${r.status}: ${url}`);return r.json();}
const history=JSON.parse(await readFile(HISTORY,'utf8'));
const byDate=()=>history.days.find(d=>d.date===target);
const setDay=day=>{const idx=history.days.findIndex(x=>x.date===target);if(idx>=0)history.days[idx]=day;else history.days.push(day);history.days.sort((a,b)=>b.date.localeCompare(a.date));history.updatedAt=new Date().toISOString();};
const save=async()=>{await mkdir(new URL('../public/review/',import.meta.url),{recursive:true});await writeFile(HISTORY,JSON.stringify(history,null,2)+'\n');};
async function capture(){
 const existing=byDate(); if(existing?.snapshot?.picks?.length){console.log('Existing frozen picks cannot be overwritten');return;}
 if(target!==dateInChicago(now)&&!process.env.ALLOW_HISTORICAL_CAPTURE)throw Error('Historical captures disabled: never backfill hindsight into a pregame snapshot');
 const api=await fetchJson(`${SITE}/api/picks?date=${target}`);
 const all=pretipCandidates(api,now);
 // Explicit refusal to freeze picks that don't belong to today's slate, or are too close to tipoff.
 const eligible=Number(api.qualified||0);const freshness=api.feed?.freshness;
 const sourceFresh=freshness?.status==='fresh'&&Number(freshness?.ageMinutes??Infinity)<=120;
 const directional=all.filter(p=>p.board!=='Bottom 10');
 const valid=sourceFresh&&directional.length>0;
 const status=valid?'frozen':eligible===0?'no_qualified':'not_frozen';
 const day={date:target,status,scoringVersion:api.scoringVersion||'unknown',message:valid?'Captured from live ranked API before each selected game began':eligible===0?'No qualified research candidates. The site correctly passed instead of forcing a Top 10.':sourceFresh?'Eligible directions were not all independently validated for a pre-tip capture':'No verified fresh pre-tip source; cannot freeze',
  source:{site:SITE,provider:api.feed?.source||null,observedAt:api.feed?.freshness?.observedAt||null,providerSidesVerified:api.feed?.directionsUnverified===false},
  snapshot:valid?{capturedAt:now.toISOString(),qualified:eligible,picks:all,gameCount:api.games?.length||0,pretipVerified:true}:null,
  ...(existing?.audit?{audit:existing.audit}:{})};
 // Do not downgrade an existing audited/frozen day due to a later missing feed.
 if(existing?.status==='audited'||existing?.snapshot?.picks?.length)return;
 setDay(day);await save();console.log(`${target}: ${status}, ${all.length} frozen`);
}
async function grade(){
 const day=byDate();if(!day?.snapshot?.picks?.length){console.log(`${target}: no frozen picks, grade skipped`);return;}
 if(day.status==='audited'){console.log('Already audited — preserving historical record');return;}
 const scoreboard=await fetchJson(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${target.replaceAll('-','')}`);
 const events=scoreboard.events||[];if(!events.length){console.log('No official NBA events');return;}
 const teamEvents=new Map();
 for(const e of events){const teams=(e.competitions?.[0]?.competitors||[]).map(x=>x.team?.abbreviation);for(const t of teams)teamEvents.set(String(t).toUpperCase(),e)}
 const needed=[...new Set(day.snapshot.picks.map(p=>teamEvents.get(p.team)?.id).filter(Boolean))];
 const summariesByEvent=new Map();
 let allFinal=true;
 for(const id of needed){const e=events.find(x=>String(x.id)===String(id));if(!e?.status?.type?.completed){allFinal=false;continue;}const stats=await fetchJson(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${id}`);summariesByEvent.set(String(id),extractESPNPlayers(stats));}
 const picks=day.snapshot.picks.map(p=>{
  const event=teamEvents.get(p.team);const id=String(event?.id||'');const teams=(event?.competitions?.[0]?.competitors||[]).map(x=>String(x.team?.abbreviation).toUpperCase());
  if(!event||!teams.includes(p.opponent))return {...p,result:'UNVERIFIED',actual:null,notes:'Team/opponent official game not verified'};
  if(!event.status?.type?.completed)return {...p,result:'PENDING',actual:null,notes:'Game not officially final'};
  const athletes=summariesByEvent.get(id)||[];let player=matchPlayer(p,athletes);
  if(!player){const zero=athletes.filter(x=>x.team===p.team); // A player absent from box score is not automatically a DNP; do not assume.
   return {...p,result:'UNVERIFIED',actual:null,notes:zero.length?'Player not uniquely found in official box score':'Official player stats missing'};
  }
  return gradePick(p,player);
 });
 const unresolved=picks.some(p=>['PENDING','UNVERIFIED'].includes(p.result));
 day.audit={gradedAt:now.toISOString(),source:'ESPN official final box scores',picks,summary:summaries(picks),allGamesFinal:allFinal};
 day.status=unresolved?'partial':'audited';day.message=unresolved?'Partial audit: unresolved rows excluded from hit-rate calculations':'Official final box-score audit complete';
 setDay(day);await save();console.log(`${target}: ${day.status} — ${day.audit.summary.recommended.wins}/${day.audit.summary.recommended.graded} directional wins`);
}
if(cmd==='capture')await capture();else if(cmd==='grade')await grade();else throw Error('Use capture or grade');
