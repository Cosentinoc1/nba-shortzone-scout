import http from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync, createReadStream } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { aggregateGames, parseESPNGame, matchupGrade, rankMatchups, normalizeTeam, keyName, localDate, ZONES, totalShots } from './lib/model.mjs';
import {scoreboardGames,validSlateDay} from './lib/schedule.mjs';
import {zoneForecast} from './lib/projection.mjs';
import {auditDay} from './lib/audit.mjs';
import {priorGamesOnly,rankGameZoneOpportunities} from './lib/zone-opportunities.mjs';
import {enrichBoardQuickReads} from './lib/quick-pick-explainer.mjs';
import {buildFeaturedPicks} from './lib/featured-picks-v316.mjs';
import {buildOffenseContext} from './lib/offense-context-v316.mjs';
import {checkDataQuality} from './lib/data-quality-v312.mjs';
import {observePlatformLines} from './lib/line-movement-v312.mjs';
import {researchPlayer,STATS} from './lib/research.mjs';
import {auditPlayerHistory} from './lib/history-integrity-v318.mjs';
import {parseHistoryBoxScore} from './lib/espn-history-v315.mjs';
import {normalizeRows,parseCsv,rankBoard} from './lib/props.mjs';
import {loadPropsFeed,feedStatusOnly} from './lib/propFeed.mjs';
import {buildPropInsight} from './lib/insight.mjs';
import {externalContextForDay} from './lib/context.mjs';
import {applyVerification} from './lib/decision.mjs';
import {applyRotoProjections, normalizeRotoProjections} from './lib/rotowire.mjs';
const ROOT=path.dirname(fileURLToPath(import.meta.url));
const snapshotDefense=JSON.parse(await readFile(path.join(ROOT,'data/defense.json'),'utf8'));
const snapshotPlayers=JSON.parse(await readFile(path.join(ROOT,'data/players.json'),'utf8'));
const rosters=JSON.parse(await readFile(path.join(ROOT,'data/rosters.json'),'utf8'));
const BASE='https://site.api.espn.com/apis/site/v2/sports/basketball/nba';
const START='2026-10-20T00:00:00Z';
const CACHE=process.env.CACHE_FILE||path.join(ROOT,'data/cache.json');
const REFRESH_MS=Math.max(1,Number(process.env.AUTO_REFRESH_HOURS)||12)*3600000;
const PORT=Number(process.env.PORT)||3000;
let defense=snapshotDefense,players=snapshotPlayers,source='NBA official snapshot (2026-11-05)',dataAsOf='2026-11-05',schedule=[],scheduleDate=null,scheduleError=null;
let gameCache={},profileCache={},dailySnapshots={},busy=false,refreshStage='',error=null,refreshLast=null,startedAt=new Date().toISOString(),lastAttempt=0,refreshStats={completedGames:0,usableGames:0,rejectedGames:0,unreconciledFga:0,unknownShots:0};
let rosterNum=Object.values(rosters).reduce((n,x)=>n+x.length,0);
const monthCache=new Map(),slateCache=new Map(),lookups=new Set(),historyLookups=new Map();
try{
 if(existsSync(CACHE)){const d=JSON.parse(await readFile(CACHE,'utf8'));gameCache=d.gameCache||{};profileCache=d.profileCache||{};dailySnapshots=d.dailySnapshots||{};
 if(d.defense?.teams?.length===30&&d.players?.length>250&&String(d.source||'').startsWith('ESPN')){
   defense=d.defense;players=d.players;dataAsOf=d.dataAsOf||dataAsOf;source=d.source;refreshStats=d.refreshStats||refreshStats;refreshLast=d.refreshLast||null;
 }
 }
}catch(e){console.warn('Cache not loaded:',e.message)}
const rosterFor=(code,id)=>rosters[code]?.find(p=>String(p.id)===String(id));
const profileKey=(code,id)=>`${code}:${id}`;
function latestProfile(saved,base){
 if(!saved)return base||null;if(!base)return saved;
 // Compare both date and actual covered-game count; a partial on-demand
 // lookup must never overwrite a newer, more complete league rebuild.
 const savedDate=Date.parse(saved.asof||'1970-01-01'),baseDate=Date.parse(base.asof||dataAsOf||'1970-01-01');
 const sg=Number(saved.gamesCovered)||0,bg=Number(base.gamesCovered)||0;
 if(baseDate>savedDate&&bg>=sg)return base;
 if(savedDate>baseDate&&sg>=bg)return saved;
 return (bg>=sg?base:saved);
}
function profileFor(code,id){const r=rosterFor(code,id);if(!r)return null;
 const base=players.find(x=>x.team===code&&(String(x.id)===String(id)||keyName(x.name)===keyName(r.name)));
 const p=latestProfile(profileCache[profileKey(code,id)],base);
 return p?{...p,id:String(id),pos:p.pos||r.pos,name:r.name,team:code,source:p.source||source,asof:p.asof||dataAsOf}:null;
}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function fetchJson(url, timeout=13000, attempts=2){let last;
 for(let i=0;i<attempts;i++){const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),timeout);
  try{const res=await fetch(url,{signal:ctrl.signal,headers:{'Accept':'application/json','User-Agent':'NBA-Zone-Scout/1.0 (+research-dashboard)'}});
   if(!res.ok)throw new Error(`ESPN HTTP ${res.status}`);const body=await res.json();return body;
  }catch(e){last=e;if(i+1<attempts)await sleep(600*(i+1))}finally{clearTimeout(timer)}
 }
 throw new Error(`${url.split('?')[0]}: ${last?.message||'Unknown error'}`);
}
function monthsThroughNow(){let end=localDate().replaceAll('-','').slice(0,6),y=2026,m=10,out=[];for(let k=0;k<18;k++){let s=String(y)+String(m).padStart(2,'0');if(s>end)break;out.push(s);m++;if(m===13){m=1;y++}}return out}
async function seasonEvents(){let events=[];
 for(const mo of monthsThroughNow()){
  const cache=monthCache.get(mo);const ttl=mo===localDate().replaceAll('-','').slice(0,6)?900000:86400000;
  let obj;if(cache&&Date.now()-cache.time<ttl)obj=cache.data;
  else {obj=await fetchJson(`${BASE}/scoreboard?dates=${mo}&limit=500`,18000);monthCache.set(mo,{data:obj,time:Date.now()})}
  events.push(...(obj.events||[]).filter(e=>e.season?.type===2&&e.status?.type?.completed===true&&Date.parse(e.date)>=Date.parse(START)));
 }
 return [...new Map(events.map(e=>[String(e.id),e])).values()].sort((a,b)=>a.date.localeCompare(b.date));
}
async function getSchedule(force=false,day=localDate()){
 if(!validSlateDay(day))throw new Error('Choose a valid 2026–27 regular-season date');
 const cached=slateCache.get(day),ttl=day===localDate()?120000:1200000;
 if(!force&&cached&&Date.now()-cached.time<ttl)return cached.games;
 const val=await fetchJson(`${BASE}/scoreboard?dates=${day.replaceAll('-','')}&limit=50`,12000);
 const matches=scoreboardGames(val.events,rosters);
 slateCache.set(day,{games:matches,time:Date.now()});
 if(day===localDate()&&matches.length&&matches.every(g=>g.state==='pre'&&Date.parse(g.tipoff)>Date.now())&&!dailySnapshots[day]&&dataAsOf<day){
  const board=rankMatchups({players,defense,matchups:matches,scope:'today',rosters});
  dailySnapshots[day]={capturedAt:new Date().toISOString(),date:day,source,dataAsOf,top:board.top,worst:board.worst,eligible:board.eligiblePlayers,method:'Pregame original v1.2 matchup scores only; injuries and minutes unverified'};
  saveCache().catch(e=>console.warn('Snapshot save:',e.message));
 }
 if(day===localDate()){schedule=matches;scheduleDate=day;scheduleError=null}
 return matches;
}
async function saveCache(){try{await mkdir(path.dirname(CACHE),{recursive:true});await writeFile(CACHE,JSON.stringify({gameCache,profileCache,dailySnapshots,defense,players,dataAsOf,source,refreshStats,refreshLast}),'utf8')}catch(e){console.warn('Cache write failed:',e.message)}}
async function fetchGames(events,progress){const todo=events.filter(e=>gameCache[String(e.id)]?.schemaVersion!==2);let i=0,completed=0,failed=[];
 await Promise.all(Array.from({length:Math.min(4,todo.length)},async()=>{
   while(i<todo.length){const ev=todo[i++];try{const response=await fetchJson(`${BASE}/summary?event=${encodeURIComponent(ev.id)}`,14000);gameCache[String(ev.id)]=parseESPNGame(ev,response)}catch(e){failed.push(`${ev.id}: ${e.message}`)}
   completed++;if(progress)progress(completed,todo.length);
   }
 }));await saveCache();return {failed,requested:todo.length};
}
/** Lightweight historical refresh for player reports. In contrast to the background
 * whole-league shot-zone rebuild, this fetches only the team's latest completed
 * games strictly BEFORE the requested Chicago-local slate date. Box-only games
 * cannot enter shot-zone analytics (schemaVersion 1 vs validated 2).
 */
