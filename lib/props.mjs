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
 '3 pointers made':'3PM','3-pointers made':'3PM','3pm':'3PM','3 pointers':'3PM',
 'points rebounds assists':'PRA','pts rebs asts':'PRA','pts reb ast':'PRA',
 'pts+rebs+asts':'PRA','pts+reb+ast':'PRA','pra':'PRA',
 'rebounds assists':'RA','rebs asts':'RA','rebs+asts':'RA','ra':'RA',
 'points assists':'PA','pts asts':'PA','pts+asts':'PA','pa':'PA',
 'points rebounds':'PR','pts rebs':'PR','pts+rebs':'PR','pr':'PR',
 'field goal attempts':'FGA','field-goal attempts':'FGA','fg attempts':'FGA','fga':'FGA',
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
/** Compare a single offered prop with strictly pre-slate boxscore history and descriptive shot zones. */
export function evaluateProp({prop,side,gameCache,rosters,players,defense,day}){
 const roster=rosters[prop.team]||[];
 const who=roster.find(x=>normalizedKey(x.name)===normalizedKey(prop.player));if(!who)return null;
 const opponent=prop.opponent;
 const targetDef=defense.teams.find(x=>x.code===opponent);
 if(!targetDef)return null;
 const hist=researchPlayer({gameCache,offense:prop.team,defense:opponent,playerId:String(who.id),playerName:who.name,stat:prop.stat,side,line:prop.line,day});
 const samples=hist.recent.map(x=>x.stat).filter(Number.isFinite);
 const varSd=sd(samples);
 const p=players.find(x=>x.team===prop.team&&normalizedKey(x.name)===normalizedKey(prop.player));
 const chicagoDate=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const zone=(day>=chicagoDate&&p&&['PTS','3PM','2PM','FGA','3PA'].includes(prop.stat))?matchupGrade(p,targetDef,defense.league):null;
 const hit=hist.hitRates?.last10,season=hist.hitRates?.season;
 const gap=hist.directionalMargin;
 const isLower=side==='LESS';
 const hard=[];const checks=[];const reasons=[];
 const lineAge=Date.parse(prop.observedAt||'');
 if(Number.isFinite(lineAge)&&Date.now()-lineAge>360*60000)hard.push('This exact prop line was observed over 6 hours ago');
 if(!Number.isFinite(lineAge))checks.push('Line observation timestamp unverified');
 const l5=hist.opportunity?.minutesL5,l10=hist.opportunity?.minutesL10;
 if(hist.boxscoreGames<5)hard.push('Fewer than 5 completed games with usable stats');
 if(!hist.projectedBaseline&&hist.projectedBaseline!==0)hard.push('Insufficient statistical baseline');
 if(l5!=null&&l5<18)hard.push('Low recent minutes');
 if(isLower&&(['PTS','REB','AST'].includes(prop.stat))&&prop.line<=({PTS:10,REB:3.5,AST:2.5}[prop.stat]))hard.push('Low lower line can be fragile when role changes');
 const minutesDiff=(l5!=null&&l10!=null&&l10>0)?l5/l10-1:null;
 if(minutesDiff!==null&&minutesDiff<-.15)checks.push('Minutes declining versus last 10');
 if(l5===null)checks.push('Recent minutes unavailable');
 checks.push('Lineup, injury and minutes projection unverified');
 if(['REB','PR','RA','PRA'].includes(prop.stat))checks.push('Rebound chances and lineup size unverified');
 if(['AST','PA','RA','PRA'].includes(prop.stat))checks.push('Potential assists / creation role unverified');
 if(zone?.eligible&&zone.score!==null)reasons.push(`Shot-zone matchup ${zone.score.toFixed(0)}/100 (${zone.grade}); not a scoring projection`);
 const p50=hist.projectedBaseline;
 const normalizedGap=gap==null?0:clamp(gap/Math.max(2,varSd||2,prop.line*.12),-1.6,1.6);
 const recentHit=hit?.sample>=5?hit.win/(hit.sample-hit.push||1):null;
 const historical=recentHit===null?0:clamp((recentHit-.5)*45,-21,21);
 let score=50+normalizedGap*16+historical;
 if(zone?.eligible&&['PTS','3PM','2PM','FGA','3PA'].includes(prop.stat))score+=(isLower?-1:1)*(zone.score-50)*.26;
 const attempts=hist.opportunity;
 if(['PTS','2PM','FGA'].includes(prop.stat)&&attempts.fgaL5!=null&&attempts.fgaL10!=null&&attempts.fgaL10>0){
   const diff=attempts.fgaL5/attempts.fgaL10-1;
   score+=(isLower?-1:1)*clamp(diff*30,-7,7);
   reasons.push(`Last 5: ${attempts.fgaL5} FGA/game vs ${attempts.fgaL10} last 10`);
 }
 if(['3PM','3PA'].includes(prop.stat)&&attempts.tpaL5!=null)reasons.push(`Last 5: ${attempts.tpaL5} three-point attempts/game`);
 if(l5!=null)reasons.push(`Last 5: ${l5} minutes/game`);
 if(minutesDiff!==null)score+=clamp((isLower?-1:1)*minutesDiff*15,-5,5);
 if(hit?.sample>=5)reasons.push(`Last ${hit.sample}: ${hit.win} true wins, ${hit.push} pushes, ${hit.loss} losses at this line`);
 if(gap!=null)reasons.unshift(`${side==='MORE'?'Over':'Under'} baseline margin ${gap>=0?'+':''}${gap}`);
 if(hist.h2hGames>0)checks.push(`Only ${hist.h2hGames} same-season H2H game(s); do not overweight`);
 if(prop.stat==='PRA'||prop.stat==='RA'||prop.stat==='PA'||prop.stat==='PR')checks.push('Combined stat components can offset each other');
 if(gap!==null&&gap<=0)checks.push('Historical baseline does not favor this side');
 score=round(clamp(score,0,100),0);
 return {...prop,side,playerId:String(who.id),score,projected:hist.projectedBaseline,margin:gap,hit10:hit?.sample?hit:null,hitSeason:season?.sample?season:null,minutes:l5,zoneScore:zone?.eligible?zone.score:null,reasons,hard,checks,
  state:hard.length?'PASS':'RESEARCH ONLY',// Never declare verified/final with no current injury and opportunity feed.
  methodology:'Heuristic research ranking based on last-5/season box-score baseline, line clearance, recent attempts and optional shot-zone alignment. Uncalibrated score; not a probability or value-bet estimate.'};
}
export function rankBoard({rows,schedule,day,gameCache,rosters,players,defense,now=Date.now(),limit=6}){
 const normalized=normalizeRows(rows);
 const games=(schedule||[]).filter(g=>!g.completed);
 const oppByTeam=new Map();for(const g of games){oppByTeam.set(g.away,g.home);oppByTeam.set(g.home,g.away)}
 const candidates=[],skips={outOfSlate:0,unsupported:0,unmatched:0};
 for(const p of normalized){
  const opp=oppByTeam.get(p.team);if(!opp||(p.opponent&&opp!==p.opponent)){skips.outOfSlate++;continue}
  const r={...p,opponent:opp};
  if(p.startsAt&&Date.parse(p.startsAt)<now-120000){skips.outOfSlate++;continue}
  for(const side of p.sides){
    const record=evaluateProp({prop:r,side,gameCache,rosters,players,defense,day});
    if(record)candidates.push(record);else skips.unmatched++;
  }
 }
 candidates.sort((a,b)=>Number(a.state==='PASS')-Number(b.state==='PASS')||b.score-a.score||String(a.player).localeCompare(String(b.player)));
 const fresh=freshness(normalized,now),picked=[],used=new Set();
 for(const c of candidates){if(c.state==='PASS'||used.has(normalizedKey(c.player)))continue;used.add(normalizedKey(c.player));picked.push(c);if(picked.length>=limit)break}
 return {date:day,boardCount:normalized.length,matched:candidates.length,candidates:picked,all:candidates.slice(0,200),freshness:fresh,skips,scoringVersion:'1.5-screening',warning:'Ranking is research-only; injury, projected minutes, DvP, sportsbook price and real payout edge are not automatically verified. No candidate is final.'};
}
