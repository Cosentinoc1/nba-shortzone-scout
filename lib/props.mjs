/**
 * Read-only standard NBA lines and explainable screening scores.
 * A research score is NOT a probability, edge, recommendation to bet, or verified injury check.
 */
import {keyName,matchupGrade,clamp} from './model.mjs';
import {researchPlayer} from './research.mjs';

const normalizedKey=x=>keyName(String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,''));
const stats={
 'points':'PTS','pts':'PTS','rebounds':'REB','rebs':'REB','reb':'REB',
 'assists':'AST','ast':'AST','asts':'AST','3 pt made':'3PM','3 ptm':'3PM',
 '3 pointers made':'3PM','3-pointers made':'3PM','3pm':'3PM','3 pointers':'3PM','3 points made':'3PM',
 'points rebounds assists':'PRA','pts rebs asts':'PRA','pts reb ast':'PRA',
 'pts+rebs+asts':'PRA','pts+reb+ast':'PRA','pra':'PRA',
 'rebounds assists':'RA','rebs asts':'RA','rebs+asts':'RA','ra':'RA',
 'points assists':'PA','pts asts':'PA','pts+asts':'PA','pa':'PA',
 'points rebounds':'PR','pts rebs':'PR','pts+rebs':'PR','pr':'PR',
 'field goal attempts':'FGA','field-goal attempts':'FGA','fg attempts':'FGA','fga':'FGA','fg attempted':'FGA',
 '3 point attempts':'3PA','3pt attempts':'3PA','3-point attempts':'3PA','3pa':'3PA',
 'free throws made':'FTM','ft made':'FTM','ftm':'FTM',
 '2 pt made':'2PM','2 pointers made':'2PM','2-pointers made':'2PM','2pm':'2PM'
};
const low=x=>String(x??'').trim().toLowerCase().replace(/[–—]/g,'-');
const key=x=>low(x).replace(/[^a-z0-9+]/g,' ').replace(/\s+/g,' ').trim();
export function statCode(input){const k=key(input);return stats[k]||stats[k.replace(/\s*\+\s*/g,' ')]||stats[k.replace(/\s/g,'')]||null;}
function val(obj,keys){for(const k of keys){const v=obj?.[k];if(v!==null&&v!==undefined&&String(v).trim()!=='')return v;}return null}
function teamCode(x){if(typeof x==='object'&&x!==null)x=x.abbreviation||x.code||x.team;return String(x||'').trim().toUpperCase();}
function str(x){return String(x??'').trim()}
function dateTime(x){const t=Date.parse(x||'');return Number.isFinite(t)?new Date(t).toISOString():null;}
function classifyTier(r){
 const tier=low(r.tier||r.line_kind||r.odds_type||'standard');
 if(/goblin|demon|discount|promo|alternate|alt line|special/.test(tier))return null;
 const selections=Array.isArray(r.selections)?r.selections:[];
 if(selections.length&&selections.every(s=>/goblin|demon/.test(low(s.tier||s.odds_type))))return null;
 return 'standard';
}
export function normalizeRows(rows){
 if(!Array.isArray(rows))return [];
 const out=[],seen=new Set();
 for(const raw of rows.slice(0,10000)){
  if(!raw||typeof raw!=='object'||!classifyTier(raw))continue;
  const player=raw.player?.name||raw.player_name||raw.playerName||raw.Player|| (typeof raw.player==='string'?raw.player:null);
  const team=teamCode(raw.player?.team||raw.team||raw.Team||raw.team_abbreviation);
  const opponent=teamCode(raw.event?.opponent||raw.opponent||raw.Opponent||raw.opponent_abbreviation);
  const period=low(raw.market?.period||raw.period||'full game');
  if(period&&!['full game','full','game','0'].includes(period))continue;
  const stat=statCode(raw.market?.stat||raw.stat||raw.Stat||raw.stat_type||raw.statType);
  const rawLine=val(raw,['line','Line','line_score','projection_line']);const line=rawLine===null?NaN:Number(rawLine);
  if(!str(player)||!stat||!Number.isFinite(line)||line<0||line>200||team.length!==3)continue;
  const sideValues=Array.isArray(raw.selections)&&raw.selections.length?raw.selections.filter(s=>!(/goblin|demon/.test(low(s.tier||s.odds_type||'')))).map(s=>s.side||s.direction||s.outcome||s.label).filter(Boolean).join(', '):null;
  const sides=low(sideValues||raw.Sides||raw.sides||raw.available_sides||'more, less');
  const allowedSides=(sides.includes('more')||sides.includes('over')?['MORE']:[]).concat(sides.includes('less')||sides.includes('under')?['LESS']:[]);
  if(!allowedSides.length)allowedSides.push('MORE','LESS');
  const observedAt=dateTime(val(raw,['observed_at','observedAt','Prop observed_at','Board observed_at','last_updated','source_updated_at']));
  const startsAt=dateTime(raw.event?.starts_at||raw.starts_at||raw.start_time);
  const id=raw.id||raw.projection_id||null;
  const k=[normalizedKey(player),team,stat,line].join('|');if(seen.has(k))continue;seen.add(k);
  out.push({id:id?String(id):null,player:str(player),team,opponent,stat,line,sides:allowedSides,observedAt,startsAt,tier:'standard'});
 }
 return out;
}
export function parseCsv(input){
 const text=String(input||'').replace(/^\uFEFF/,'');const rows=[];let field='',row=[],quote=false;
 for(let i=0;i<text.length;i++){
  const c=text[i];if(quote){if(c==='"'&&text[i+1]==='"'){field+='"';i++}else if(c==='"')quote=false;else field+=c;continue}
  if(c==='"'){quote=true;continue}if(c===','){row.push(field);field='';continue}
  if(c==='\n'){row.push(field.replace(/\r$/,''));if(row.some(x=>x.trim()))rows.push(row);row=[];field='';continue}field+=c;
 }
 if(quote)throw Error('Unclosed quoted CSV field');row.push(field.replace(/\r$/,''));if(row.some(x=>x.trim()))rows.push(row);
 if(!rows.length)return [];
 const header=rows[0].map(x=>x.trim());if(header.length<3)throw Error('Missing CSV headers');
 return rows.slice(1).map(row=>Object.fromEntries(header.map((h,i)=>[h,row[i]||''])));
}
export function freshness(rows,now=Date.now()){
 const dates=rows.map(x=>Date.parse(x.observedAt||'')).filter(Number.isFinite);
 if(!dates.length)return {status:'unverified',observedAt:null,ageMinutes:null};
 const newest=Math.max(...dates),ageMinutes=Math.max(0,Math.round((now-newest)/60000));
 return {status:ageMinutes<=120?'fresh':ageMinutes<=360?'aging':'stale',observedAt:new Date(newest).toISOString(),ageMinutes};
}
const round=(v,d=1)=>Number.isFinite(v)?+v.toFixed(d):null;
const sd=nums=>{if(nums.length<3)return null;let avg=nums.reduce((a,b)=>a+b,0)/nums.length;return Math.sqrt(nums.reduce((s,x)=>s+(x-avg)**2,0)/nums.length)};
const targetOpportunity={'PTS':'FGA','2PM':'FGA','FTM':'FTA','3PM':'3PA','3PA':'3PA','FGA':'FGA','REB':'REB','AST':'AST'};
/** Stronger explainable selection framework. A score is NOT a hit probability.
 * Evidence = line gap + shrinkage-adjusted clearance + on-court opportunity
 * + shot location (when valid) + confidence. Injury, lineup, real tracking
 * and sportsbook payout are hard external verification gates, never invented.
 */