async function ensureTeamHistory(team,day){
 const key=team+'|'+day;
 if(historyLookups.has(key))return historyLookups.get(key);
 const promise=(async()=>{
  const format=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'});
  const completed=(await seasonEvents()).filter(ev=>
   format.format(new Date(ev.date))<day && (ev.competitions?.[0]?.competitors||[])
    .some(x=>normalizeTeam(x.team?.abbreviation)===team));
  const window=completed.slice(-32);
  let index=0,failures=[],boxOnly=0,validated=0;
  const missing=window.filter(ev=>!Array.isArray(gameCache[String(ev.id)]?.players));
  await Promise.all(Array.from({length:Math.min(4,missing.length)},async()=>{
   while(index<missing.length){
    const ev=missing[index++];
    try{
     const response=await fetchJson(`${BASE}/summary?event=${encodeURIComponent(ev.id)}`,14000);
     try{gameCache[String(ev.id)]=parseESPNGame(ev,response);validated++}
     catch(err){gameCache[String(ev.id)]=parseHistoryBoxScore(ev,response);boxOnly++}
    }catch(err){failures.push(`${ev.id}: ${err.message}`)}
   }
  }));
  if(missing.length!==failures.length)await saveCache();
  return {status:failures.length?'partial':'loaded',team,day,available:window.filter(ev=>Array.isArray(gameCache[String(ev.id)]?.players)).length,
   completedGamesInWindow:window.length,requested:missing.length,validated,boxOnly,failed:failures.length,
   warning:failures.length?'Some ESPN game summaries could not be loaded. The played-game list may be incomplete.':null,
   source:'ESPN final box scores, games strictly before selected slate; non-shot-zone fallback labeled'};
 })();
 historyLookups.set(key,promise);
 try{return await promise}finally{historyLookups.delete(key)}
}

