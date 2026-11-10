/** User-supplied RotoWire projections for ONE slate. Read-only in-memory overlay.
 * No subscription login, automated subscriber extraction or server-side persistence.
 * A projection is an estimate, never proof a player starts or will play.
 */
import {keyName,normalizeTeam,clamp} from './model.mjs';
import {gradePropV2} from './grading-v2.mjs';
import {enhancedEvidence} from './edge-v4.mjs';
import {assessProp} from './decision-v25.mjs';
import {directionalEvidence} from './edge-v3.mjs';
import {rotoTeam,rotoNameKey,buildRotoLookup,findRotoProjection,diagnoseRotoMatch} from './roto-match-v310.mjs';
import {rankResearchProp} from './research-rank-v27.mjs';
const numeric=['MIN','PTS','REB','AST','STL','BLK','TO','FGM','FGA','3PM','3PA','FTM','FTA','OREB','DREB'];
const round=(v,places=1)=>Number(Number(v).toFixed(places));
const sig=x=>keyName(x||'');
export function normalizeRotoProjections(rows){
 if(!Array.isArray(rows)||rows.length>500)throw Error('RotoWire upload must contain 1–500 player rows');
 const out=[],seen=new Set();
 for(const raw of rows){
  if(!raw||typeof raw!=='object')continue;
  const name=String(raw.NAME||raw.name||'').trim().slice(0,90);
  const team=rotoTeam(raw.Team||raw.team);
  if(!name||!/^\w{3}$/.test(team))continue;
  const obj={name,team,opp:rotoTeam(raw.OPP||raw.opp||''),pos:String(raw.Pos||raw.pos||'').slice(0,4)};
  let malformed=false;const required=new Set(['MIN','PTS','REB','AST','FGA','3PA']);
  for(const k of numeric){const rawValue=raw[k]??raw[k.toLowerCase()];
   if(rawValue==null||rawValue===''){obj[k]=null;if(required.has(k))malformed=true;continue;}
   const value=Number(rawValue);if(!Number.isFinite(value)||value<0||value>(k==='MIN'?48:k==='FGA'||k==='3PA'?70:180)){obj[k]=null;if(required.has(k))malformed=true;continue;}
   obj[k]=round(value,4);
  }
  if(malformed)continue;
  if(obj.FGM!=null&&obj.FGA<obj.FGM || obj['3PM']!=null&&obj['3PA']<obj['3PM'] || obj.FTA!=null&&obj.FTM!=null&&obj.FTA<obj.FTM)continue;
  const id=team+':'+rotoNameKey(name);if(seen.has(id))continue;seen.add(id);out.push(obj);
 }
 return out;
}
export function projectedValue(p,stat){
 const x=k=>p[k]===null||p[k]===undefined||p[k]===''?null:Number(p[k]);
 const map={PTS:['PTS'],REB:['REB'],AST:['AST'],'3PM':['3PM'],FGA:['FGA'],'3PA':['3PA'],FTM:['FTM'],PRA:['PTS','REB','AST'],PR:['PTS','REB'],PA:['PTS','AST'],RA:['REB','AST']};
 if(stat==='2PM')return x('FGM')!==null&&x('3PM')!==null?round(x('FGM')-x('3PM'),2):null;
 const keys=map[stat];return keys&&keys.every(k=>x(k)!==null)?round(keys.reduce((a,k)=>a+x(k),0),2):null;
}
function unique(rows,limit){const seen=new Set(),out=[];for(const x of rows){if(x.state==='PASS'||!x.rotowire?.supportsSide)continue;
  const k=sig(x.player);if(seen.has(k))continue;seen.add(k);out.push(x);if(out.length>=limit)break;
 }return out;}
/** Regrade directional research ONLY when RotoWire and historical opportunity agree.
 * Source checks are evidence, not bookmaker odds or calibrated outcome distributions.
 */