const nowChicagoDate=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const safeRate=x=>x?.sample>=5 ? (x.win+2)/(x.sample-x.push+4) : null;
const requiredSample=5;
const shotProps=new Set(['PTS','3PM','2PM','FGA','3PA']);
const opportunityProps=new Set(['PTS','3PM','2PM','FGA','3PA','FTM']);
const confidenceGrade=(hist,minutesTrend,lineAge,now)=>{
 const n=hist.boxscoreGames||0;
 let c=n>=15?78:n>=10?65:n>=5?51:22;
 const l5=hist.opportunity?.minutesL5;
 if(l5!=null)c+=Math.min(9,Math.max(0,(l5-20)/2.5));
 if(minutesTrend!=null)c-=Math.min(12,Math.abs(minutesTrend)*40);
 if(!Number.isFinite(lineAge))c-=25;
 else if(now-lineAge>120*60000)c-=25;
 else if(now-lineAge>45*60000)c-=8;
 return round(clamp(c,0,100),0);
};
export function evaluateProp({prop,side,gameCache,rosters,players,defense,day,now=Date.now(),rosterIndex=null,playerIndex=null,defenseIndex=null,teamCache=null,currentDate=null}){
 const who=rosterIndex?.get(prop.team)?.get(normalizedKey(prop.player))
  ||(rosters[prop.team]||[]).find(x=>normalizedKey(x.name)===normalizedKey(prop.player));
 if(!who)return null;
 const opponent=prop.opponent;
 const targetDef=defenseIndex?.get(opponent)||defense.teams.find(x=>x.code===opponent);
 if(!targetDef)return null;
 const playerId=String(who.id);
 // Scanning only a team's previous games (not all 132+ season games) prevents
 // repeated O(props × games × players) work on the free Render instance.
 const hist=researchPlayer({gameCache:teamCache?.get(prop.team)||gameCache,offense:prop.team,defense:opponent,playerId,playerName:who.name,stat:prop.stat,side,line:prop.line,day});
 const samples=hist.recent.map(x=>x.stat).filter(Number.isFinite),varSd=sd(samples);
 const p=playerIndex?.get(prop.team)?.get(normalizedKey(prop.player))
  ||players.find(x=>x.team===prop.team&&normalizedKey(x.name)===normalizedKey(prop.player));
 const zone=(day>=(currentDate||nowChicagoDate())&&p&&shotProps.has(prop.stat))?matchupGrade(p,targetDef,defense.league):null;
 const recent=hist.hitRates?.last10,season=hist.hitRates?.season,h2h=hist.hitRates?.h2h;
 const gap=hist.directionalMargin,isLower=side==='LESS';
 const hard=[],checks=[],reasons=[];
 const lineAge=Date.parse(prop.observedAt||'');
 if(!Number.isFinite(lineAge))hard.push('Exact-line observation time unavailable');
 else if(now-lineAge>120*60000)hard.push('Exact prop line is over 2 hours old');
 else if(lineAge>now+300000)hard.push('Line observation clock is in the future');
 const l5=hist.opportunity?.minutesL5,l10=hist.opportunity?.minutesL10;
 const minutesTrend=l5!=null&&l10!=null&&l10>0?(l5/l10-1):null;
 if(hist.boxscoreGames<requiredSample)hard.push('Fewer than 5 complete pregame box scores');
 if(hist.projectedBaseline==null)hard.push('Insufficient baseline');
 if(l5!=null&&l5<18)hard.push('Low recent minutes: role is unstable');
 if(isLower&&['PTS','REB','AST'].includes(prop.stat)&&prop.line<=({PTS:10,REB:3.5,AST:2.5}[prop.stat]))hard.push('Fragile very-low LESS line');
 if(l5==null)checks.push('Recent playing time unavailable');
 if(minutesTrend!=null&&Math.abs(minutesTrend)>=.15)checks.push(`Recent minutes changed ${Math.round(minutesTrend*100)}% versus last 10`);
 if(!Number.isFinite(lineAge)||now-lineAge>45*60000)checks.push('Reconfirm the current line in PrizePicks');
 checks.push('Projected minutes and starting/injury status not independently verified');
 checks.push('Actual sportsbook payout, market move and projected outcome distribution not verified');
 if(['REB','PR','RA','PRA'].includes(prop.stat))checks.push('Rebound chances, opponent misses and lineup size unverified');
 if(['AST','PA','RA','PRA'].includes(prop.stat))checks.push('Potential assists, touches and creation role unverified');
 if(['PTS','PRA','PA','PR'].includes(prop.stat))checks.push('Shot volume, usage and teammate on/off role require confirmation');
 if(['3PM','3PA'].includes(prop.stat))checks.push('Three-point attempt volume and coverage require confirmation');
 if(['FTM'].includes(prop.stat))checks.push('Free throw attempts and foul rate require confirmation');
 checks.push('Opponent position-specific DvP, pace, travel, B2B and blowout context unverified');
 const sdValue=Math.max(prop.stat==='3PM'?.8:2,varSd||0,prop.line*.13);
 const gapZ=gap==null?0:clamp(gap/sdValue,-2,2);
 const baselineScore=round(clamp(50+gapZ*23,0,100),0);
 const lastHit=safeRate(recent),seasonHit=safeRate(season);
 const hitScore=round(clamp(50+(lastHit!=null?(lastHit-.5)*75:0)+(seasonHit!=null?(seasonHit-.5)*25:0),0,100),0);
 const spreadScore=varSd!=null?round(clamp(100-18*varSd/Math.max(1,prop.line*.35),5,95),0):45;
 const attempts=hist.opportunity||{};
 let opportunityScore=50,opportunityVerified=false;
 const compare=(l5,l10)=>{
  if(l5==null||l10==null||l10<=0)return null;
  const relative=clamp(l5/l10-1,-.5,.5);
  return round(clamp(50+(isLower?-1:1)*relative*75,5,95),0);
 };
 if(['PTS','2PM','FGA'].includes(prop.stat)){
  opportunityScore=compare(attempts.fgaL5,attempts.fgaL10)??50;
  opportunityVerified=attempts.fgaL5!=null&&attempts.fgaL10!=null;
  if(opportunityVerified)reasons.push(`${attempts.fgaL5} FGA/game in L5 vs ${attempts.fgaL10} in L10`);
 }else if(['3PM','3PA'].includes(prop.stat)){
  opportunityScore=compare(attempts.tpaL5,attempts.tpaL10)??50;
  opportunityVerified=attempts.tpaL5!=null&&attempts.tpaL10!=null;
  if(attempts.tpaL5!=null)reasons.push(`${attempts.tpaL5} three-point attempts/game in L5`);
 }else if(prop.stat==='FTM'){
  opportunityScore=compare(attempts.ftaL5,attempts.ftaL10)??50;
  opportunityVerified=attempts.ftaL5!=null&&attempts.ftaL10!=null;
  if(opportunityVerified)reasons.push(`${attempts.ftaL5} FTA/game in L5 vs ${attempts.ftaL10} in L10`);
 }else if(['AST','RA','PA','PRA','REB','PR'].includes(prop.stat)){
  // A box-score count is not a potential assist or rebound chance;
  // omit an ungrounded opportunity boost and show the missing signal.
  checks.push('Stat-specific upstream opportunity is not automatically measured');
 }
 if(minutesTrend!=null){opportunityScore=round(clamp(opportunityScore+(isLower?-1:1)*minutesTrend*25,0,100),0);reasons.push(`Minutes trend ${minutesTrend>=0?'+':''}${Math.round(minutesTrend*100)}% L5 vs L10`)}
 let matchupScore=50;
 if(zone?.eligible&&zone.score!=null){matchupScore=round(isLower?100-zone.score:zone.score,0);reasons.push(`Shot-zone alignment ${round(zone.score,0)}/100; descriptive only`)}
 if(h2h?.sample>=3){const h2hRate=safeRate(h2h);if(h2hRate!=null)reasons.push(`H2H this season: ${h2h.win} wins, ${h2h.push} pushes in ${h2h.sample} games (low weight)`)}
 else if(hist.h2hGames)checks.push(`Only ${hist.h2hGames} same-season H2H game(s)`);
 if(['PRA','RA','PA','PR'].includes(prop.stat))checks.push('Combined-stat components may counteract each other');
 if(gap!=null&&gap<=0)checks.push('Pregame baseline does not support this side');
 if(recent?.sample>=5)reasons.push(`L10: ${recent.win} true wins / ${recent.push} pushes / ${recent.loss} losses`);
 if(season?.sample>=5)reasons.push(`Season: ${season.win}/${season.sample} true wins (${season.push} pushes)`);
 if(l5!=null)reasons.push(`Last 5 minutes: ${l5}/game`);
 if(gap!=null)reasons.unshift(`${side==='MORE'?'MORE':'LESS'} historical baseline margin ${gap>=0?'+':''}${gap}`);
 const confidence=confidenceGrade(hist,minutesTrend,lineAge,now);
 // Uncalibrated 0-100 *research* score; no probabilistic or betting EV interpretation.
 const score=round(clamp(.38*baselineScore+.2*hitScore+.15*opportunityScore+.12*matchupScore+.1*confidence+.05*spreadScore,0,100),0);
 return {...prop,side,playerId,score,projected:hist.projectedBaseline,margin:gap,hit10:recent?.sample?recent:null,hitSeason:season?.sample?season:null,minutes:l5,zoneScore:zone?.eligible?zone.score:null,reasons,hard,checks,
  evidence:{baseline:baselineScore,hitHistory:hitScore,opportunity:opportunityScore,matchup:matchupScore,confidence,consistency:spreadScore,minutesTrend:minutesTrend==null?null:round(minutesTrend*100),last5Avg:hist.last5Mean,last10Avg:hist.last10Mean,seasonAvg:hist.seasonMean,h2hSample:hist.h2hGames,opportunityMeasured:opportunityVerified},
  state:hard.length?'PASS':'RESEARCH ONLY',methodology:'Evidence-weighted research score: baseline 38%, win/push history 20%, opportunity 15%, location matchup 12%, confidence 10%, consistency 5%. Not a calibrated probability. Injury, pace, DvP, minutes, payout, and role checks remain external.'};
}
const chooseUnique=(records,limit,requirePositive=true)=>{const result=[],used=new Set();for(const c of records){const k=normalizedKey(c.player);if(c.state==='PASS'||(requirePositive&&!(c.margin>0))||used.has(k))continue;result.push(c);used.add(k);if(result.length>=limit)break}return result};
export function rankBoard({rows,schedule,day,gameCache={},rosters={},players=[],defense={teams:[]},now=Date.now(),limit=6}){
 const normalized=normalizeRows(rows);
 const games=(schedule||[]).filter(g=>!g.completed);
 const oppByTeam=new Map();for(const g of games){oppByTeam.set(g.away,g.home);oppByTeam.set(g.home,g.away)}
 const rosterIndex=new Map();for(const [team,list] of Object.entries(rosters))rosterIndex.set(team,new Map(list.map(p=>[normalizedKey(p.name),p])));
 const playerIndex=new Map();for(const p of players){if(!playerIndex.has(p.team))playerIndex.set(p.team,new Map());playerIndex.get(p.team).set(normalizedKey(p.name),p)}
 const defenseIndex=new Map((defense.teams||[]).map(d=>[d.code,d]));
 const teamCache=new Map();for(const [id,g] of Object.entries(gameCache)){
  if(!g?.date||!Array.isArray(g.players)||!Array.isArray(g.teams))continue;
  for(const team of g.teams){if(!teamCache.has(team))teamCache.set(team,{});teamCache.get(team)[id]=g;}
 }
 const currentDate=nowChicagoDate(),candidates=[],skips={outOfSlate:0,unsupported:0,unmatched:0},seenPlayerStat=new Set();
 for(const p of normalized){
  const opp=oppByTeam.get(p.team);if(!opp||(p.opponent&&opp!==p.opponent)){skips.outOfSlate++;continue}
  const r={...p,opponent:opp};if(p.startsAt&&Date.parse(p.startsAt)<now-120000){skips.outOfSlate++;continue}
  for(const side of p.sides){
    const candidate=evaluateProp({prop:r,side,gameCache,rosters,players,defense,day,now,rosterIndex,playerIndex,defenseIndex,teamCache,currentDate});
    if(candidate)candidates.push(candidate);else skips.unmatched++;
  }
 }
 candidates.sort((a,b)=>Number(a.state==='PASS')-Number(b.state==='PASS')||b.score-a.score||String(a.player).localeCompare(String(b.player)));
 const topMore=chooseUnique(candidates.filter(x=>x.side==='MORE'),limit),topLess=chooseUnique(candidates.filter(x=>x.side==='LESS'),limit);
 const eligible=candidates.filter(x=>x.state!=='PASS');
 const unfavorable=chooseUnique([...eligible].filter(x=>x.zoneScore!=null&&shotProps.has(x.stat)).sort((a,b)=>a.zoneScore-b.zoneScore),limit,false)
   .map(x=>({...x,unfavorable:true}));
 const fresh=freshness(normalized,now);
 return {date:day,boardCount:normalized.length,matched:candidates.length,qualified:eligible.length,candidates:chooseUnique(candidates,limit),topMore,topLess,bottom6:topLess,unfavorable,
   // Keep the browser payload compact; all raw offered lines are considered during ranking.
   all:candidates.slice(0,64),allCount:candidates.length,freshness:fresh,skips,
   scoringVersion:'1.6-opportunity-confidence',warning:'The Top 6 MORE and Top 6 LESS are separately ranked research shortlists, NOT final picks or win probabilities. Unfavorable alignments are not automatically good LESS plays. Current injury, independent projected minutes, position DvP, sportsbook line and real payout EV must be checked.'};
}