async function lookupPlayer(team,id){const k=profileKey(team,id),r=rosterFor(team,id);if(!r)throw new Error('Player not on selected roster');if(lookups.has(k))return;
 lookups.add(k);try{
  const events=(await seasonEvents()).filter(e=>(e.competitions?.[0]?.competitors||[]).some(c=>normalizeTeam(c.team?.abbreviation)===team));
  if(!events.length)throw new Error('No completed games found for selected team');
  const {failed}=await fetchGames(events);const available=events.filter(ev=>gameCache[String(ev.id)]?.schemaVersion===2);
  if(!available.length)throw new Error(`No game data available; ${failed.length} requests failed`);
  const zs=Object.fromEntries(ZONES.map(z=>[z,{fgm:0,fga:0}]));let gp=0,latest='';
  for(const ev of available){let game=gameCache[String(ev.id)];let p=game.players.find(p=>p.id===id&&(p.team===team))||game.players.find(p=>p.team===team&&keyName(p.name)===keyName(r.name));if(!p)continue;
    if(p.played||totalShots(p)>0)gp++;
    for(const z of ZONES){zs[z].fga+=p.zones[z]?.fga||0;zs[z].fgm+=p.zones[z]?.fgm||0}if(ev.date>latest)latest=ev.date;
  }
  const total=ZONES.reduce((n,z)=>n+zs[z].fga,0);if(!gp||!total)throw new Error('No recorded field-goal attempts for this player in downloaded games');
  const incomplete=available.length!==events.length;
  profileCache[k]={id,name:r.name,team,pos:r.pos||'',gp,zones:zs,source:incomplete?'ESPN coordinate estimate · PARTIAL games':'ESPN coordinate estimate',asof:latest.slice(0,10),gamesCovered:available.length,gamesExpected:events.length};
  error=null;await saveCache();
 }catch(e){error=`${r.name} lookup: ${e.message}`;console.warn(error)}finally{lookups.delete(k)}
}
async function fullRefresh(){if(busy)return;busy=true;lastAttempt=Date.now();error=null;refreshStage='Fetching regular-season schedule';
 try{const ev=await seasonEvents();if(ev.length<20)throw new Error(`Only ${ev.length} completed games found`);
   refreshStage=`Checking ${ev.length} completed games`;
   const {failed}=await fetchGames(ev,(done,total)=>{refreshStage=`Validating games ${done}/${total}`});
   const usable=ev.filter(e=>gameCache[String(e.id)]?.schemaVersion===2),coverage=usable.length/ev.length;
   // Promote a clearly labeled PARTIAL league sample only when there is strong
   // broad-season coverage; retain last verified snapshot otherwise.
   if(usable.length<60||coverage<0.85)throw new Error(`${usable.length}/${ev.length} games usable; requires ≥85% of schedule and ≥60 games. First failure: ${failed[0]||'unavailable'}`);
   const out=aggregateGames(usable.map(e=>gameCache[String(e.id)]));
   if(out.defense.teams.length!==30||new Set(out.players.map(x=>x.team)).size!==30)throw new Error('30-team integrity check failed');
   if(out.players.length<250)throw new Error(`Only ${out.players.length} players from completed games; refusing incomplete player update`);
   const idsByName=new Map(Object.entries(rosters).flatMap(([team,arr])=>arr.map(x=>[team+':'+keyName(x.name),x])));
   const estimatedSource=coverage===1?'ESPN coordinate estimates':'ESPN coordinate estimates · PARTIAL schedule';
   const replacement=out.players.map(p=>{const r=idsByName.get(p.team+':'+keyName(p.name));return {...p,id:r?.id||p.id,name:r?.name||p.name,pos:r?.pos||p.pos,source:estimatedSource,asof:out.asof?.slice(0,10),gamesCovered:usable.length,gamesExpected:ev.length}});
   // Make the update atomic. Any rejected game remains visible in quality status.
   players=replacement;defense=out.defense;source=estimatedSource;
   dataAsOf=out.asof?.slice(0,10)||localDate();refreshLast=new Date().toISOString();
   refreshStats={completedGames:ev.length,usableGames:usable.length,rejectedGames:ev.length-usable.length,unreconciledFga:usable.reduce((n,g)=>n+(Number(gameCache[g.id]?.unreconciledFga)||0),0),unknownShots:usable.reduce((n,g)=>n+(Number(gameCache[g.id]?.unknown)||0),0)};
   refreshStage=`Loaded ${players.length} players from ${usable.length}/${ev.length} games · ${Math.round(coverage*100)}% coverage`;
   error=failed.length?`${failed.length} games unavailable; results labeled as PARTIAL where applicable`:null;
   await saveCache();
 }catch(e){error=e.message;refreshStage='Retained validated snapshot';console.warn('Refresh:',e.message)}finally{busy=false}
}
function status(){const allProfiles=new Set(players.map(p=>p.team+':'+keyName(p.name)));for(const p of Object.values(profileCache))allProfiles.add(p.team+':'+keyName(p.name));const rosterProfileCount=Object.entries(rosters).reduce((n,[team,list])=>n+list.filter(r=>allProfiles.has(team+':'+keyName(r.name))).length,0);return {serving:true,version:'3.18.0',dataQuality:checkDataQuality({defense,players,rosters,asOf:dataAsOf,source}),researchCacheGames:Object.values(gameCache).filter(g=>g.schemaVersion===2).length,startedAt,date:localDate(),source,dataAsOf,playerProfiles:players.length,rosterProfiles:rosterProfileCount,profileCoveragePct:+(100*rosterProfileCount/rosterNum).toFixed(1),espnProfiles:Object.keys(profileCache).length,rosters:Object.keys(rosters).length,rosterPlayers:rosterNum,scheduleDate,scheduleGames:schedule.length,scheduleError,refresh:{active:busy,stage:refreshStage,lastSuccess:refreshLast,error,stats:refreshStats},onDemandLookups:lookups.size,officialZonesAreExact:!source.startsWith('ESPN')}}
function json(res,obj,statusCode=200){res.writeHead(statusCode,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(obj))}
function requireTeam(code){const t=normalizeTeam(code);return rosters[t]?t:null}
const quickZoneCache=new Map();
function zoneReportForPicks(day,slate){
 const prior=priorGamesOnly(gameCache,day);
 if(prior.length<20)return null;
 const latest=prior.at(-1)?.date||'',id=day+'|'+prior.length+'|'+latest;
 const cached=quickZoneCache.get(id);if(cached)return cached;
 const historical=aggregateGames(prior);
 const report=rankGameZoneOpportunities({day,games:slate,playerProfiles:historical.players,
    defense:historical.defense,historyGames:prior,rosters});
 if(quickZoneCache.size>8)quickZoneCache.clear();quickZoneCache.set(id,report);
 return report;
}
function quickExplain(board,ctx,slate,day){
 ctx.lineMovements=observePlatformLines(board.all||[],day);
 try {const enriched=enrichBoardQuickReads(board,{context:ctx,rosters,games:slate,
    zoneReport:zoneReportForPicks(day,slate),profiles:players,day,now:Date.now()});
    return {...enriched,featuredPicks:buildFeaturedPicks({...enriched,date:day},{now:Date.now(),offenseContext:buildOffenseContext(gameCache,day),gameCache}),
    sourcePulse:{newsFetched:Boolean(ctx.newsFetched),teamOddsFetched:Boolean(ctx.oddsFetched)},
    dataQuality:checkDataQuality({defense,players,rosters,asOf:dataAsOf,source})};}
 catch(e){console.warn('Quick-pick explanations unavailable:',e.message);return board;}
}
async function handler(req,res){
 const u=new URL(req.url,`http://${req.headers.host||'localhost'}`),pathname=u.pathname;
 try{
  if(pathname==='/api/health')return json(res,{ok:true,source,date:localDate()});
  if(pathname==='/api/status')return json(res,status());
  if(pathname==='/api/data-quality')return json(res,checkDataQuality({defense,players,rosters,asOf:dataAsOf,source}));
  if(pathname==='/api/bootstrap')return json(res,{defense,players,rosters,schedule,status:status()});
  if(pathname==='/api/zone-opportunities'&&req.method==='GET'){
   const day=u.searchParams.get('date')||localDate();
   if(!validSlateDay(day))return json(res,{error:'Select a valid 2026-27 NBA game date'},400);
   let slate;
   try{slate=await getSchedule(false,day)}catch(e){return json(res,{error:'NBA game schedule unavailable',detail:e.message},503)}
   // Strictly PRE-slate history, including a Chicago-local cutoff for late UTC starts.
   // This prevents same-day results from influencing the pregame ranking.
   const prior=priorGamesOnly(gameCache,day);
   if(prior.length<20)return json(res,{date:day,gameCount:slate.length,games:[],
      error:'Insufficient previous regular-season games for a reliable zone matchup ranking',
      historyCount:prior.length,source:'ESPN pregame box scores'},503);
   const hist=aggregateGames(prior);
   const result=rankGameZoneOpportunities({day,games:slate,playerProfiles:hist.players,
      defense:hist.defense,historyGames:prior,rosters});
   return json(res,{...result,historyCount:prior.length,modelVersion:'zone-fit-1.0',
      sourceDataAsOf:hist.asof||null});
  }
  if(pathname==='/api/props-feed'){
   const feed=await loadPropsFeed();return json(res,feedStatusOnly(feed));
  }
  if(pathname==='/api/lines'&&req.method==='GET'){
   const feed=await loadPropsFeed();
   return json(res,{...feedStatusOnly(feed),offers:(feed.offers||[]).slice(0,10000)});
  }
   
   if(pathname==='/api/insight'&&req.method==='GET'){
    const day=u.searchParams.get('date')||localDate();
    if(!validSlateDay(day))return json(res,{error:'Invalid NBA regular-season date'},400);
    const team=requireTeam(u.searchParams.get('team'));
    const name=String(u.searchParams.get('player')||'').trim().slice(0,120);
    const line=Number(u.searchParams.get('line'));
    const market=String(u.searchParams.get('market')||'').trim().slice(0,100);
    const tier=String(u.searchParams.get('tier')||'standard').slice(0,50);
    const observedAt=u.searchParams.get('observedAt')||null;
    const minutes=u.searchParams.has('expectedMinutes')?Number(u.searchParams.get('expectedMinutes')):null;
    if(!team||!name||!market||!u.searchParams.has('line')||!Number.isFinite(line)||line<0||line>250)
     return json(res,{error:'Valid team, player, stat and exact line are required'},400);
    if(minutes!==null&&(!Number.isFinite(minutes)||minutes<1||minutes>48))
     return json(res,{error:'Projected minutes must be between 1 and 48'},400);
    let games=[];try{games=await getSchedule(false,day)}catch{}
    const found=games.find(g=>g.away===team||g.home===team);
    const opponent=found?(found.home===team?found.away:found.home):null;
    let ctx={injuries:[],games:[],source:'ESPN data unavailable',error:'External context not yet available'};
    try{ctx=await externalContextForDay(day,Object.keys(rosters))}catch(e){ctx.error=String(e.message||e)}
    let historyFetch=null;
    if((rosters[team]||[]).some(p=>keyName(p.name)===keyName(name))) {
     try{historyFetch=await ensureTeamHistory(team,day)}catch(e){historyFetch={status:'unavailable',warning:e.message}};
    }
    const result=buildPropInsight({gameCache,rosters,players,defense,day,team,opponent,playerName:name,line,market,tier,observedAt,expectedMinutes:minutes,
     context:{...ctx,game:ctx.games?.find(g=>g.id===found?.id||(g.away===team||g.home===team))||null}});
    return json(res,{...result,historyFetch,historyAudit:result.supported?auditPlayerHistory({gameCache,team,playerName:name,stat:result.stat,day}):null});
   }

  if(pathname==='/api/picks'&&req.method==='GET'){
   const day=u.searchParams.get('date')||localDate();
   if(!validSlateDay(day))return json(res,{error:'Invalid NBA regular season date'},400);
   const feed=await loadPropsFeed();
   let slate=[];try{slate=await getSchedule(false,day)}catch(e){return json(res,{feed:feedStatusOnly(feed),error:'NBA schedule unavailable',details:e.message},503)}
   const preliminary=rankBoard({rows:feed.rows,schedule:slate,day,gameCache,rosters,players,defense});
   let ctx={injuries:[],games:[],injuriesFetched:false,lineupsFetched:false};
   try{ctx=await externalContextForDay(day,Object.keys(rosters))}catch(e){ctx.sourceError=String(e.message||e)}
   const result=applyVerification({board:{...preliminary,games:slate},context:ctx,gameCache,rosters,defense,day,limit:10});
   return json(res,{...quickExplain(result,ctx,slate,day),feed:feedStatusOnly(feed),games:slate,historyGames:Object.keys(gameCache).length});
  }
  if(pathname==='/api/picks/rotowire'&&req.method==='POST'){
   // Files are parsed client-side. Only compact user-entered projections are sent.
   // Never write subscription data to disk, logs or global process state.
   let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>210000)return json(res,{error:'RotoWire projection request exceeds 210 KB'},413)}
   let payload;try{payload=JSON.parse(raw)}catch{return json(res,{error:'Invalid projection JSON'},400)}
   const day=payload.date||localDate();if(!validSlateDay(day))return json(res,{error:'Invalid 2026–27 game date'},400);
   if(!Array.isArray(payload.rows)||payload.rows.length>500)return json(res,{error:'Upload at most 500 RotoWire rows'},400);
   let projected;try{projected=normalizeRotoProjections(payload.rows)}catch(e){return json(res,{error:e.message},400)}
   if(!projected.length)return json(res,{error:'No valid player projections. Check NAME, Team and MIN headers.'},400);
   const uploadedAt=typeof payload.uploadedAt==='string'&&Number.isFinite(Date.parse(payload.uploadedAt))?payload.uploadedAt:new Date().toISOString();
   const feed=await loadPropsFeed();
   let slate=[];try{slate=await getSchedule(false,day)}catch(e){return json(res,{error:'NBA schedule unavailable',details:e.message},503)}
   const base=rankBoard({rows:feed.rows,schedule:slate,day,gameCache,rosters,players,defense});
   let ctx={injuries:[],games:[],injuriesFetched:false,lineupsFetched:false};
   try{ctx=await externalContextForDay(day,Object.keys(rosters))}catch(e){ctx.sourceError=String(e.message||e)}
   const verified=applyVerification({board:{...base,games:slate},context:ctx,gameCache,rosters,defense,day,limit:10,positionOverrides:projected});
   const result=applyRotoProjections(verified,projected,day,{limit:10,uploadedAt});
   const enriched=quickExplain(result,ctx,slate,day);
   return json(res,{...enriched,rotowireStatus:{...enriched.rotowireStatus,uploadedRows:payload.rows.length,ignoredRows:payload.rows.length-projected.length},feed:feedStatusOnly(feed),games:slate,historyGames:Object.keys(gameCache).length});
  }
  if(pathname==='/api/picks/import'&&req.method==='POST'){
   // Untrusted user uploads only affect the current response. No server-side writes.
   let body='';for await(const chunk of req){body+=chunk;if(body.length>380000)return json(res,{error:'File is too large; upload up to 380 KB of NBA standard props'},413)}
   let input;try{input=JSON.parse(body)}catch{return json(res,{error:'Invalid JSON payload'},400)}
   const day=input.date||localDate();if(!validSlateDay(day))return json(res,{error:'Invalid NBA regular season date'},400);
   const supplied=typeof input.csv==='string'?parseCsv(input.csv):(Array.isArray(input.rows)?input.rows:[]);
   if(supplied.length>3000)return json(res,{error:'Maximum 3,000 prop rows per upload'},413);
   let slate=[];try{slate=await getSchedule(false,day)}catch(e){return json(res,{error:'NBA schedule unavailable',details:e.message},503)}
   const preliminary=rankBoard({rows:supplied,schedule:slate,day,gameCache,rosters,players,defense});
   let ctx={injuries:[],games:[],injuriesFetched:false,lineupsFetched:false};
   try{ctx=await externalContextForDay(day,Object.keys(rosters))}catch(e){ctx.sourceError=String(e.message||e)}
   const result=applyVerification({board:{...preliminary,games:slate},context:ctx,gameCache,rosters,defense,day,limit:10});
   return json(res,{...quickExplain(result,ctx,slate,day),feed:{configured:false,source:'Uploaded file · local browser session',count:result.boardCount,status:'uploaded'},games:slate,historyGames:Object.keys(gameCache).length});
  }
  if(pathname==='/api/research'){
   const offense=requireTeam(u.searchParams.get('offense')),opponent=requireTeam(u.searchParams.get('defense'));
   const id=u.searchParams.get('playerId'),stat=u.searchParams.get('stat')||'PTS',side=u.searchParams.get('side')||'MORE';
   const day=u.searchParams.get('date')||localDate();
   if(!offense||!opponent||offense===opponent||!id||!rosterFor(offense,id))return json(res,{error:'Choose a valid matchup and player'},400);
   if(!STATS[stat]||!['MORE','LESS'].includes(side)||!validSlateDay(day))return json(res,{error:'Unsupported stat, side or date'},400);
   let line=null,minutes=null;
   if(u.searchParams.has('line')){line=Number(u.searchParams.get('line'));if(!Number.isFinite(line)||line<0||line>300)return json(res,{error:'Invalid exact line'},400)}
   if(u.searchParams.has('expectedMinutes')){minutes=Number(u.searchParams.get('expectedMinutes'));if(!Number.isFinite(minutes)||minutes<1||minutes>48)return json(res,{error:'Invalid projected minutes'},400)}
   const roster=rosterFor(offense,id);
   let historyFetch=null;
   try{historyFetch=await ensureTeamHistory(offense,day)}catch(e){historyFetch={status:'unavailable',warning:e.message}};
   const result=researchPlayer({gameCache,offense,defense:opponent,playerId:id,playerName:roster.name,stat,side,line,expectedMinutes:minutes,day});
   return json(res,{...result,historyAudit:auditPlayerHistory({gameCache,team:offense,playerId:id,playerName:roster.name,stat,day}),dataAsOf,seasonSource:'ESPN box scores · last 10/20 pre-slate player appearances; loaded on demand',historyFetch,cacheGames:Object.values(gameCache).filter(g=>g.schemaVersion===2).length});
  }
  if(pathname==='/api/accuracy'){
   const day=u.searchParams.get('date')||new Date(Date.now()-86400000).toLocaleDateString('en-CA',{timeZone:'America/Chicago'});
   if(!validSlateDay(day))return json(res,{error:'Choose a 2026–27 regular-season day'},400);
   return json(res,auditDay(gameCache,day,dailySnapshots[day]||null));
  }
  if(pathname==='/api/snapshots'){
   return json(res,{days:Object.keys(dailySnapshots).sort().reverse(),snapshots:Object.values(dailySnapshots).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,40)});
  }
  if(pathname==='/api/schedule'){
   const day=u.searchParams.get('date')||localDate();
   if(!validSlateDay(day))return json(res,{error:'Date must be within the 2026–27 NBA regular season'},400);
   try{const games=await getSchedule(Boolean(u.searchParams.get('fresh')),day);
    return json(res,{schedule:games,date:day,source:'ESPN scoreboard',count:games.length});
   }catch(e){if(day===localDate())scheduleError=e.message;
    const cached=slateCache.get(day);
    if(cached)return json(res,{schedule:cached.games,date:day,source:'ESPN cached scoreboard',warning:e.message,cached:true});
    return json(res,{schedule:[],error:e.message,date:day,cached:false},503);
   }
  }
  if(pathname==='/api/matchup'){
   let team=requireTeam(u.searchParams.get('defense')),offense=requireTeam(u.searchParams.get('offense')),id=u.searchParams.get('playerId');
   if(!team||!offense||team===offense||!id)return json(res,{error:'Select two distinct valid teams and a player ID'},400);
   const profile=profileFor(offense,id),def=defense.teams.find(x=>x.code===team);if(!rosterFor(offense,id))return json(res,{error:'Player not on offense roster'},404);
   if(!profile)return json(res,{profile:null,grade:null,state:lookups.has(profileKey(offense,id))?'loading':'unavailable',source:status()});
   const recent=Object.values(gameCache).filter(g=>g?.schemaVersion===2&&g.teams?.includes(offense)).sort((a,b)=>a.date.localeCompare(b.date)).map(g=>g.players?.find(x=>x.team===offense&&(String(x.id)===String(id)||keyName(x.name)===keyName(profile.name)))).filter(Boolean);
   const reqMinutes=u.searchParams.get('expectedMinutes'),min=reqMinutes===null?null:Number(reqMinutes);
   const expectedMinutes=Number.isFinite(min)&&min>=1&&min<=48?min:null;
   const roleVerified=u.searchParams.get('roleVerified')==='true';
   const forecast=zoneForecast({profile,defenseTeam:def,league:defense.league,recentGames:recent,expectedMinutes,roleVerified});
   return json(res,{profile,grade:matchupGrade(profile,def,defense.league),forecast,defense:def,league:defense.league,source:status()});
  }
  if(pathname==='/api/player'&&req.method==='POST'){
   let body='';for await(const c of req){body+=c;if(body.length>5000)return json(res,{error:'Payload too large'},413)}
   let a={};try{a=JSON.parse(body)}catch{return json(res,{error:'Invalid JSON'},400)};
   let t=requireTeam(a.team),id=String(a.id||'');if(!t||!rosterFor(t,id))return json(res,{error:'Unknown team/player'},400);
   const k=profileKey(t,id);const cached=profileFor(t,id);if(!lookups.has(k))lookupPlayer(t,id).catch(e=>console.warn(e.message));
   return json(res,{accepted:true,cached:Boolean(cached),loading:true,profile:cached});
  }
  if(pathname==='/api/rankings'){
   const scope=u.searchParams.get('scope')==='all'?'all':'today';
   const day=u.searchParams.get('date')||localDate();
   if(!validSlateDay(day))return json(res,{error:'Invalid NBA regular-season date'},400);
   let games=scope==='today'?((slateCache.get(day)||{}).games||[]):schedule;
   if(scope==='today'&&!slateCache.has(day)){
    try{games=await getSchedule(false,day)}catch(e){games=[]}
   }
   const enriched=[...players];
   for(const p of Object.values(profileCache)){const j=enriched.findIndex(x=>x.team===p.team&&keyName(x.name)===keyName(p.name));if(j>=0)enriched[j]=latestProfile(p,enriched[j]);else enriched.push(p)}
   const ranked=rankMatchups({players:enriched,defense,matchups:games,scope,rosters});
   return json(res,{...ranked,asof:dataAsOf,source,day,scheduleAvailable:scope!=='today'||slateCache.has(day),scheduleCount:games.length,coverage:{profiles:enriched.length,rosterPlayers:rosterNum,rosterProfiles:status().rosterProfiles,profileCoveragePct:status().profileCoveragePct}});
  }
  if(pathname==='/api/refresh'&&req.method==='POST'){
   if(busy)return json(res,{accepted:false,reason:'Refresh already running',status:status()},202);
   if(Date.now()-lastAttempt<600000)return json(res,{accepted:false,reason:'Refresh cooldown: 10 minutes',status:status()},429);
   fullRefresh().catch(e=>console.warn(e));return json(res,{accepted:true,status:status()},202);
  }
  if(req.method!=='GET')return json(res,{error:'Method not allowed'},405);
  const files={'/':'index.html','/index.html':'index.html','/clean.js':'clean.js','/rotowire-upload.js':'rotowire-upload.js','/insight-ui.js':'insight-ui.js','/defense-ui.mjs':'defense-ui.mjs','/clean.css':'clean.css','/classic':'classic.html','/classic.html':'classic.html','/app.js':'app.js','/styles.css':'styles.css','/review.html':'review.html','/review/review.js':'review/review.js','/review/review.css':'review/review.css','/review/history.json':'review/history.json','/defense-zones.mjs':'defense-zones.mjs','/defense-zones.css':'defense-zones.css','/quick-picks.css':'quick-picks.css','/featured-picks-v316.css':'featured-picks-v316.css','/featured-picks-v316.mjs':'featured-picks-v316.mjs','/simple-dashboard-v318.mjs':'simple-dashboard-v318.mjs','/simple-dashboard-v318.css':'simple-dashboard-v318.css','/roto-name-v318.mjs':'roto-name-v318.mjs','/zone-v311.css':'zone-v311.css','/zone-league-v311.mjs':'zone-league-v311.mjs','/correlation-v312.mjs':'correlation-v312.mjs'};
  const zoneAssets={'/zone-metrics.mjs':'zone-metrics.mjs','/zone-opportunity-ui.mjs':'zone-opportunity-ui.mjs'};
  const name=files[pathname]||zoneAssets[pathname];if(!name)return json(res,{error:'Not found'},404);
  const dest=path.join(ROOT,'public',name);if(!existsSync(dest))return json(res,{error:'Not found'},404);
  const type=name.endsWith('.html')?'text/html; charset=utf-8':name.endsWith('.css')?'text/css; charset=utf-8':name.endsWith('.json')?'application/json; charset=utf-8':'text/javascript; charset=utf-8';
  res.writeHead(200,{'Content-Type':type,'Cache-Control':name.endsWith('.html')?'no-cache':'public, max-age=300','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY'});createReadStream(dest).pipe(res);
 }catch(e){console.error('Server error',e);json(res,{error:'Server error',detail:e.message},500)}
}
const server=http.createServer(handler);server.listen(PORT,'0.0.0.0',()=>console.log(`NBA Shot Zone Scout on :${PORT}`));
getSchedule().catch(e=>{scheduleError=e.message;console.warn('Schedule:',e.message)});
setTimeout(()=>fullRefresh().catch(e=>console.warn('Initial ESPN rebuild:',e.message)),8000).unref();
setInterval(()=>{getSchedule(true).catch(e=>{scheduleError=e.message});fullRefresh().catch(e=>console.warn(e))},REFRESH_MS).unref();
