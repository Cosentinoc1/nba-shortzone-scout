/** RFPP 2.0 evidence overlay. No calibrated probabilities / independent payout data.
 * When a source is unavailable, its gate remains pending (never auto-passed).
 */
import {keyName,clamp} from './model.mjs';
import {buildDvpIndex,defenseMatchup} from './dvp.mjs';
import {lookupLineup} from './lineups.mjs';
import {backToBack} from './insight.mjs';
import {gradePropV2} from './grading-v2.mjs';
import {enhancedEvidence} from './edge-v4.mjs';
import {assessProp} from './decision-v25.mjs';
import {publishedMatchup} from './published-positions.mjs';
import {externalMatchup} from './public-dvp.mjs';
import {directionalEvidence} from './edge-v3.mjs';
const norm=x=>keyName(x||'');
const grade=s=>s>=82?'A':s>=70?'B':s>=58?'C':s>=45?'D':'F';
const round=x=>Number.isFinite(x)?Math.round(x):null;
const isInjuryVeto=s=>/^(out|doubtful|suspended|inactive)$/i.test(String(s||'').trim());
const isQuestionable=s=>/questionable|game.?time|day.to.day/i.test(String(s||''));
const scoringOpp=new Set(['PTS','3PM','3PA','FGA','2PM','FTM']);
function chooseUnique(rows,limit,{positive=false}={}){
 const seen=new Set(),out=[];
 for(const x of rows){if(x.state==='PASS'||positive&&!(x.margin>0))continue;
  const key=norm(x.player);if(seen.has(key))continue;seen.add(key);out.push(x);if(out.length>=limit)break;
 }return out;
}
function check(name,state,detail,source,updatedAt=null,url=null){return {name,state,detail,source,updatedAt,url};}
export function applyVerification({board,context={},gameCache={},rosters={},defense={},day,limit=10,positionOverrides=[]}){
 const dvp=buildDvpIndex(gameCache,rosters,day,{positionOverrides}),injuries=context.injuries||[];
 const games=new Map((board.games||[]).flatMap(g=>[[g.home,g],[g.away,g]]));
 const rows=(board.all||[]).map((r)=>{
  const injury=injuries.find(x=>x.team===r.team&&norm(x.player)===norm(r.player))||null;
  const age=injury?.updatedAt?Math.max(0,(Date.now()-Date.parse(injury.updatedAt))/3600000):null;
  const injuryCurrent=injury&&age!=null&&age<36;
  const injuryVeto=injuryCurrent&&isInjuryVeto(injury?.status);
  const injuryCaution=injuryCurrent&&isQuestionable(injury?.status);
  const lineup=lookupLineup(context.lineups?.[r.team],rosters[r.team],r.player);
  const game=games.get(r.team)||null;
  const rest=backToBack(gameCache,r.team,day);
  const suppliedPos=positionOverrides.find(x=>x.team===r.team&&norm(x.name)===norm(r.player))?.pos;
  const pos=suppliedPos||lineup?.pos||(rosters[r.team]||[]).find(x=>String(x.id)===String(r.playerId))?.pos||null;
  const publishedDvp=externalMatchup(context.publicDvp,{opponent:r.opponent,pos,stat:r.stat});
  const eligibilityDvp=publishedDvp?null:publishedMatchup(context.publicDvp,context.publicPositions,
   {team:r.team,player:r.player,opponent:r.opponent,stat:r.stat});
  const defenseGrade=publishedDvp||eligibilityDvp||defenseMatchup(dvp,{opponent:r.opponent,pos,stat:r.stat,zoneScore:r.zoneScore});
  const sideMatchup=defenseGrade.available?(r.side==='LESS'?defenseGrade.lessScore:defenseGrade.score):null;
  const roleLine=lineup?.lineupStatus==='confirmed'?'CONFIRMED STARTER':lineup?.lineupStatus==='expected'?'EXPECTED STARTER':'STARTER UNVERIFIED';
  const teamLineupPresent=Boolean(context.lineups?.[r.team]);
  const softRole=teamLineupPresent&&!lineup?'Not listed in publicly displayed five starters; this is NOT a confirmed bench or DNP':'Starter not independently confirmed';
  const projection=Number(r.minutes),minBaseline=Number.isFinite(projection)&&projection>0?projection:null;
  const minutesTrend=r.evidence?.minutesTrend;
  const minutesStable=minBaseline!=null&&minBaseline>=23&&minutesTrend!=null&&Math.abs(minutesTrend)<=15;
  const opportunityTracked=Boolean(r.evidence?.opportunityMeasured)&&scoringOpp.has(r.stat);
  const trackingDependent=['AST','REB','PA','PR','RA','PRA'].includes(r.stat);
  const spreadMatch=game?.odds?.spreadText?.match(/[-+]\d+(?:\.\d+)?/),spread=spreadMatch?Math.abs(Number(spreadMatch[0])):null;
  const risk=(rest.secondNight?6:0)+(spread>=11?4:0)+(injuryCaution?18:0);
  let contextScore=50;
  if(lineup?.lineupStatus==='confirmed')contextScore+=18;
  else if(lineup?.lineupStatus==='expected')contextScore+=7;
  if(minutesStable)contextScore+=8;
  else if(minutesTrend!=null&&Math.abs(minutesTrend)>20)contextScore-=10;
  if(opportunityTracked)contextScore+=8;
  if(trackingDependent)contextScore-=8; // Potential assists/rebound chances have not been corroborated.
  if(context.injuriesFetched===false)contextScore-=6;
  contextScore-=risk;
  contextScore=clamp(contextScore,0,100);
  const e=r.evidence||{};
  // Stat-specific defense score contributes more than the old generic 50-neutral matchup.
  // Defensive rank 1=toughest, N=softest. It is not a shot-chance forecast.
  const rawScore=.31*(e.baseline??50)+.17*(e.hitHistory??50)+.13*(e.opportunity??50)+.16*(sideMatchup??50)+.10*(e.confidence??40)+.05*(e.consistency??50)+.08*contextScore;
  let score=round(clamp(rawScore,0,context.lineupsFetched?88:79)); // Scores stay uncalibrated and source-limited.
  const hard=[...(r.hard||[])];if(injuryVeto)hard.push(`ESPN reports ${injury.status} (${Math.round(age)}h ago)`);
  let state=hard.length?'PASS':'RESEARCH ONLY';
  const checks=[
   check('Exact platform line',r.observedAt&&Date.now()-Date.parse(r.observedAt)<=120*60000?'observed':'pending',r.observedAt?`Last observed ${new Date(r.observedAt).toLocaleString('en-US')}; verify current line AND payout in app`:'No verified timestamp for this line','Independent PrizePicks data feed',r.observedAt,'https://app.prizepicks.com/'),
   check('ESPN reported injury',injuryVeto?'veto':injuryCaution?'reported':injuryCurrent?'reported':context.injuriesFetched?'unverified':'pending',injuryCurrent?`${injury.status}${injury.reason?' · '+injury.reason:''}`:context.injuriesFetched?'Not listed or older than 36h — NOT proof of healthy/active':'ESPN injury feed unavailable','ESPN injuries',injury?.updatedAt||context.updatedAt,'https://official.nba.com/nba-injury-report-2026-27-season/'),
   check('Starter status',lineup?.lineupStatus==='confirmed'?'confirmed':lineup?'expected':'pending',lineup?`${roleLine} (${lineup.pos})${lineup.tag?' · '+lineup.tag:''}`:context.lineupsFetched?softRole:`Authorized lineup feed unavailable: ${context.lineupError||'source did not return usable data'}`,'Authorized lineup feed (RotoWire linked for manual check)',context.lineupUpdatedAt,'https://www.rotowire.com/basketball/nba-lineups.php'),
   check('Projected minutes',minutesStable?'model':'pending',minBaseline!=null?`L5 actual ${minBaseline} min (change ${minutesTrend??'—'}% L5 vs L10); ${minutesStable?'stable historic role, not independent projected minutes':'independent forecast REQUIRED'}`:'No recent minutes history','ESPN historical minutes · independent RotoWire projection not connected',null,'https://www.rotowire.com/basketball/nba-player-projections.php'),
   check('Stat-specific opportunity',opportunityTracked?'partial':'pending',opportunityTracked?`Measured box-score attempt trend supports the score (${r.stat}); tracking chances still require checking`:'Rebound chances, potential assists, touches/usage or combinations require tracking; not inferred from box scores','ESPN box scores; NBA tracking if independently obtained',null,'https://www.nba.com/stats/players'),
   check('Defense vs position',defenseGrade.available?(defenseGrade.proxy?'partial':'observed'):'pending',defenseGrade.available?(defenseGrade.positionCandidates?`${defenseGrade.primary} · proxy grade ${r.side==='LESS'?defenseGrade.lessGrade:defenseGrade.grade} (possible positions ${defenseGrade.positionCandidates.join('/')} ; ${r.side==='LESS'?defenseGrade.range.less.join('–'):defenseGrade.range.more.join('–')} score range). Public fantasy eligibility, NOT confirmed game position. NBA.com as of ${defenseGrade.positionSourceDate}.`:(defenseGrade.sourceUrl?`${defenseGrade.primary} · ${defenseGrade.allowedAverage} ${r.stat} allowed per game to ${defenseGrade.position} position (season table, not player forecast)`:`${defenseGrade.primary} · ${defenseGrade.allowedAverage} ${r.stat} per player (${defenseGrade.sample} observations)`)):(context.publicDvp?.available?'No exact game-day position or published eligibility match for this player/team/stat':`Public DvP unavailable: ${context.publicDvp?.reason||'source not reached'}`),defenseGrade.source||'ESPN prior opponent box scores (position proxy)',defenseGrade.updatedAt||null,defenseGrade.sourceUrl||'https://www.fantasypros.com/nba/defense-vs-position.php'),
   check('Shot-zone alignment',r.zoneScore!=null?'proxy':'pending',r.zoneScore!=null?`Shot zone ${Math.round(r.zoneScore)}/100, descriptive overlap only`:'No meaningful shot-zone profile for this prop','ESPN shooting coordinates / model',null,null),
   check('Pace/spread/blowout',game?.odds?'observed':'pending',game?.odds?`Game total ${game.odds.total??'—'} · ${game.odds.spreadText||'spread unknown'}${spread>=11?' · blowout risk elevated':''}`:'Game odds unavailable; pace not independently projected','ESPN scoreboard',context.updatedAt,null),
   check('Back-to-back and rest',rest.secondNight!==null?'observed':'pending',rest.secondNight?'Player on second night of B2B':rest.daysRest!==null?`${rest.daysRest} full rest day(s)`:'Cannot verify last completed game','ESPN prior schedule',null,null),
   check('Teammate on/off/cannibalization','pending','No automatically verified minutes-on/off splits or teammate opportunity redistribution','RotoWire / NBA tracking',null,'https://www.rotowire.com/basketball/nba-lineups.php'),
   check('Individual price and line movement','pending','Individual sportsbook prop line, movement, PrizePicks multiplier and expected value not available','Verify in market and PrizePicks',null,'https://app.prizepicks.com/'),
   check('Independent final veto','pending','Requires second pass for lineup, minutes, role, injury, price and correlated legs','RFPP 2.0 verification protocol',null,null)
  ];
  // Live 2.0 scoring: missing independent evidence cannot become a high-confidence pick.
  let v2=null;
  if(r.v2History){
   v2=gradePropV2({
    prop:{player:r.player,stat:r.stat,line:r.line,observedAt:r.observedAt},side:r.side,hist:r.v2History,
    zone:r.zoneScore==null?null:{score:r.zoneScore},
    // The G/F/C DvP proxy is NOT verified exact-position stat DvP.
    dvp:null,market:{observedAt:r.observedAt,lineVerified:false,offeredSideVerified:false,priceVerified:false}
   });
   score=v2.score;
   hard.push(...v2.hard);
   state=hard.length?'PASS':'RESEARCH ONLY';
   checks.push(check('v2.0 independent grading',v2.hard.length?'veto':'partial',
    v2.hard.length?v2.hard.join('; '):v2.missing.length+' missing source checks; '+v2.warnings.length+' cautions',
    'NBA Scout video-informed RFPP 2.0 scoring hypothesis'));
  }
  // RFPP 2.1: show useful statistical separation without pretending pending
  // role/odds/lineup checks are already cleared.
  const edge=enhancedEvidence({...r,v2},{defenseGrade,rest,latestOdds:game?.odds});
  score=edge.score;
  const need=checks.filter(x=>['pending','unverified','veto'].includes(x.state)).length;
  let lean=state==='PASS'?'VETO / PASS':edge.label;
  if(injuryCaution&&state!=='PASS')lean='HOLD · QUESTIONABLE';
  // New explanation-first verdict: every row, including the opposite MORE/LESS,
  // gets an independent assessment. Missing pricing/role never means BET-READY.
  const recommendation=assessProp({...r,state,hard,injuryStatus:injuryCurrent?injury?.status||null:null,lineupStatus:lineup?.lineupStatus||'unverified'},
   {defenseGrade,rest,latestOdds:game?.odds});
  return {...r,score,state,hard,grade:grade(score),lean,defenseGrade,v2,edge,recommendation,readiness:edge.readiness,
   matchupGrade:sideMatchup==null?null:{score:Math.round(sideMatchup),letter:r.side==='LESS'?defenseGrade.lessGrade:defenseGrade.grade,direction:r.side,proxy:Boolean(defenseGrade.proxy),position: (defenseGrade.positionCandidates||[defenseGrade.position]).join('/')},
   lineupStatus:lineup?.lineupStatus||'unverified',lineupRole:lineup?.pos||null,injuryStatus:injuryCurrent?injury?.status||null:null,
   latestOdds:game?.odds||null,rest,sourceChecks:checks,checks:checks.filter(x=>['pending','veto','unverified'].includes(x.state)).map(x=>x.name+': '+x.detail),
   pendingCount:need,scoreVersion:'RFPP 2.3 · sourced DvP plus published fantasy position ranges, exact court slot distinguished',
   evidence:{...e,v2Components:v2?.components??null,v2Confidence:v2?.confidence??null,defense:sideMatchup==null?null:round(sideMatchup),context:round(contextScore),sourceQuality:context.lineupsFetched?'ESPN + licensed lineup feed':'ESPN only · lineup feed unavailable'}};
 });
 rows.sort((a,b)=>Number(a.state==='PASS')-Number(b.state==='PASS')||b.score-a.score||String(a.player).localeCompare(String(b.player)));
 const eligible=rows.filter(x=>x.state!=='PASS');
 const topMore=chooseUnique(eligible.filter(x=>x.side==='MORE'),limit,{positive:true});
 const topLess=chooseUnique(eligible.filter(x=>x.side==='LESS'),limit,{positive:true});
 const top=chooseUnique(eligible,limit,{positive:true});
 const worst=chooseUnique(eligible.filter(x=>x.side==='MORE'&&x.defenseGrade.available).sort((a,b)=>a.defenseGrade.score-b.defenseGrade.score),limit);
 return {...board,candidates:top,topMore,topLess,top10More:topMore,top10Less:topLess,bottom10:worst,unfavorable:worst,bottom6:worst.slice(0,6),
  all:rows,allCount:rows.length,qualified:eligible.length,sourceStatus:{espnInjuries:Boolean(context.injuriesFetched),licensedLineups:Boolean(context.lineupsFetched),lineupProviderError:context.lineupError||null,individualPrices:false,independentMinutes:false,
   publicDvp:{available:Boolean(context.publicDvp?.available),statsLoaded:context.publicDvp?.statsLoaded||[],reason:context.publicDvp?.reason||null,updatedAt:context.publicDvp?.updatedAt||null},
   publishedPositions:{available:Boolean(context.publicPositions?.available),playerCount:context.publicPositions?.count||0,publishedAt:context.publicPositions?.publishedAt||null,live:Boolean(context.publicPositions?.live),reason:context.publicPositions?.reason||null},
   sourcedExact:rows.filter(x=>x.defenseGrade?.available&&!x.defenseGrade.proxy).length,
   sourcedEligibilityEstimates:rows.filter(x=>x.defenseGrade?.available&&x.defenseGrade.proxy&&x.defenseGrade.positionCandidates).length,
   missingDefensiveMatches:rows.filter(x=>!x.defenseGrade?.available).length},
  scoringVersion:'2.6-tail-and-minute-guarded-research',warning:'Top 10 MORE/LESS are conditional research candidates, not final betting recommendations; sourced injuries, optional LICENSED expected lineups, G/F/C defensive proxy, historical minutes and recent attempts do not replace independent confirmed lineups, projected minutes, prop pricing, tracking opportunities or final second-pass audit.'};
}
