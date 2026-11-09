/** RFPP 2.7 — ranked directional RESEARCH, separate from strict final-veto evidence.
 * Missing independent data stays neutral and lowers verification coverage; it is
 * not fabricated as favorable. All scores are ordinal heuristics, NOT P(win).
 */
const N=x=>x!==null&&x!==undefined&&x!==''&&Number.isFinite(Number(x))?Number(x):null;
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
const avg=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
const median=a=>{if(!a.length)return null;const b=[...a].sort((x,y)=>x-y),n=b.length;return n%2?b[(n-1)/2]:(b[n/2]+b[n/2-1])/2};
const sd=a=>a.length>=4?Math.sqrt(avg(a.map(x=>(x-avg(a))**2))):null;
const q=(a,f)=>{if(!a.length)return null;const b=[...a].sort((x,y)=>x-y),v=(b.length-1)*f,i=Math.floor(v);return b[i]+(b[Math.ceil(v)]-b[i])*(v-i)};
const round=x=>Math.round(x*10)/10;
const fields={PTS:['fga','fta'],REB:['reb'],AST:['ast'],'3PM':['tpa'],FGA:['fga'],'3PA':['tpa'],FTM:['fta'],'2PM':['fga'],PR:['pts','reb'],PA:['pts','ast'],RA:['reb','ast'],PRA:['pts','reb','ast']};
const volumeKeys=new Set(['fga','fta','tpa']);
const FL={PTS:3.2,REB:1.7,AST:1.4,'3PM':.75,PRA:4.3,PR:3.6,PA:3.6,RA:2.7,FGA:2.5,'3PA':1.5,FTM:1.3,'2PM':1.2};
const W=Object.freeze({history:24,recentClearance:14,opportunity:18,minutes:17,defense:15,independentProjection:12});
const timeOK=(stamp,now)=>{const dt=now-Date.parse(stamp||'');return Number.isFinite(dt)&&dt>=-300000&&dt<=120*60000};
function rate(row,key){const v=N(row?.[key]),m=N(row?.minutes);return v===null||m===null||m<=0?null:v*36/m}
function changeInRate(rows,key){
 const a=rows.slice(0,5).map(r=>rate(r,key)).filter(x=>x!==null);
 const b=rows.slice(5,10).map(r=>rate(r,key)).filter(x=>x!==null);
 if(a.length<3||b.length<3||avg(b)<=0)return null;
 return clamp(avg(a)/avg(b)-1,-.6,.6);
}
export const rankingWeights=W;
export function rankResearchProp(row,rec=row?.recommendation||null,{now=Date.now()}={}){
 const side=row?.side,sign=side==='MORE'?1:side==='LESS'?-1:0;
 const stat=row?.stat||'PTS',line=N(row?.line),fresh=timeOK(row?.observedAt,now);
 const history=row?.v2History||{},recent=Array.isArray(history.recent)?history.recent.slice(0,10):[];
 const vals=recent.map(r=>N(r?.stat)).filter(x=>x!==null),n=vals.length;
 const played=N(history.boxscoreGames)??n;
 const minutes=recent.slice(0,5).map(r=>N(r.minutes)).filter(x=>x!==null);
 const m5=avg(minutes),msd=sd(minutes),cv=m5&&msd!==null?msd/m5:null;
 const model=row?.rotowire?.matched===true&&!row?.rotowire?.matchupMismatch&&N(row?.rotowire?.projectedStat)!==null&&N(row?.rotowire?.projectedMinutes)!==null;
 const forecast=model?N(row.rotowire.projectedStat):null,pmin=model?N(row.rotowire.projectedMinutes):null;
 const scale=Math.max(FL[stat]??2,sd(vals)??0,line===null?0:line*.10);
 const med=median(vals),z=med===null||line===null?null:clamp(sign*(med-line)/scale,-2.5,2.5);
 const modelZ=forecast===null||line===null?null:clamp(sign*(forecast-line)/scale,-2.5,2.5);
 const allPush=vals.filter(v=>v===line).length;
 const resolved=vals.length-allPush;
 const wins=vals.filter(v=>sign*(v-line)>0).length;
 const winRate=resolved>0?wins/resolved:null;
 // Shrink L10 clearance toward 50%; it is descriptive, not a predicted win rate.
 const smoothed=resolved>=4?(wins+3)/(resolved+6):null;
 const recentClearance=smoothed===null?50:clamp(50+90*(smoothed-.5),20,80);
 const historyScore=z===null?50:clamp(50+30*Math.tanh(z),15,85);
 const opp=fields[stat]||[];const trends=opp.map(k=>({key:k,v:changeInRate(recent,k)})).filter(x=>x.v!==null);
 const directional=trends.map(x=>sign*x.v);
 const volume=trends.filter(x=>volumeKeys.has(x.key));
 const proxy=!opp.length||opp.some(k=>!volumeKeys.has(k));
 const change=directional.length?avg(directional):null;
 const oppScore=change===null?50:clamp(50+clamp(change*68,-22,22)*(proxy ? .7 : 1),28,72);
 const oppSupports=directional.filter(x=>x>=.09).length;
 const oppOpposes=directional.filter(x=>x<=-.12).length;
 const stabilizer=cv!==null?clamp((.24-cv)*85,-22,17):0;
 const minuteScore=clamp(50+stabilizer+(m5!==null&&m5>=28?9:m5!==null&&m5<20?-16:0)+(pmin!==null&&m5!==null&&Math.abs(pmin-m5)<=3?7:0)+(pmin!==null&&pmin<23&&side==='MORE'?-14:0),15,80);
 const defense=row?.defenseGrade||{};
 const dRaw=side==='LESS'?N(defense.lessScore):N(defense.score);
 const proxied=Boolean(defense.proxy||defense.positionCandidates?.length);
 const dRange=defense.range?.[side==='LESS'?'less':'more'];
 const dvpAmbiguous=Array.isArray(dRange)&&dRange.length===2&&N(dRange[0])<50&&N(dRange[1])>50;
 const defScore=dRaw===null||!defense.available||dvpAmbiguous?50:clamp(50+(dRaw-50)*(proxied?.45:1),25,75);
 const projectionScore=modelZ===null?50:clamp(50+33*Math.tanh(modelZ),16,84);
 const components={history:historyScore,recentClearance,opportunity:oppScore,minutes:minuteScore,defense:defScore,independentProjection:projectionScore};
 let score=Object.entries(W).reduce((s,[k,w])=>s+components[k]*w/100,0);
 const risks=[],reasons=[],checks=[];
 const add=(arr,t)=>{if(t&&!arr.includes(t))arr.push(t)};
 if(z!==null){if(z>=.22)add(reasons,`Last ${n} median ${round(med)} beats the ${line} line for ${side}; ${round(z)} volatility-adjusted units.`);
  else if(z<=-.25)add(risks,`Recent median ${round(med)} opposes ${side} ${line}.`);
  else add(checks,'Recent median is close to the line.');}
 if(smoothed!==null){if(smoothed>=.55)add(reasons,`${wins}/${resolved} resolved recent games cleared ${side} (pushes ${allPush}); small-sample-adjusted clearance ${round(smoothed*100)}%.`);
  else if(smoothed<.45)add(risks,`Only ${wins}/${resolved} resolved recent games cleared this side.`);}
 else add(checks,'Fewer than four resolved games to establish recent clearance.');
 if(change!==null){let str=`L5 vs previous L5 per-36 ${trends.map(x=>`${x.key.toUpperCase()} ${x.v>=0?'+':''}${round(100*x.v)}%`).join(', ')}${proxy?' (production proxies, not tracked chances)':''}.`;
  if(change>=.07)add(reasons,`Opportunity supports ${side}: ${str}`);
  else if(change<=-.10)add(risks,`Opportunity trends oppose ${side}: ${str}`);
  else add(checks,`Opportunity movement is mixed: ${str}`);
 }else add(checks,'No sufficient non-overlapping L5 vs previous L5 opportunity sample.');
 if(proxy)add(checks,'REB/AST box-score production is not rebound chances or potential assists.');
 if(m5!==null){if(m5>=24&&cv!==null&&cv<=.22)add(reasons,`Stable recent playing time: ${round(m5)} minutes (L5 CV ${round(100*cv)}%).`);
  else if(m5<22)add(risks,`Limited recent playing time: ${round(m5)} minutes L5.`);
  if(cv!==null&&cv>.28)add(risks,`Minutes volatility is elevated (${round(cv*100)}% CV).`);
 }else add(checks,'Recent actual minutes missing; cannot assess rotation stability.');
 if(model){add(checks,`Independent projection: ${round(forecast)} ${stat} in ${round(pmin)} minutes; ${modelZ!==null&&modelZ>0?'supports':'does not support'} ${side}.`);
  if(modelZ!==null&&modelZ>=.30)add(reasons,`Independent projection supports ${side} (${round(forecast)} against ${line}).`);
  if(modelZ!==null&&modelZ<=-.35)add(risks,`Independent projection opposes ${side} (${round(forecast)} against ${line}).`);
 }else add(checks,'No independently matched projected output and minutes. Historical signals only.');
 if(dRaw!==null&&defense.available){if(dvpAmbiguous)add(checks,'Defense signal changes across possible positions; treated neutral until assignment verified.');
  else if(dRaw>=63)add(reasons,`${row.opponent||'Opponent'} position-specific defense favors ${side} (${round(dRaw)}/100${proxied?' estimated position':''}).`);
  else if(dRaw<=38)add(risks,`Opponent DvP is unfavorable for ${side} (${round(dRaw)}/100${proxied?' position estimate':''}).`);
 }else add(checks,'No supported exact-position DvP; treated neutral, not favorable.');
 if(!fresh)add(risks,'Exact standard prop line was not observed within two hours.');
 if(row.lineupStatus!=='confirmed')add(checks,'Starting role still unconfirmed; cannot label this bet-ready.');
 if(!row.injuryStatus)add(checks,'Fresh explicit injury/availability confirmation unavailable.');
 if(row.rest?.secondNight===true){score-=3;add(risks,'Back-to-back: possible role, minutes, or efficiency drag.');}
 const spread=String(row.latestOdds?.spreadText||'').match(/[-+]\d+(?:\.\d+)?/),spreadN=spread?Math.abs(Number(spread[0])):null;
 if(spreadN!==null&&spreadN>=11){score-=side==='MORE'?4:2;add(risks,'Double-digit spread introduces blowout/minutes risk.');}
 const lower=q(vals,.25),upper=q(vals,.75);
 const lowerFragile=side==='MORE'&&lower!==null&&lower<line-Math.max(.25,scale*.12);
 const upperFragile=side==='LESS'&&upper!==null&&upper>line+Math.max(.25,scale*.12);
 if(lowerFragile){score-=3;add(risks,`MORE lower-tail warning: 25th percentile ${round(lower)} sits below ${line}.`);}
 if(upperFragile){score-=3;add(risks,`LESS upper-tail warning: 75th percentile ${round(upper)} sits above ${line}.`);}
 // Known contradictions disqualify a directional shortlist; uncertainty does not masquerade as proof.
 const injury=String(row.injuryStatus||'');
 const unavailable=/^(out|doubtful|inactive|suspended)$/i.test(injury);
 const questionable=/questionable|game.?time|day.to.day/i.test(injury);
 const poorMinutes=m5!==null&&(m5<17||cv!==null&&cv>.40);
 const modelConflict=modelZ!==null&&modelZ<-.42;
 const historyConflict=z!==null&&z<-.50;
 const minuteConflict=pmin!==null&&(pmin<16||(m5!==null&&pmin<m5*.72));
 const trendConflict=change!==null&&change<-.24&&oppOpposes>=1;
 const comboConflict=['PRA','PR','PA','RA'].includes(stat)&&oppOpposes>=2&&oppSupports===0;
 const notAvailable=Boolean((Array.isArray(row.hard)&&row.hard.length)||row.state==='PASS'||unavailable||questionable);
 const avoid=notAvailable||!sign||line===null||!fresh||n<5||played<5||poorMinutes||minuteConflict||modelConflict||historyConflict||trendConflict||comboConflict||row.rotowire?.matchupMismatch===true;
 if(poorMinutes)add(risks,'Too few or highly unstable actual minutes for a reliable directional ranking.');
 if(modelConflict)add(risks,'Confirmed independent model direction is materially opposite.');
 if(avoid&&notAvailable)add(risks,'Official absence/uncertain availability or source hard veto.');
 if(avoid&&n<5)add(risks,'Fewer than five previous box-score outcomes.');
 const support=[z!==null&&z>=.22,smoothed!==null&&smoothed>=.55,change!==null&&change>=.065,dvpAmbiguous===false&&dRaw!==null&&dRaw>=64,pmin!==null&&modelZ!==null&&modelZ>=.28].filter(Boolean).length;
 const minuteReliable=(m5!==null&&m5>=24&&(cv===null||cv<.27))||(pmin!==null&&pmin>=26);
 const covered=[n>=7,change!==null,m5!==null,dRaw!==null,model,row.lineupStatus==='confirmed',Boolean(row.injuryStatus),fresh].filter(Boolean).length;
 const coverage=covered>=7?'HIGHER':covered>=4?'MODERATE':'LIMITED';
 let tier='PASS';
 if(!avoid&&support>=3&&minuteReliable&&score>=69&&(!model||modelZ>=.20)&&(!upperFragile||winRate!==null&&winRate>=.7)&&(!lowerFragile||winRate!==null&&winRate>=.7))tier='PRIORITY';
 else if(!avoid&&support>=2&&score>=58&&minuteReliable)tier='LEAN';
 else if(!avoid&&support>=1&&score>=52)tier='WATCH';
 // These are all research screens, never live wager approval. A no-model PRIORITY
 // can appear as historical priority but must remain unverified for betting.
 const eligible=tier!=='PASS';
 const status=tier==='PRIORITY'?'PRIORITY RESEARCH · VERIFY':tier==='LEAN'?'RESEARCH LEAN · VERIFY':tier==='WATCH'?'WATCHLIST · NOT APPROVED':'PASS — INSUFFICIENT OR CONTRADICTORY';
 const summary=eligible?`${side} research ${tier.toLowerCase()}: ${support} directionally supportive signals, ${coverage.toLowerCase()} source coverage. ${model?'Independent projection present.':'Independent projection still missing.'} No verified payout edge.`: 'No safe research ranking at the observed line; review contradictions, minutes and source freshness.';
 return {score:Math.round(clamp(score,10,90)),tier,eligible,status,summary,coverage,support,sourceCoverage:covered,components:Object.fromEntries(Object.entries(components).map(([k,v])=>[k,round(v)])),weights:W,median:med,minutesL5:m5===null?null:round(m5),minutesCV:cv===null?null:round(cv),win: wins,push:allPush,loss:resolved-wins,statSample:n,projectionMatched:!!model,upperQuartile:upper,lowerQuartile:lower,reasons:reasons.slice(0,8),risks:risks.slice(0,8),checks:checks.slice(0,8),lineFresh:fresh,method:'RFPP 2.7 directional research: median/volatility 24%, smoothed L10 14%, non-overlapping opportunity 18%, minutes 17%, sourced DvP 15%, independent projection 12%. Sources that are missing are neutral, not favorable. Extra tail, B2B and blowout penalties. Not calibrated P(win), profitability or bet-ready.'};
}
