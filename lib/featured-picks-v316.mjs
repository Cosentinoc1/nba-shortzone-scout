/** NBA Scout v3.16. Two-minute research desk. No invented "locks", prices,
 * injury upgrades, projections, game scripts, or betting probabilities.
 * Input is the SAME fully enriched board as the Top 10; no extra data calls.
 */
const num=x=>x===null||x===undefined||x===''||!Number.isFinite(Number(x))?null:Number(x);
const norm=x=>String(x||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/ig,'').toLowerCase();
const round=x=>Math.round(x*10)/10;
const gradeTier={PRIORITY:3,LEAN:2,WATCH:1};
const scoring=new Set(['PTS','3PM','2PM','3PA','FGA','FTM']);
import {roleFor,roleFact} from './offense-context-v316.mjs';
import {auditPlayerHistory} from './history-integrity-v318.mjs';
function getFact(row,label){return (row.quickRead?.facts||[]).find(f=>f.label===label)||null;}
function matchup(row){
 const d=row.defenseGrade||{},v=num(row.side==='LESS'?d.lessScore:d.score);
 const correct=Boolean(d.available&&v!==null);
 const proxy=Boolean(d.proxy||d.positionCandidates?.length);
 const zoneFact=getFact(row,'DEFENSIVE ZONE — RANKING GATE')||getFact(row,'SHOT-ZONE MATCHUP')||getFact(row,'3-POINT ZONE');
 const zoneSupport=Boolean(scoring.has(row.stat)&&zoneFact?.strength==='support');
 const zoneAgainst=Boolean(scoring.has(row.stat)&&(row.newsZone?.shot?.contradicted||zoneFact?.strength==='caution'));
 const definite=correct&&!proxy&&v>=64;
 const partial=correct&&proxy&&v>=66;
 let description='Opponent position-specific defense has not been independently verified for this prop. No matchup edge assumed.';
 let strength='missing';
 if(definite){strength='strong';description=`${d.primary||row.opponent+' position defense'}; sourced ${row.side} matchup score ${round(v)}/100. This is opponent allowance, not a guaranteed clearance.`}
 else if(partial){strength='proxy';description=`${d.primary||row.opponent+' position estimate'}; ${round(v)}/100 favors ${row.side}, but the exact game-day position is not verified.`}
 else if(correct){strength=v>=54?'mixed':'against';description=`${d.primary||'Opponent position defense'}: ${round(v)}/100 for ${row.side}${proxy?' (estimated position)':''}; not a convincing defensive advantage.`}
 if(scoring.has(row.stat)&&zoneFact?.detail){
  const z=zoneFact.detail;
  if(zoneSupport){description+=` Shot-zone evidence: ${z}`;if(strength==='missing'||strength==='mixed')strength='zone';}
  else if(zoneAgainst){description+=` Zone caution: ${z}`;strength=strength==='strong'?'mixed':strength==='proxy'?'mixed':'against';}
 }
 if(!scoring.has(row.stat))description+=' Shot locations do not establish rebound chances or potential assists.';
 return {strength,score:v,proxy,source:d.sourceUrl||zoneFact?.source||null,description,zoneSupport,zoneAgainst};
}
function makeCandidate(row,game,offenseContext){
 const rr=row.researchRank||{},q=row.quickRead||{},h=row.v2History||{};
 const exact=h.hitRates?.last10||row.hit10||{};
 const wins=num(exact.win)||0,losses=num(exact.loss)||0,pushes=num(exact.push)||0,resolved=wins+losses;
 const winRate=resolved?round(100*wins/resolved):null;
 const l5=h.hitRates?.last5||{};
 const median=num(rr.median),minute=num(rr.minutesL5??row.minutes),minuteCV=num(rr.minutesCV);
 const histStrong=resolved>=7&&wins/resolved>=.64;
 const historyUseful=resolved>=6&&wins/resolved>=.54;
 const minsGood=minute!==null&&minute>=25&&(minuteCV===null||minuteCV<=.30);
 const oppScore=num(rr.components?.opportunity),opportunityGood=oppScore!==null&&oppScore>=54;
 const role=getFact(row,'MINUTES & INJURIES'),style=getFact(row,'PLAYSTYLE & USAGE');
 const m=matchup(row);
 const roleSample=roleFor(offenseContext,row.team,row.player);
 const usage=roleFact(roleSample,row.stat);
 const topTeamRole=usage.valid&&usage.topTwo;
 const hasDefenseEdge=['strong','proxy','zone'].includes(m.strength);
 const independent=row.rotowire?.matched===true&&!row.rotowire?.matchupMismatch;
 const projected=num(row.rotowire?.projectedStat),pmins=num(row.rotowire?.projectedMinutes);
 const modelFav=independent&&projected!==null&&((row.side==='MORE'&&projected>row.line)||(row.side==='LESS'&&projected<row.line));
 const modelOpp=independent&&projected!==null&&((row.side==='MORE'&&projected<row.line)||(row.side==='LESS'&&projected>row.line));
 const ready=Boolean(row.recommendation?.entryReady===true&&q.checks?.lineFresh&&q.checks?.starterConfirmed&&q.checks?.injuriesSourced&&modelFav&&q.market?.positiveEV===true);
 const pillars={history:historyUseful,minutes:minsGood,opportunity:opportunityGood,matchup:hasDefenseEdge,projection:modelFav,teamRole:topTeamRole};
 const pillarCount=Object.values(pillars).filter(Boolean).length;
 let rating=(num(rr.score)||0)+(gradeTier[rr.tier]||0)*3;
 rating+=histStrong?9:historyUseful?5:0;
 rating+=minsGood?4:minute!==null&&minute<22?-7:0;
 rating+=opportunityGood?3:0;
 rating+=m.strength==='strong'?8:m.strength==='zone'?6:m.strength==='proxy'?3:m.strength==='against'?-10:0;
 rating+=modelFav?9:modelOpp?-18:0;
 rating+=topTeamRole?8:usage.valid&&usage.rank>5?-3:0;
 rating+=q.checks?.starterConfirmed?5:0;
 rating+=row.newsZone?.confirmedOpportunity?4:0;
 if(row.recommendation?.tier==='PASS')rating-=6;
 if(row.recommendation?.tier==='HOLD')rating-=3;
 if(row.side==='LESS'&&minute!==null&&minute>=32&&m.strength==='against')rating-=6;
 if(m.zoneAgainst)rating-=8;
 const reasons=[];
 if(historyUseful)reasons.push({label:'The numbers',text:`${wins}/${resolved} resolved recent games cleared ${row.side} ${row.line} ${row.stat} (${winRate}%). ${pushes} pushes excluded.${l5.win!=null?` Last five: ${l5.win} wins, ${l5.loss||0} losses.`:''}`,source:'ESPN pregame box scores · observed record, not P(win)',kind:histStrong?'support':'observed'});
 else reasons.push({label:'The numbers',text:`L10 at this exact line: ${wins} wins, ${losses} losses and ${pushes} pushes${resolved<6?' — limited sample':''}.`,source:'ESPN completed pregame box scores',kind:'neutral'});
 const opportunityDetail=style?.detail||'Shot volume and stat-specific usage not verified.';
 const minuteDetail=role?.detail||`${minute??'Unknown'} recent actual minutes; player rotation not confirmed.`;
 reasons.push({label:'Playstyle / opportunities',text:opportunityDetail,source:style?.source||'ESPN historical box scores',kind:opportunityGood?'support':'neutral'});
 reasons.push({label:'Team offensive role',text:usage.text,source:usage.source,kind:topTeamRole?'support':usage.valid?'observed':'neutral'});
 reasons.push({label:'Why this defense?',text:m.description,source:m.source||'NBA Scout defensive context; verify actual matchup',kind:hasDefenseEdge?'support':m.strength==='against'?'caution':'neutral'});
 reasons.push({label:'Role and injuries',text:minuteDetail,source:role?.source||'ESPN historical minutes and injuries',kind:minsGood?'support':'neutral'});
 const gameOdds=row.latestOdds||{};
 const spread=String(gameOdds.spreadText||'').match(/[-+]\d+(?:\.\d+)?/),spreadAbs=spread?Math.abs(Number(spread[0])):null;
 const blowout=spreadAbs!==null&&spreadAbs>=11;
 const b2b=row.rest?.secondNight===true||row.rest?.team?.secondNight===true;
 const gameText=gameOdds.total!=null||gameOdds.spreadText?`ESPN team-market total ${gameOdds.total??'unavailable'}; spread ${gameOdds.spreadText||'unavailable'}. ${blowout?'Double-digit favorite/underdog spread raises blowout-minute risk.':'Spread alone does not prove pace or possessions.'} ${b2b?'Player is on a back-to-back; minutes and output deserve an extra check.':''}`:`No current, confirmed team total or spread. Pace, rotations and blowout risk are unverified. ${b2b?'Team back-to-back is noted.':''}`;
 reasons.push({label:'Game script / minutes risk',text:gameText,source:'ESPN scheduled matchup and team-market odds; not a player prop price',kind:blowout||b2b?'caution':'neutral'});

 if(independent)reasons.push({label:'Independent projection',text:`Uploaded RotoWire projects ${projected===null?'unknown':round(projected)} ${row.stat} in ${pmins===null?'unknown':round(pmins)} minutes${modelFav?', supporting '+row.side:modelOpp?', opposing '+row.side:' — direction unconfirmed'}.`,source:'User-uploaded RotoWire · projection, not starter confirmation',kind:modelFav?'support':modelOpp?'caution':'neutral'});
 if(roleSample?.fantasyPointsPerMinute!==null&&roleSample?.fantasyPointsPerMinute!==undefined){
  const fpm=roleSample.fantasyPointsPerMinute;
  reasons.push({label:'Historical fantasy production per minute',
   text:`Observed ${fpm} fantasy points/min in ${roleSample.fantasyGames} complete historical games (FanDuel-style 1/1.2/1.5/3/3/-1 weights). ${pmins!==null?`At ${pmins} separately uploaded projected minutes this would imply about ${round(fpm*pmins)} fantasy points before matchup/role adjustments — a sensitivity check, NOT a prop projection.`:'Independent projected minutes are missing; no projected fantasy score is computed.'} Fantasy points allowed vs position must not be substituted for the exact ${row.stat} market.`,
   source:'ESPN final box scores; user-uploaded RotoWire minutes if present',kind:'observed'});
 }

 const checks=[];
 if(!q.checks?.starterConfirmed)checks.push('Confirmed starting status/role');
 if(!usage.valid)checks.push('Team shot/assist/rebound share — minimum three prior games');
 if(!q.checks?.injuriesSourced)checks.push('Current game-day injury report');
 if(!independent)checks.push('Independent projected minutes and stat forecast');
 if(m.strength==='missing'||m.strength==='against'||m.strength==='mixed')checks.push('A genuinely favorable verified defensive matchup');
 if(!q.market?.positiveEV)checks.push('Exact selectable line, book price / payout and positive-value confirmation');
 if(row.recommendation?.tier==='HOLD'||row.recommendation?.tier==='PASS')checks.push(`Strict final veto says ${row.recommendation.tier}${row.recommendation.status?' — '+row.recommendation.status:''}`);
 const risks=[...new Set([
  ...(m.zoneAgainst?['The opponent zone profile contradicts this direction.']:[]),
  ...(blowout?['Double-digit game spread could shorten the expected minutes.']:[]),
  ...(b2b?['Second night of a back-to-back may change role or playing time.']:[]),
  ...(modelOpp?['Independent model projects the opposite side.']:[]),
  ...(row.newsZone?.flags||[]).filter(x=>x.tone==='red').map(x=>x.title+': '+x.detail),
  ...(row.quickRead?.risks||[]).filter(x=>!x.startsWith('Ranking adjustment')).slice(0,2)
 ])].slice(0,4);
 const confidence=pillarCount>=4&&histStrong&&hasDefenseEdge&&!modelOpp?'STRONG RESEARCH':pillarCount>=3?'MULTI-SIGNAL RESEARCH':'LIMITED RESEARCH';
 const covered=[
  {name:'Exact standard line',state:q.checks?.lineFresh?'SOURCED':'MISSING',source:'Independent platform line feed'},
  {name:'Last 10 / 20 results',state:num(h.boxscoreGames)>=10?'SOURCED':num(h.boxscoreGames)>=6?'PARTIAL':'MISSING',source:'ESPN completed games'},
  {name:'Team opportunity / top-two role',state:usage.valid?'BOX-SCORE PROXY':'MISSING',source:'ESPN previous five team games; not actual usage%'},
  {name:'Opponent DvP and zone',state:m.strength==='strong'?'SOURCED':m.strength==='proxy'||m.strength==='zone'?'PROXY':m.strength==='against'?'UNFAVORABLE':'MISSING',source:'NBA House exact-position table / ESPN reconstructed zones'},
  {name:'Injury report',state:q.checks?.injuriesSourced?'REPORT FETCHED':'MISSING',source:'ESPN injuries · an unlisted player is not confirmed active'},
  {name:'Starting role',state:q.checks?.starterConfirmed?'CONFIRMED':row.lineupStatus==='expected'?'EXPECTED':'MISSING',source:'Licensed lineup provider if connected'},
  {name:'Projected minutes and output',state:independent?'PROJECTION':'MISSING',source:'User-uploaded RotoWire sheet; private to browser'},
  {name:'Independent market and payout',state:q.market?.positiveEV===true?'VERIFIED':'MISSING',source:'Independent sportsbook quotes + platform payout; not currently confirmed'},
  {name:'Game spread / script',state:row.latestOdds?.spreadText?'TEAM SPREAD':'MISSING',source:'ESPN scoreboard; may change'},
  {name:'True tracking chances / on-off',state:'MISSING',source:'NBA tracking/potential assists/rebound chances unavailable'}
 ];
 return {player:row.player,team:row.team,opponent:row.opponent,stat:row.stat,side:row.side,line:row.line,
  score:rr.score??null,researchTier:rr.tier,confidence,entryStatus:ready?'ALL CHECKS PRESENT · VERIFY IN APP':'NOT APPROVED · FINAL CHECKS MISSING',entryReady:ready,
  gradeExplanation:'Research quality is NOT a predicted hit rate or guarantee.',
  signalCount:pillarCount,matchupScore:m.score,matchupStrength:m.strength,rating:round(rating),usage:usage.valid?{rank:usage.rank,share:usage.share,sample:roleSample?.sample,source:usage.source}:null,
  lastTen:{wins,losses,pushes,resolved,percent:winRate},lastTwenty:h.hitRates?.last20||null,historySample:h.boxscoreGames??null,
  rotowireMatch:independent?{minutes:pmins,projection:projected,supports:modelFav,opposes:modelOpp}:null,sourceCoverage:covered,
  reasons,checks:[...new Set(checks)].slice(0,6),risks,sourceObservedAt:row.observedAt||null,
  gameId:game?.id||null,gameTipoff:game?.tipoff||null,
  detailKey:[row.player,row.team,row.opponent,row.stat,row.side,row.line].join('|')};
}
/** Only pre-tip, current-standard offers; never backfill picks after results.
 * Some dates may have fewer than 2 or 5 defensible research candidates.
 */