export function applyRotoProjections(board,rows,day,{limit=10,uploadedAt=null}={}){
 const data=normalizeRotoProjections(rows),lookup=buildRotoLookup(data);
 const matchedPlayers=new Set(),matchedOffers=new Set();let normalizedNameMatches=0;
 let matched=0,zeroMinute=0,unmatched=0,wrongOpponent=0;
 const adjusted=(board.all||[]).map(r=>{
  const found=findRotoProjection(lookup,r),p=found?.projection;if(!p){unmatched++;return {...r,rotowire:{matched:false},score:Math.min(Number(r.score)||50,52),lean:'PENDING ROTO PROJECTION'};}
  if(p.opp&&p.opp!==rotoTeam(r.opponent)){wrongOpponent++;return {...r,rotowire:{matched:false,matchupMismatch:true},score:Math.min(Number(r.score)||50,40),lean:'HOLD · ROTO OPPONENT MISMATCH'};}
  matched++;if(found.method==='normalized')normalizedNameMatches++;
  matchedPlayers.add(rotoTeam(r.team)+':'+rotoNameKey(r.player));matchedOffers.add(rotoTeam(r.team)+':'+rotoNameKey(r.player)+':'+r.stat+':'+r.line);
  const minutes=p.MIN,forecast=projectedValue(p,r.stat),gap=forecast==null?null:round(r.side==='MORE'?forecast-r.line:r.line-forecast,2);
  const typical=Number(r.minutes),validTypical=Number.isFinite(typical)&&typical>0;
  const minDiff=validTypical?round(100*(minutes/typical-1),0):null;
  const scale=({PTS:5,REB:2.4,AST:2.2,'3PM':1.1,FGA:4.5,'3PA':2.7,FTM:2.0,PRA:7,PR:6,PA:6,RA:4.2,'2PM':2.0})[r.stat]||Math.max(2,r.line*.20);
  const threshold=Math.max(.4,Math.min(2.0,scale*.22));
  const projectionScore=gap===null?50:clamp(50+(gap/scale)*20,5,95);
  const minutesScore=minutes===0?0:minDiff==null?52:clamp(82-Math.abs(minDiff)*1.15,15,90);
  const historyGap=Number(r.margin),historyKnown=Number.isFinite(historyGap);
  const historyOpposes=gap!=null&&gap>threshold&&historyKnown&&historyGap < -Math.max(1,scale*.32);
  const unstableMinutes=minDiff!=null&&Math.abs(minDiff)>27;
  const observedMs=Date.parse(r.observedAt||''),lineFresh=Number.isFinite(observedMs)&&Date.now()-observedMs>=-120000&&Date.now()-observedMs<=75*60000;
  const zero=minutes===0;
  if(zero)zeroMinute++;
  const hard=[...(r.hard||[])];if(zero)hard.push('RotoWire export projects 0 minutes (not a confirmed DNP)');
  if(!lineFresh)hard.push('Current exact line was not observed within 75 minutes; reconfirm in PrizePicks');
  if(minutes>0&&minutes<15)hard.push('RotoWire projects fewer than 15 minutes; high role risk');
  const sourceCheck={name:'RotoWire projected minutes',state:'observed',detail:`User-uploaded RotoWire ${minutes} MIN; ${validTypical?'historical L5 '+typical.toFixed(1)+' MIN; change '+minDiff+'%':'no reliable historical minutes'}. Projection, NOT a confirmed lineup.`,source:'RotoWire subscriber export supplied for '+day,updatedAt:uploadedAt};
  const upstream={name:'RotoWire projected opportunity',state:'partial',detail:`${r.stat} projected ${forecast??'—'}; FGA ${p.FGA.toFixed(1)}, 3PA ${p['3PA'].toFixed(1)}, FTA ${p.FTA==null?'—':p.FTA.toFixed(1)}. Potential assists/rebound chances and independent model consensus still unverified.`,source:'RotoWire subscriber export supplied by user',updatedAt:uploadedAt};
  const checks=(r.sourceChecks||[]).map(c=>{
   if(c.name==='Projected minutes')return sourceCheck;
   if(c.name==='Stat-specific opportunity')return upstream;
   return c;
  });
  if(!checks.some(c=>c.name==='RotoWire projected minutes'))checks.push(sourceCheck);
  const supported=gap!=null&&gap>=threshold&&!historyOpposes&&!unstableMinutes&&minutes>=15&&!zero&&hard.length===0&&r.state!=='PASS';
  let score=Math.round(clamp(.60*(Number(r.score)||50)+.28*projectionScore+.12*minutesScore-(historyOpposes?11:0)-(unstableMinutes?8:0),0,88));
  // RotoWire is the independent user-uploaded projection, NOT a confirmed lineup.
  const v2=r.v2History?gradePropV2({
   prop:{player:r.player,stat:r.stat,line:r.line,observedAt:r.observedAt},side:r.side,hist:r.v2History,
   zone:r.zoneScore==null?null:{score:r.zoneScore},
   independent:{source:'User-uploaded RotoWire projected minutes/stats',minutes,stat:forecast,
    roleVerified:r.lineupStatus==='confirmed',injuryVerified:Boolean(r.injuryStatus),
    injuryStatus:r.injuryStatus||'unverified',statusObservedAt:null},
   dvp:null,market:{observedAt:r.observedAt,lineVerified:false,offeredSideVerified:false,priceVerified:false}
  }):null;
  if(v2){score=v2.score;hard.push(...v2.hard)}
  const state=hard.length?'PASS':r.state;
  let lean=state==='PASS'?'VETO / PASS':unstableMinutes?'HOLD · MINUTES SHIFT':historyOpposes?'HOLD · MODEL/HISTORY CONFLICT':supported&&score>=60?`ROTO + HISTORY ${r.side}`:'NO STRONG LEAN';
  const rotowire={matched:true,source:'RotoWire daily user upload',projectedMinutes:minutes,projectedStat:forecast,projectedFGA:p.FGA,projected3PA:p['3PA'],projectedFTA:p.FTA,projectedPTS:p.PTS,projectedREB:p.REB,projectedAST:p.AST,modelGap:gap,projectionScore:Math.round(projectionScore),minutesChangePct:minDiff,historyOpposes,unstableMinutes,supportsSide:supported,lineFresh,notConfirmedLineup:true};
  const edge=enhancedEvidence({...r,v2},{defenseGrade:r.defenseGrade,rotowire,rest:r.rest,latestOdds:r.latestOdds});
  score=edge.score;
  lean=state==='PASS'?'VETO / PASS':unstableMinutes?'HOLD · MINUTES SHIFT':historyOpposes?'HOLD · MODEL/HISTORY CONFLICT':!supported?'HOLD · NEEDS ALIGNMENT':edge.label;
  const e=r.evidence||{},pending=checks.filter(c=>['pending','unverified','veto'].includes(c.state));
  const recommendation=assessProp({...r,hard,state,rotowire},{rotowire,defenseGrade:r.defenseGrade,rest:r.rest,latestOdds:r.latestOdds});
  const adjustedRow={...r,score,v2,edge,recommendation,readiness:edge.readiness,grade:score>=82?'A':score>=70?'B':score>=58?'C':score>=45?'D':'F',hard,state,lean,rotowire,sourceChecks:checks,pendingCount:pending.length,checks:pending.map(c=>c.name+': '+c.detail),evidence:{...e,v2Components:v2?.components??null,v2Confidence:v2?.confidence??null,projection:Math.round(projectionScore),projectedMinutes:Math.round(minutesScore)},scoreVersion:'RFPP 2.2 · RotoWire + robust threshold requirement + role stability',reasons:[`RotoWire projects ${minutes} minutes and ${forecast??'—'} ${r.stat} vs ${r.line} line`,...(r.reasons||[])]};
  return {...adjustedRow,researchRank:rankResearchProp(adjustedRow,recommendation)};
 });
 adjusted.sort((a,b)=>Number(a.state==='PASS')-Number(b.state==='PASS')||b.score-a.score||String(a.player).localeCompare(String(b.player)));
 const eligible=adjusted.filter(x=>x.state!=='PASS');
 const support=eligible.filter(x=>x.rotowire?.supportsSide&&x.score>=60);
 const topMore=unique(support.filter(x=>x.side==='MORE'),limit),topLess=unique(support.filter(x=>x.side==='LESS'),limit);
 const bottom10=unique([...eligible].filter(x=>x.side==='MORE'&&x.defenseGrade?.available).sort((a,b)=>a.defenseGrade.score-b.defenseGrade.score).map(x=>({...x,rotowire:{...x.rotowire,supportsSide:true}})),limit);
 return {...board,candidates:unique(support,limit),topMore,topLess,top10More:topMore,top10Less:topLess,bottom10,unfavorable:bottom10,bottom6:bottom10.slice(0,6),all:adjusted,qualified:eligible.length,
  rotowireStatus:{date:day,uploadedAt,playerRows:data.length,directionsMatched:matched,unmatchedDirections:unmatched,zeroMinuteDirections:zeroMinute,wrongOpponentDirections:wrongOpponent,uniquePlayersMatched:matchedPlayers.size,uniquePropsMatched:matchedOffers.size,normalizedNameMatches,...diagnoseRotoMatch({boardRows:board.all||[],projections:data,matched,wrongOpponent}),source:'User-supplied RotoWire XLSX/CSV; estimates, not game confirmations',mode:'Transient ranking calculation; projections are stored in this browser only',independentAgreement:false},
  scoringVersion:'2.2-expanded-directional-roto',warning:'Top candidates require agreement between RotoWire projection, minutes and ESPN historical opportunity; still NO confirmed lineup, multiple independent models, live player odds, payout EV, or guaranteed outcomes.'};
}
