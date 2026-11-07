/** Evidence-first per-offer NBA prop research. Only documented available stats are scored. */
import {keyName,matchupGrade,clamp} from './model.mjs';
import {researchPlayer,STATS,statValue} from './research.mjs';
import {statCode} from './props.mjs';
import {externalMatchup} from './public-dvp.mjs';
import {publishedMatchup} from './published-positions.mjs';
import {buildDvpIndex,defenseMatchup} from './dvp.mjs';
import {lookupLineup} from './lineups.mjs';

const marketCodes={
 player_points:'PTS',player_rebounds:'REB',player_assists:'AST',player_threes:'3PM',
 player_three_pointers:'3PM',player_three_pointers_made:'3PM',player_pra:'PRA',
 player_pts_rebs_asts:'PRA',player_pts_rebs:'PR',player_pts_asts:'PA',player_rebs_asts:'RA',
 player_fg_attempts:'FGA',player_field_goal_attempts:'FGA',player_fg_attempted:'FGA',
 player_threes_attempted:'3PA',player_three_point_attempts:'3PA',
 player_ft_made:'FTM',player_free_throws_made:'FTM',player_2pt_made:'2PM'
};
export function insightStat(market){
 const val=String(market||'').trim();return STATS[val]?val:marketCodes[val.toLowerCase()]||statCode(val);
}
const avg=xs=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:null;
const round=(n,d=1)=>n==null||!Number.isFinite(n)?null:+n.toFixed(d);
const chicagoDay=value=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
const deltaDays=(a,b)=>(Date.parse(a+'T12:00:00Z')-Date.parse(b+'T12:00:00Z'))/86400000;
const lower=s=>keyName(String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,''));
/** Broad G/F/C opponent allowed box-score production, not PG/SG/PF exact DvP or potential chances. */
export function opponentPositionProxy({gameCache,rosters,opponent,pos,stat,day}){
 const position=String(pos||'').toUpperCase().slice(0,1);
 if(!['G','F','C'].includes(position)||!STATS[stat])return null;
 const data=[];
 for(const g of Object.values(gameCache||{})){
  if(!g?.date||!g?.teams?.includes(opponent)||!Array.isArray(g.players)||chicagoDay(g.date)>=day)continue;
  for(const p of g.players){
   if(p.team===opponent||!p.box||!p.played||!(Number(p.minutes)>=10))continue;
   const roster=(rosters[p.team]||[]).find(r=>String(r.id)===String(p.id));
   const group=(p.pos||roster?.pos||'').toUpperCase().slice(0,1);
   if(group!==position)continue;
   const v=statValue(p.box,stat);if(Number.isFinite(v))data.push({v,game:g.id});
  }
 }
 const vals=data.map(x=>x.v);
 if(vals.length<5)return {position,opponent,sample:vals.length,perPlayerAverage:round(avg(vals)),usable:false,source:'ESPN box scores'};
 return {position,opponent,sample:vals.length,gameCount:new Set(data.map(x=>x.game)).size,perPlayerAverage:round(avg(vals)),usable:true,source:'ESPN opposing-player box scores, 10+ minutes, broad G/F/C position proxy; NOT exact PG/SG/SF/PF/C DvP or opponent-adjusted prediction'};
}
/** Completed games only, before the studied day. */
export function backToBack(gameCache,team,day){
 let latest=null;
 for(const g of Object.values(gameCache||{})){
  if(!g?.date||!g?.teams?.includes(team))continue;
  const d=chicagoDay(g.date);if(d>=day)continue;
  if(!latest||d>latest)latest=d;
 }
 return latest?{previousGameDate:latest,daysRest:deltaDays(day,latest)-1,secondNight:deltaDays(day,latest)===1,source:'ESPN completed-game schedule'}:{previousGameDate:null,daysRest:null,secondNight:null,source:'Insufficient completed-game schedule'};
}
const directional=(r,side,line,injury)=>{
 if(!r?.ready||r.boxscoreGames<5)return {side,grade:null,lean:'INSUFFICIENT DATA',evidenceScore:null,reason:'Requires five complete pregame box scores'};
 const gap=r.projectedBaseline==null?null:(side==='MORE'?r.projectedBaseline-line:line-r.projectedBaseline);
 const hit=r.hitRates?.last10,rate=hit?.sample>=5?hit.win/hit.sample:null;
 const scale=Math.max(r.observedP80!=null&&r.observedP20!=null?(r.observedP80-r.observedP20)/2:0,line*.12,side==='MORE'&&r.stat==='3PM'?.8:1.5);
 const baseline=gap==null?50:clamp(50+24*gap/scale,0,100);
 const recent=rate==null?50:clamp(50+60*(rate-.5),10,90);
 const minutes=Number(r.opportunity?.minutesL5),samps=r.boxscoreGames;
 const score=Math.round(clamp(.63*baseline+.27*recent+.1*(samps>=10?80:55),0,100));
 const tier=score>=75?'A':score>=65?'B':score>=55?'C':score>=45?'D':'F';
 const notReady=injury?.status&&/out|doubtful/i.test(injury.status);
 const lean=notReady?'VETO · INJURY STATUS':gap==null?'UNVERIFIED':Math.abs(gap)<Math.max(1,line*.06)?'NO CLEAR DIRECTION':gap>0?'HISTORICAL SUPPORT':'HISTORICALLY OPPOSED';
 return {side,grade:tier,evidenceScore:score,lean,margin:round(gap),last5:r.hitRates?.last5,last10:hit,season:r.hitRates?.season,source:'historical ESPN box scores only',notWinProbability:true};
};
export function buildPropInsight({gameCache,rosters,players,defense,day,team,opponent,playerName,line,market,tier='standard',observedAt=null,context={},expectedMinutes=null,now=Date.now()}){
 const offerStat=insightStat(market);
 const who=(rosters[team]||[]).find(p=>lower(p.name)===lower(playerName));
 const sourceAge=observedAt&&Number.isFinite(Date.parse(observedAt))?Math.max(0,Math.round((now-Date.parse(observedAt))/60000)):null;
 const itemInjury=(context.injuries||[]).find(p=>lower(p.player)===lower(playerName)&&(!p.team||p.team===team))||null;
 const game=context.game||null;
 const standard=String(tier||'').toLowerCase()==='standard';
 const result={player:playerName,team,opponent,day,line,market,stat:offerStat,tier,observedAt,sourceAgeMinutes:sourceAge,
   matchup:game,injury:itemInjury,teammateInjuries:(context.injuries||[]).filter(i=>i.team===team&&lower(i.player)!==lower(playerName)&&/out|doubtful|questionable|game-time|day-to-day/i.test(i.status)).slice(0,8),
   contextSource:context.source||null,contextUpdatedAt:context.updatedAt||null,contextError:context.error||null,
   rest:{team:backToBack(gameCache,team,day),opponent:backToBack(gameCache,opponent,day)},supported:Boolean(offerStat&&who&&opponent),
   sourceLinks:{injuries:'https://official.nba.com/nba-injury-report-2026-27-season/',line:'https://app.prizepicks.com/',minutes:'https://www.rotowire.com/basketball/nba-lineups.php',dvP:'https://www.fantasypros.com/daily-fantasy/nba/fanduel-defense-vs-position.php'},
   sourceCautions:['ESPN is not an official lineup confirmation or licensed minutes projection','Position defense is a G/F/C box-score proxy, not exact position-specific DvP','No automatic rebound chances, potential assists or sportsbook player-prop payout','This is historical research, not a win probability or proven betting edge']};
 if(!offerStat||!who||!opponent){result.reason=!offerStat?'This prop category is not supported by the historical stat model':!who?'Could not match player to roster':'No opponent in selected NBA slate';return result}
 const args={gameCache,offense:team,defense:opponent,playerId:String(who.id),playerName:who.name,stat:offerStat,line,day,expectedMinutes};
 const more=researchPlayer({...args,side:'MORE'}),less=researchPlayer({...args,side:'LESS'});
 result.history={more,less};result.positionDvp=opponentPositionProxy({gameCache,rosters,opponent,pos:who.pos,stat:offerStat,day});
 const profile=players.find(p=>p.team===team&&lower(p.name)===lower(playerName)),d=defense.teams.find(t=>t.code===opponent);
 const zone=profile&&d&&['PTS','3PM','3PA','FGA','2PM'].includes(offerStat)?matchupGrade(profile,d,defense.league):null;
 result.shotZone=zone?.eligible?{grade:zone.grade,score:zone.score,primaryZone:zone.primaryZone,method:zone.method}:null;
 const activeLineup=lookupLineup(context.lineups?.[team],rosters[team],who.name);
 result.lineup=activeLineup?{status:activeLineup.lineupStatus,position:activeLineup.pos,injuryTag:activeLineup.tag,source:'Licensed lineup provider (expected ≠ confirmed)',retrievedAt:context.lineupUpdatedAt}:
 {status:'unverified',position:null,source:'Licensed lineup unavailable or no unambiguous match',error:context.lineupError||null};
 const courtPos=activeLineup?.pos||who.pos;
 const publicExact=externalMatchup(context.publicDvp,{opponent,pos:courtPos,stat:offerStat});
 const publicEstimate=publicExact?null:publishedMatchup(context.publicDvp,context.publicPositions,{team,player:who.name,opponent,stat:offerStat});
 result.defenseGrade=publicExact||publicEstimate||defenseMatchup(buildDvpIndex(gameCache,rosters,day),{opponent,pos:courtPos,stat:offerStat,zoneScore:result.shotZone?.score??null});
 result.leans=[directional(more,'MORE',line,itemInjury),directional(less,'LESS',line,itemInjury)];
 const a=result.leans[0],b=result.leans[1];const best=a.evidenceScore>=b.evidenceScore?a:b;
 const ageOk=sourceAge!==null&&sourceAge<=120;
 const hasFullSample=more.boxscoreGames>=5;
 const injuryHard=/out|doubtful/i.test(itemInjury?.status||'');
 const injuryUnclear=/questionable|game.time|day.to.day/i.test(itemInjury?.status||'');
 const enoughMargin=best.margin!=null&&best.margin>=Math.max(1,line*.08);
 const diverged=a.evidenceScore!=null&&b.evidenceScore!=null&&Math.abs(a.evidenceScore-b.evidenceScore)>=8;
 const matchupSupports=!(result.defenseGrade?.available) || (best.side==='MORE'?result.defenseGrade.score:result.defenseGrade.lessScore)>=35;
 result.lean=(standard&&ageOk&&hasFullSample&&!injuryHard&&enoughMargin&&diverged&&matchupSupports&&best.evidenceScore>=55)
    ?{side:best.side,grade:best.grade,evidenceScore:best.evidenceScore,label:injuryUnclear?'PROVISIONAL · INJURY QUESTION':'PRELIMINARY LEAN'}
    :{side:null,grade:null,evidenceScore:null,label:injuryHard?'PASS · REPORTED OUT/DOUBTFUL':!standard?'NONSTANDARD · RESEARCH ONLY':!ageOk?'PASS · LINE STALE OR UNTIMED':!hasFullSample?'PASS · TOO LITTLE HISTORY':'NO STRONG LEAN / DEFENSE DISAGREES'};
 result.checks=[
  {name:'Current exact line',state:ageOk?'observed':'pending',detail:ageOk?`Observed ${sourceAge} min ago; reconfirm payout in app`:'Observed line older than 2h or missing timestamp',source:'Independent DFS feed'},
  {name:'Injury report',state:context.injuriesFetched===false?'pending':injuryHard?'veto':itemInjury?'reported':'unverified',detail:context.injuriesFetched===false?'ESPN injury endpoint unavailable; no status can be inferred':itemInjury?`${itemInjury.status}${itemInjury.reason?' · '+itemInjury.reason:''}`:'Player not listed in ESPN injuries (not proof of healthy/active)',source:'ESPN NBA injuries',updatedAt:context.injuriesFetched===false?null:(itemInjury?.updatedAt||context.updatedAt)},
  {name:'Starting lineup',state:activeLineup?.lineupStatus==='confirmed'?'confirmed':activeLineup?.lineupStatus==='expected'?'expected':'pending',detail:activeLineup?`${activeLineup.lineupStatus.toUpperCase()} ${activeLineup.pos} · ${activeLineup.name}${activeLineup.tag?' · '+activeLineup.tag:''}`:context.lineupsFetched?'Not displayed among 5 starters; NOT proof of bench/DNP':`No authorized lineup feed: ${context.lineupError||'not connected'}`,source:'Licensed lineup source only; RotoWire verification link is manual',updatedAt:context.lineupUpdatedAt},
  {name:'Projected minutes',state:expectedMinutes!=null?'user-entered':'pending',detail:expectedMinutes!=null?`${expectedMinutes} min entered by user; independently verify`:`Last 5 actual: ${more.opportunity?.minutesL5??'—'} min; this is not a minutes forecast`,source:'ESPN historical minutes / user input'},
  {name:'Upstream opportunity',state:['PTS','3PM','3PA','FGA','FTM','2PM'].includes(offerStat)?'partial':'pending',detail:['PTS','FGA','2PM'].includes(offerStat)?`L5 ${more.opportunity?.fgaL5??'—'} FGA, L10 ${more.opportunity?.fgaL10??'—'} FGA`:['3PM','3PA'].includes(offerStat)?`L5 ${more.opportunity?.tpaL5??'—'} 3PA, L10 ${more.opportunity?.tpaL10??'—'} 3PA`:offerStat==='FTM'?`L5 ${more.opportunity?.ftaL5??'—'} FTA, L10 ${more.opportunity?.ftaL10??'—'} FTA`:'Potential assists, rebound chances or usage are not available in ESPN box scores',source:'ESPN box scores'},
  {name:'Defense vs position',state:result.defenseGrade?.available?'proxy':'pending',detail:result.defenseGrade?.available?`${result.defenseGrade.primary} · matchup ${result.defenseGrade.grade} (${result.defenseGrade.score}/100 for MORE), ${result.defenseGrade.allowedAverage} ${offerStat} / ${result.defenseGrade.position} player; not exact PG/SG/SF/PF/C`: 'Insufficient opponent G/F/C history; exact-position DvP requires independent source',source:'ESPN broad G/F/C defensive proxy (not FantasyPros exact position)'},
  {name:'Game total / spread',state:game?.odds?'observed':'pending',detail:game?.odds?`Total ${game.odds.total??'—'} · ${game.odds.spreadText||'spread unavailable'}`:'No current sportsbook team odds returned',source:'ESPN scoreboard odds',updatedAt:context.updatedAt},
  {name:'Rest and back-to-back',state:result.rest.team.secondNight!==null?'observed':'pending',detail:result.rest.team.secondNight?'Second night of back-to-back':result.rest.team.daysRest===null?'No completed schedule evidence':`${result.rest.team.daysRest} rest day(s)`,source:'ESPN completed games'},
  {name:'Individual market odds / payout',state:'pending',detail:'No verified individual player prop sportsbook market, PrizePicks multiplier or EV model',source:'Manual market check'},
  {name:'Independent projection / final veto',state:'pending',detail:'RotoWire/other projected minutes, starting lineup, pricing, correlation and second-pass audit required',source:'Independent sources'}
 ];
 result.verificationSummary={sourced:result.checks.filter(c=>['observed','confirmed'].includes(c.state)).length,partial:result.checks.filter(c=>['partial','proxy','reported','expected','user-entered','model'].includes(c.state)).length,pending:result.checks.filter(c=>['pending','unverified'].includes(c.state)).length,hardVeto:result.checks.some(c=>c.state==='veto')||injuryHard};
 result.method='RFPP: pregame L5/L10 attempts/minutes and stat results, ESPN injuries/game context, optional authorized lineup feed and broad G/F/C matchup; subscription-only projections and individual prices remain unverified; all grades uncalibrated.';
 return result;
}