export function buildFeaturedPicks(board,{now=Date.now(),offenseContext=null,gameCache=null}={}){
 const gs=board?.games||[];
 const byTeam=new Map(gs.flatMap(g=>[[g.away,g],[g.home,g]]));
 const rows=board?.all||[];const candidates=[];
 for(const r of rows){
  const q=r.quickRead,rr=r.researchRank||{},g=byTeam.get(r.team);
  if(!q||!rr.eligible||!gradeTier[rr.tier]||r.state==='PASS'||r.hard?.length||r.newsZone?.veto||r.newsZone?.hold)continue;
  if(!g||![g.away,g.home].includes(r.opponent)||g.completed||g.state==='in'||g.state==='post')continue;
  if(!Number.isFinite(Date.parse(g.tipoff||''))||Date.parse(g.tipoff)<=now+5*60000)continue;
  if(!q.checks?.lineFresh||q.checks?.gameStarted||/^(HOLD|PASS|CLOSED)/i.test(q.status||''))continue;
  if(/^(OUT|DOUBTFUL|INACTIVE|SUSPENDED|QUESTIONABLE)/i.test(r.injuryStatus||''))continue;
  if(!Number.isFinite(Number(r.line))||String(r.tier||'standard').toLowerCase()!=='standard')continue;
  if(num(r.v2History?.boxscoreGames)<6||num(r.researchRank?.minutesL5)<18)continue;
  const c=makeCandidate(r,g,offenseContext);
  if(c.signalCount<2||c.matchupStrength==='against'||r.rotowire?.matchupMismatch)continue;
  // The video's 'sure-bet' interpretation is not sound. Verified model conflicts
  // or contradictory same-stat opponent zones are not allowed into the Best 2/5.
  if(r.rotowire?.matched&&Number.isFinite(Number(r.rotowire.projectedStat))&&
     ((r.side==='MORE'&&Number(r.rotowire.projectedStat)<Number(r.line))||
      (r.side==='LESS'&&Number(r.rotowire.projectedStat)>Number(r.line))))continue;
  candidates.push(c);
 }
 candidates.sort((a,b)=>Number(b.entryReady)-Number(a.entryReady)||b.signalCount-a.signalCount||b.rating-a.rating||String(a.player).localeCompare(String(b.player)));
 const selected=[],people=new Set();
 // Prefer diverse matchups for a two-pick card where comparably strong options exist.
 for(const c of candidates){if(people.has(norm(c.player)))continue;
   if(selected.length===1&&c.gameId===selected[0].gameId){const alt=candidates.find(x=>!people.has(norm(x.player))&&x.gameId!==selected[0].gameId&&x.signalCount>=c.signalCount-1&&x.rating>=c.rating-5);if(alt)continue;}
   selected.push(c);people.add(norm(c.player));if(selected.length>=5)break;
 }
 const audited=gameCache?selected.map(x=>({...x,historyAudit:auditPlayerHistory({gameCache,team:x.team,playerName:x.player,stat:x.stat,day:board?.date||''})})):selected;
 const anyApproved=audited.some(x=>x.entryReady);
 return {date:board?.date||null,updatedAt:new Date(now).toISOString(),top2:audited.slice(0,2),top5:audited.slice(0,5),
  qualifiedCandidates:candidates.length,status:selected.length?'research':'no_supported_candidates',
  message:!selected.length?'No pregame player prop has at least two supported independent research signals at a fresh standard line. Nothing is labeled a lock.':
    anyApproved?'Review the fully checked entries again in the platform before placing any wager.':
      'These are the closest evidence-supported research candidates, NOT betting locks. The required market, minutes, lineup or injury verification is still incomplete.',
  sources:{platform:'Independent standard NBA prop feed',boxscores:'ESPN official game summaries',dvP:'NBA House exact-position DvP or labeled proxy',zones:'ESPN reconstructed shot zones',injuries:'ESPN injury/news feed',lineups:'Licensed lineup feed only if configured',projections:'User-uploaded RotoWire only',odds:'ESPN spread/total only; independent prop prices unavailable unless connected'},
  method:'Volume and team-role first; exact stat-specific opponent weakness; game script/injury/rotation; independent RotoWire when supplied; L5/L10/L20 historical clearances last; no multiplication of dependent component hit rates. Existing RFPP final veto remains binding. No calibrated win probability or automatic +EV assertion.'};
}
