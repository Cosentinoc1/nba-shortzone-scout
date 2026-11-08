/**
 * RFPP 2.6: source-aware, stat-specific PROP DECISION (research, not a P(win)).
 * The weights are transparent screening hypotheses, NOT fitted or validated
 * betting edges. Missing data is neutral on score and restrictive on readiness.
 * The strong-candidate tier requires independent model + real minutes evidence;
 * market/payout, injury and confirmed role are separate final gates.
 */
const finite=x=>x!==null&&x!==undefined&&x!==''&&Number.isFinite(Number(x));
const num=x=>finite(x)?Number(x):null;
const clip=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
const mean=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:null;
const median=a=>{if(!a.length)return null;const b=[...a].sort((x,y)=>x-y);return b.length%2?b[(b.length-1)/2]:(b[b.length/2-1]+b[b.length/2])/2};
const stdev=a=>a.length<4?null:Math.sqrt(mean(a.map(v=>(v-mean(a))**2)));
const quantile=(a,p)=>{if(!a.length)return null;const b=[...a].sort((x,y)=>x-y),i=(b.length-1)*p,lo=Math.floor(i),hi=Math.ceil(i);return b[lo]+(b[hi]-b[lo])*(i-lo)};
const round=(v,d=1)=>v===null||!Number.isFinite(v)?null:Number(v.toFixed(d));
const SIGN={MORE:1,LESS:-1};
const FLOOR={PTS:3.2,REB:1.7,AST:1.4,'3PM':.75,PRA:4.3,PR:3.6,PA:3.6,RA:2.7,FGA:2.5,'3PA':1.5,FTM:1.3,'2PM':1.2};
const COMPONENTS={PRA:['pts','reb','ast'],PR:['pts','reb'],PA:['pts','ast'],RA:['reb','ast']};
const DRIVER={PTS:['fga','fta'],REB:['reb'],AST:['ast'],'3PM':['tpa'],FGA:['fga'],'3PA':['tpa'],FTM:['fta'],'2PM':['fga'],PRA:['pts','reb','ast'],PR:['pts','reb'],PA:['pts','ast'],RA:['reb','ast']};
const POS=new Set(['PG','SG','SF','PF','C']);
const labels={pts:'points',reb:'rebounds',ast:'assists',fga:'field-goal attempts',fta:'free-throw attempts',tpa:'three-point attempts'};
function per36(row,key){const v=num(row?.[key]),m=num(row?.minutes);return v===null||m===null||m<=0?null:36*v/m;}
function trend(rows,key){
 const recent=rows.slice(0,5).map(x=>per36(x,key)).filter(x=>x!==null);
 const prior=rows.slice(5,10).map(x=>per36(x,key)).filter(x=>x!==null);
 if(recent.length<3||prior.length<3)return null;
 const a=mean(recent),b=mean(prior);
 return b>0?clip(a/b-1,-.5,.5):null;
}
function dateFresh(observedAt,now){const t=Date.parse(observedAt||'');const dt=now-t;return Number.isFinite(t)&&dt>=-300000&&dt<=120*60000;}
function describeDvp(d,side){
 if(!d?.available||!finite(d.score)||!finite(d.lessScore))return {valid:false,score:null,text:'No supported opponent-versus-position data for this stat.',notes:[],uncertain:true};
 const value=Number(side==='LESS'?d.lessScore:d.score);
 const eligible=Array.isArray(d.positionCandidates)?d.positionCandidates:[];
 const basePosition=eligible.length?eligible.join('/'):d.position||'position';
 const stats=Array.isArray(d.components)?d.components:[];
 let facts=stats.slice(0,3).map(x=>{
  const rank=num(x.rankMostAllowed),stat=x.stat||d.stat;
  return rank?`${stat}: #${rank} of 30 in most allowed`:`${stat}: position average ${round(num(x.value),1)??'—'}`;
 });
 // Published fantasy eligibility is not proof of tonight's actual assignment.
 const estimated=eligible.length>0;
 const range=d.range?.[side==='LESS'?'less':'more'];
 const uncertain=estimated&&Array.isArray(range)&&range.length===2&&num(range[0])<50&&num(range[1])>50;
 const text=`${d.opponent||'Opponent'} versus ${basePosition}: ${round(value,0)}/100 for ${side}${estimated?' (published eligible positions, not tonight’s defensive assignment)':' (single-position data)'}.`;
 return {valid:true,score:value,text,notes:facts,estimated,uncertain,range:Array.isArray(range)?range:null,position:basePosition};
}
function flag(text,category='info'){return {text,category};}
const SCORE_WEIGHTS=Object.freeze({projection:30,history:26,opportunity:18,defense:10,minutes:12,environment:4});
export function assessProp(row,{rotowire=row?.rotowire||null,defenseGrade=row?.defenseGrade||null,rest=row?.rest||null,latestOdds=row?.latestOdds||null,now=Date.now(),marketVerified=false,marketEdgeVerified=false}={}){
 const side=SIGN[row?.side]?row.side:null,sign=SIGN[side];
 if(!side||!finite(row?.line)||num(row.line)<0)throw Error('Prop must have a valid MORE/LESS direction and nonnegative line');
 const line=num(row.line),stat=row.stat||'PTS',h=row.v2History||{},rows=Array.isArray(h.recent)?h.recent.slice(0,10):[];
 const values=rows.map(x=>num(x.stat)).filter(x=>x!==null);
 const availableGames=num(h.boxscoreGames)??values.length;
 const volatility=Math.max(FLOOR[stat]||2,stdev(values)||0,line*.10);
 const historical=median(values),historicalMean=num(h.projectedBaseline)??num(row.projected);
 const histGap=historical!==null?sign*(historical-line):historicalMean!==null?sign*(historicalMean-line):null;
 const histZ=histGap===null?null:clip(histGap/volatility,-3,3);
 const count=values.length;
 const recentWins=count?values.filter(x=>sign*(x-line)>0).length:0;
 const recentPush=count?values.filter(x=>x===line).length:0;
 const sampleResolved=count-recentPush;
 const smoothedRate=sampleResolved>=4?(recentWins+4)/(sampleResolved+8):null;
 const model=rotowire?.matched===true&&finite(rotowire.projectedStat)&&finite(rotowire.projectedMinutes);
 const projection=model?num(rotowire.projectedStat):null;
 const minForecast=model?num(rotowire.projectedMinutes):null;
 const projGap=projection===null?null:sign*(projection-line);
 const projZ=projGap===null?null:clip(projGap/volatility,-3,3);
 // Directional distribution diagnostics, not win probabilities. Evaluate before any game is played.
 const upperQuartile=quantile(values,.75),lowerQuartile=quantile(values,.25);
 const underWinRate=side==='LESS'&&sampleResolved>=7?recentWins/sampleResolved:null;
 const underTail=side==='LESS'&&count>=7&&upperQuartile!==null&&upperQuartile>line+Math.max(.25,.12*volatility);
 const underFragile=side==='LESS'&&((underWinRate!==null&&underWinRate<.70)||(underTail&&(projZ===null||projZ<1.3)));
 const lowMinuteMore=side==='MORE'&&minForecast!==null&&minForecast<23;
 const conditionalMoreMinutes=side==='MORE'&&minForecast!==null&&minForecast>=23&&minForecast<26&&(['PRA','PR','PA','RA'].includes(stat)||projZ===null||projZ<1.05||histZ===null||histZ<.65);
 const checks=[],helps=[],hurts=[],signals=[];
 const note=(arr,s)=>{if(!arr.includes(s))arr.push(s)};
 const hard=Array.isArray(row.hard)&&row.hard.length>0||row.state==='PASS';
 const lineFresh=dateFresh(row.observedAt,now);
 const minutes=rows.map(x=>num(x.minutes)).filter(x=>x!==null);
 const recentMin=mean(minutes.slice(0,5));
 const minSd=stdev(minutes);
 const minCV=minSd!==null&&mean(minutes)>0?minSd/mean(minutes):null;
 const relativeMinutes=minForecast!==null&&recentMin?minForecast/recentMin-1:null;
 const injured=/^out$|^inactive$|^doubtful$|^suspended$/i.test(String(row.injuryStatus||''));
 const uncertainInjury=/questionable|game.?time|day.to.day/i.test(String(row.injuryStatus||''));
 const modelContradicts=projZ!==null&&projZ<=-.3;
 const historyContradicts=histZ!==null&&histZ<=-.35;
 const disagreement=projZ!==null&&histZ!==null&&projZ*histZ<0&&Math.max(Math.abs(projZ),Math.abs(histZ))>=.5;
 const largeMinuteShift=relativeMinutes!==null&&Math.abs(relativeMinutes)>.25||rotowire?.unstableMinutes===true;
 const validModel=Boolean(model&&minForecast>=18&&minForecast<=48&&!rotowire?.matchupMismatch);
 const projectedRate=(minForecast!==null&&minForecast>0)?36*line/minForecast:null;
 const rateHistory=median(rows.map(x=>per36(x,'stat')).filter(x=>x!==null));
 const directGap=projGap!==null?round(projGap):null;
 if(histGap!==null){const s=`Last ${count} median ${round(historical)} vs line ${line}: ${side} margin ${histGap>=0?'+':''}${round(histGap)} (${round(histZ,2)} volatility units)`;signals.push({key:'history',weight:26,score:null,detail:s});
  if(histZ>=.35)note(helps,s);else if(histZ<=-.35)note(hurts,'Recent median does not support '+side+': '+s);else note(checks,'Recent median is close to the line; limited separation.');
 }
 if(smoothedRate!==null){let rate=`Recent results: ${recentWins}/${count} true ${side} wins, ${recentPush} pushes; smoothed historical rate ${round(smoothedRate*100,0)}% (descriptive, not win chance)`;if(smoothedRate>=.60)note(helps,rate);else if(smoothedRate<.44)note(hurts,rate);else note(checks,rate);}
 else note(checks,'Fewer than four resolved recent outcomes; historical clearance is weak.');
 if(side==='LESS'&&upperQuartile!==null){const text=`LESS distribution check: last ${count} upper quartile ${round(upperQuartile)} vs ${line} line; ${recentWins}/${sampleResolved} resolved recent unders (descriptive, NOT P(win))`;
   signals.push({key:'upper_tail',weight:0,detail:text});
   if(underFragile)note(hurts,text+' — repeated upside makes the LESS direction fragile.');
   else if(underTail)note(checks,text+' — upper tail crosses the line, but projection offers separation.');
   else note(helps,text+' — recent upper tail stays below the line.');
 }
 if(projection!==null){const txt=`RotoWire projects ${round(projection)} ${stat} in ${round(minForecast)} minutes against ${line}: ${side} margin ${directGap>=0?'+':''}${directGap} (${round(projZ,2)} volatility units)`;
  signals.push({key:'projection',weight:30,detail:txt});if(projZ>=.45)note(helps,txt);else if(projZ<=-.30)note(hurts,txt);else note(checks,txt+' — gap is too small to qualify alone.');
 } else note(checks,'Upload today’s RotoWire stat and minutes projection; do not rely only on box-score averages.');
 if(projectedRate!==null&&rateHistory!==null){const ratio=rateHistory/projectedRate;
  const text=`At ${round(minForecast)} projected minutes, the line needs ${round(projectedRate)} ${stat} per 36; recent median rate ${round(rateHistory)} per 36`;
  if(sign*(rateHistory-projectedRate)>Math.max(.4,volatility*.25))note(helps,text);
  else if(sign*(rateHistory-projectedRate)<-Math.max(.4,volatility*.25))note(hurts,text);
  else note(checks,text+' — borderline.');
 }
 const opportunity=DRIVER[stat]||[],comboParts=COMPONENTS[stat]||null;
 const changes=opportunity.map(k=>({key:k,change:trend(rows,k)})).filter(x=>x.change!==null);
 const coreStat=['PTS','3PM','3PA','FTM','FGA','2PM'].includes(stat);
 const avgChange=changes.length?mean(changes.map(x=>x.change)):null;
 const supports=changes.filter(x=>sign*x.change>=.10).length;
 const opposes=changes.filter(x=>sign*x.change<=-.10).length;
 let opportunitySignal=avgChange===null?0:clip(sign*avgChange*75,-22,22);
 if(comboParts){if(supports>=2)opportunitySignal+=5;if(opposes>=2)opportunitySignal-=10;}
 if(!coreStat)opportunitySignal*=.5; // per-36 REB/AST counts are production proxies, not tracking opportunity
 opportunitySignal=clip(opportunitySignal,-24,24);
 if(changes.length){const detail=`Non-overlapping last five vs previous five (per 36 min): ${changes.map(x=>`${labels[x.key]||x.key} ${x.change>=0?'+':''}${round(x.change*100,0)}%`).join('; ')}`+(coreStat?'':' — BOX-SCORE production proxy, not tracking chances');
  signals.push({key:'opportunity',weight:18,detail});if(opportunitySignal>=6)note(helps,detail);else if(opportunitySignal<=-6)note(hurts,detail);else note(checks,'Opportunity trend is small or mixed: '+detail);
  if(comboParts&&opposes>=2)note(hurts,`${opposes}/${comboParts.length} combo components trend against ${side}`);
 }else note(checks,'Not enough non-overlapping per-36 observations for '+(opportunity.map(x=>labels[x]||x).join(' + ')||stat)+'.');
 if(['AST','REB','PRA','PR','PA','RA'].includes(stat))note(checks,'Potential assists / rebound chances are not in the current feed; historical AST/REB rates are only proxies.');
 if(coreStat&&model){const key={'PTS':'projectedFGA','3PM':'projected3PA','3PA':'projected3PA',FTM:'projectedFTA',FGA:'projectedFGA','2PM':'projectedFGA'}[stat];const val=key?num(rotowire[key]):null;
  if(val!==null)signals.push({key:'projected_volume',weight:0,detail:`RotoWire supporting volume: ${round(val)} ${key.replace('projected','')} (independent projection, not guaranteed attempts)`});
 }
 if(minCV!==null){if(minCV>.26)note(hurts,`Recent minutes volatile: ${round(minCV*100,0)}% coefficient of variation`);else if(minCV<.12)note(helps,`Recent minutes relatively stable: ${round(recentMin)} per game`);}
 if(largeMinuteShift)note(hurts,`Projected minutes shift ${round((relativeMinutes??rotowire?.minutesChangePct/100??0)*100,0)}% from recent; role must be reconfirmed`);
 if(minForecast!==null&&minForecast<20)note(hurts,`RotoWire projects only ${round(minForecast)} minutes; highly sensitive to rotation changes`);
 if(lowMinuteMore||conditionalMoreMinutes)note(hurts,`Low-minute MORE: projected ${round(minForecast)} minutes creates material rotation and volume risk; do not promote on a raw projection gap alone.`);
 if(relativeMinutes!==null&&Math.abs(relativeMinutes)<=.12)note(helps,`Projected ${round(minForecast)} minutes agree with recent ${round(recentMin)} minutes`);
 const dvp=describeDvp(defenseGrade,side);
 if(dvp.valid){const d=`Defense matchup: ${dvp.text}${dvp.notes.length?' '+dvp.notes.join('; '):''}`;
  signals.push({key:'defense',weight:10,detail:d});if(dvp.score>=68&&!dvp.uncertain)note(helps,d);else if(dvp.score<=35&&!dvp.uncertain)note(hurts,d);else note(checks,dvp.uncertain?'Defensive grade changes materially across eligible positions; confirm game-day position.':d);
 }else note(checks,'Stat-specific DvP unavailable; defense is NOT treated as a positive matchup.');
 if(rest?.secondNight===true)note(hurts,'Second game of a back-to-back may affect minutes and efficiency.');
 const spread=String(latestOdds?.spreadText||'').match(/[-+]\d+(?:\.\d+)?/),spreadNum=spread?Math.abs(Number(spread[0])):null;
 if(spreadNum!==null&&spreadNum>=11)note(hurts,`Game spread ${round(spreadNum)} points; blowout threatens full minutes, especially for MORE.`);
 const gameTotal=num(latestOdds?.total);
 if(!lineFresh)note(checks,'Exact standard line was not verified within the previous two hours; recheck in app.');
 if(!['confirmed'].includes(String(row.lineupStatus||'')))note(checks,'Game-day starter/bench role is not confirmed by a licensed source.');
 if(!row.injuryStatus)note(checks,'Player not individually cleared by a fresh official injury report; not listed does not mean confirmed active.');
 if(uncertainInjury)note(hurts,`Injury listing is ${row.injuryStatus}; availability is unresolved.`);
 if(!marketVerified)note(checks,'No verified payout or comparable market price; expected value cannot be established.');
 // Components are 0-100 evidence scales, not estimated outcome probabilities.
 const projectedComponent=projZ===null?50:clip(50+38*Math.tanh(projZ/1.15),7,93);
 const historicalComponent=histZ===null?50:clip(50+34*Math.tanh(histZ/1.15)+(smoothedRate===null?0:16*(smoothedRate-.5)),7,93);
 const volumeComponent=clip(50+opportunitySignal,22,78);
 const defenseComponent=dvp.valid?clip(50+(dvp.score-50)*(dvp.estimated?0.42:1),20,80):50;
 const minuteComponent=clip(50+(minCV!==null?(minCV<.12?7:minCV>.26?-12:0):0)+(largeMinuteShift?-20:0)+(relativeMinutes!==null&&Math.abs(relativeMinutes)<=.12?7:0)+(minForecast!==null&&minForecast<20?-18:0),8,85);
 const envComponent=clip(50+(rest?.secondNight?-12:0)+(spreadNum!==null&&spreadNum>=11?-10:0)+(gameTotal!==null&&gameTotal>=240?(side==='MORE'?3:-3):0),26,74);
 const components={projection:round(projectedComponent,1),history:round(historicalComponent,1),opportunity:round(volumeComponent,1),defense:round(defenseComponent,1),minutes:round(minuteComponent,1),environment:round(envComponent,1)};
 let score=Math.round(Object.entries(SCORE_WEIGHTS).reduce((s,[key,w])=>s+components[key]*w/100,0));
 if(disagreement)score-=15;
 if(historyContradicts&&modelContradicts)score-=10;
 if(uncertainInjury)score-=10;
 if(!availableGames||availableGames<5)score=Math.min(score,48);
 score=Math.round(clip(score,10,90));
 const blockers=[];
 if(hard||injured)blockers.push('Hard veto / known unavailable player');
 if(uncertainInjury)blockers.push('Questionable or unclear injury status');
 if(largeMinuteShift)blockers.push('Material minutes change');
 if(minCV!==null&&minCV>.32)blockers.push('Unreliable minutes distribution across recent games');
 if(coreStat&&avgChange!==null&&sign*avgChange<=-.18&&supports===0)blockers.push('Shooting / free-throw volume trend materially opposes this direction');
 if(comboParts&&opposes>=2)blockers.push('Multiple combo components trend against this direction');
 if(disagreement)blockers.push('Historical median and independent projection disagree');
 if(modelContradicts)blockers.push('Independent projection opposes this direction');
 if(rotowire?.matchupMismatch)blockers.push('Uploaded RotoWire projection belongs to a different opponent');
 if(historyContradicts)blockers.push('Historical median opposes this direction');
 if(dvp.valid&&dvp.score<=25&&!dvp.estimated)blockers.push('Very adverse exact-position defense');
 if(dvp.uncertain)blockers.push('Multi-position matchup spans both favorable and unfavorable');
 if(availableGames<5)blockers.push('Insufficient historical sample');
 if(model&&minForecast<18)blockers.push('Very low projected minutes');
 if(lowMinuteMore)blockers.push('Low-minute MORE: fewer than 23 forecast minutes');
 if(conditionalMoreMinutes)blockers.push('Fragile MORE: 23–25 forecast minutes without exceptional corroboration');
 if(underFragile)blockers.push('Fragile LESS: recent upper-tail breakouts or too few cleared unders');
 // Blocked, missing-data and unresolved-role candidates must not rank near fully corroborated bets.
 if(!model)score=Math.min(score,57);
 if(!lineFresh)score=Math.min(score,55);
 if(!row.injuryStatus||row.lineupStatus!=='confirmed')score=Math.min(score,62);
 if(blockers.length)score=Math.min(score,54);
 if(hard||injured)score=Math.min(score,20);
 const supportCount=[histZ!==null&&histZ>=.32,projZ!==null&&projZ>=.42,opportunitySignal>=5,dvp.valid&&dvp.score>=65&&!dvp.uncertain,relativeMinutes!==null&&Math.abs(relativeMinutes)<=.12].filter(Boolean).length;
 const modelAligned=validModel&&projZ>=.42&&!rotowire?.historyOpposes;
 const strong=score>=65&&modelAligned&&histZ!==null&&histZ>=.30&&availableGames>=7&&supportCount>=2&&!blockers.length&&lineFresh;
 const watched=score>=58&&histZ!==null&&histZ>=.2&&!modelContradicts&&!injured&&availableGames>=5;
 let tier='PASS';
 if(hard||injured)tier='VETO';
 else if(blockers.length)tier='HOLD';
 else if(strong)tier='STRONG';
 else if(watched)tier='LEAN';
 const lineupConfirmed=row.lineupStatus==='confirmed';
 const injuryReviewed=Boolean(row.injuryStatus)&&!uncertainInjury&&!injured;
 const priceReady=Boolean(marketVerified);
 const entryReady=strong&&lineupConfirmed&&injuryReviewed&&priceReady&&marketEdgeVerified===true; // market comparison must actually show a vetted positive edge, not only an available price
 const status=tier==='VETO'?'DO NOT PICK':tier==='HOLD'?'HOLD — CHECK CONFLICT':tier==='STRONG'?(entryReady?'BET-READY · '+side:'STRONG '+side+' · FINAL CHECKS'):tier==='LEAN'?'LEAN '+side+' · NOT APPROVED':'PASS — NO EDGE';
 const confFields=[values.length>=7,model,minForecast!==null,minCV!==null,dvp.valid,!dvp.estimated,lineFresh,lineupConfirmed,injuryReviewed,priceReady];
 const confidence=confFields.filter(Boolean).length>=8?'Higher evidence coverage':confFields.filter(Boolean).length>=5?'Moderate evidence coverage':'Limited evidence coverage';
 const summary=entryReady?`Independent projection, historical median, minutes and stat-specific volume support ${side}; market and lineup checks cleared.`:
  tier==='STRONG'?`Several independent signals favor ${side}, but this is a research shortlist until role, injuries, exact line and payout are checked.`:
  tier==='LEAN'?`A modest ${side} signal, not enough for a high-conviction selection.`:
  tier==='HOLD'?`Do not force a ${side} pick: ${blockers.slice(0,2).join('; ')}.`:
  tier==='VETO'?'Unavailable, outdated or otherwise hard-vetoed; avoid this prop.':`No defensible separation for ${side} at the current line.`;
 return {side,score,tier,status,entryReady,summary,confidence,weights:SCORE_WEIGHTS,components,upperQuartile:round(upperQuartile),lowerQuartile:round(lowerQuartile),underFragile,lowMinuteMore,conditionalMoreMinutes,volatilityScale:round(volatility),projected:projection,modelGap:round(projGap),median:round(historical),historicalMargin:round(histGap),smoothedHistoricalRate:round(smoothedRate===null?null:smoothedRate*100,0),recentWins,recentPush,recentSample:count,modelAligned,sourceCount:confFields.filter(Boolean).length,
  supportCount,helps:helps.slice(0,8),hurts:hurts.slice(0,7),checks:checks.slice(0,9),blockers,signals,
  defense:dvp,method:'RFPP 2.6: independent projection 30%, volatility/median/history 26%, non-overlapping per-36 opportunity 18%, stat-specific DvP 10%, minutes risk 12%, context 4%. Adds LESS upper-tail veto, MORE low-minute guard, missing-data and conflict score caps. Weights are transparent untrained heuristics; NOT P(win), EV, or a proven betting advantage. A green shortlist still needs verified line, role, injury and payout.'};
}
