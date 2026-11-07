/** RFPP 2.2: 12 independently traceable pregame signals; research only.
 * A stronger evidence score is NOT a probability, guaranteed hit, or positive EV.
 * Every adjustment is capped to guard against double counting.
 */
import {directionalEvidence} from './edge-v3.mjs';
const num=x=>x===null||x===undefined||x===''||!Number.isFinite(Number(x))?null:Number(x);
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
const median=a=>{if(!a.length)return null;const v=[...a].sort((x,y)=>x-y);return v.length%2?v[(v.length-1)/2]:(v[v.length/2-1]+v[v.length/2])/2};
const sd=a=>{if(a.length<4)return null;const m=mean(a);return Math.sqrt(mean(a.map(x=>(x-m)**2)))};
const round=(x,d=1)=>Number(x.toFixed(d));
const clampScore=x=>Math.round(clamp(x,8,92));
const sideSign=x=>x==='LESS'?-1:1;
const combo={PRA:['pts','reb','ast'],PR:['pts','reb'],PA:['pts','ast'],RA:['reb','ast']};
const statColumns={PTS:['fga','fta'],'3PM':['tpa'],'3PA':['tpa'],FGA:['fga'],FTM:['fta'],'2PM':['fga'],REB:['reb'],AST:['ast'],PRA:['pts','reb','ast'],PR:['pts','reb'],PA:['pts','ast'],RA:['reb','ast']};
const thresholds={PTS:1.7,REB:.7,AST:.7,'3PM':.4,PRA:2.8,PR:2.3,PA:2.3,RA:1.6,FTM:.5,FGA:1.2,'3PA':.7,'2PM':.4};
function per36(row,key){const minutes=num(row?.minutes),v=num(row?.[key]);return minutes&&v!==null?36*v/minutes:null;}
function trend(rows,col){
 const l5=rows.slice(0,5).map(x=>per36(x,col)).filter(x=>x!==null);
 const previous5=rows.slice(5,10).map(x=>per36(x,col)).filter(x=>x!==null);
 if(l5.length<3||previous5.length<3)return null;
 const a=mean(l5),b=mean(previous5);return b>0?clamp(a/b-1,-.65,.65):null;
}
function minutesStats(rows){const mins=rows.slice(0,10).map(r=>num(r.minutes)).filter(x=>x!==null);
 const recent=mins.slice(0,5);return {sample:mins.length,mean10:mean(mins),mean5:mean(recent),sd10:sd(mins),trend:mins.length>=8&&mean(mins.slice(5,10))>0?mean(recent)/mean(mins.slice(5,10))-1:null};}
function combinationTrend(rows,stat,sign){
 const parts=combo[stat];if(!parts)return null;
 const directions=parts.map(k=>trend(rows,k));if(directions.some(x=>x===null))return null;
 return {supported:directions.filter(x=>sign*x>.07).length,against:directions.filter(x=>sign*x<-.07).length,total:directions.length,
  changes:Object.fromEntries(parts.map((k,i)=>[k,round(directions[i]*100,1)]))};
}
export function enhancedEvidence(row,{defenseGrade=null,rotowire=null,rest=null,latestOdds=null}={}){
 const prev=directionalEvidence(row,{defenseGrade,rotowire});
 const side=row.side,sign=sideSign(side),stat=row.stat,line=num(row.line),h=row.v2History||{};
 const rows=(h.recent||[]).filter(x=>num(x.stat)!==null).slice(0,10);
 const values=rows.map(x=>num(x.stat));
 const stats=minutesStats(rows);
 const tweaks={},reasons=[],warnings=[...prev.warnings];
 // Robust median vs threshold: protects against a single 40-point outlier.
 const med=median(values);
 const observedSd=sd(values),spread=observedSd??Math.max(1,prev.volatilityScale||1);
 if(med!==null&&line!==null&&values.length>=7){
  const margin=sign*(med-line);
  tweaks.median=round(clamp(4*Math.tanh(margin/Math.max(.75,spread)), -4,4),1);
  reasons.push('L10 median '+round(med)+' vs '+line+' line');
 }
 // Lower variance is useful when the player's distribution genuinely supports
 // the side; a low SD alone is not evidence for MORE or LESS.
 if(spread&&num(row.margin)!==null&&values.length>=8){
  const win=values.filter(x=>sign*(x-line)>0).length;
  const tail=values.filter(x=>sign*(x-line)<=0).length;
  tweaks.tailRisk=round(clamp((win-tail)/values.length*3.2,-3.2,3.2),1);
  if(tail>=4)warnings.push(tail+'/10 recent games failed to clear this direction');
 }
 // Stat-specific measured opportunities: FGA/FTA/3PA or proxy production
 // per 36, compared strictly with PREVIOUS five rather than overlapping L10.
 const cols=statColumns[stat]||[];
 const histories=cols.map(k=>({key:k,change:trend(rows,k)})).filter(x=>x.change!==null);
 if(histories.length){
  const opportunity=mean(histories.map(x=>x.change));
  tweaks.volume=round(clamp(sign*opportunity*8,-4.2,4.2),1);
  reasons.push('Per-36 opportunity '+histories.map(x=>x.key.toUpperCase()+' '+(x.change>=0?'+':'')+Math.round(x.change*100)+'%').join(', ')+' vs prior five');
  if(['REB','AST','RA','PA','PR','PRA'].includes(stat))warnings.push('Box-score production is NOT rebound chances/potential assists');
 }else warnings.push('Insufficient non-overlapping L5/prior-L5 opportunity comparison');
 const cm=combinationTrend(rows,stat,sign);
 if(cm){
  tweaks.combo=cm.supported>=2?3:cm.against>=2?-4:0;
  reasons.push('Combo stat components: '+cm.supported+'/'+cm.total+' support '+side+'; '+cm.against+' oppose');
  if(cm.against>=2)warnings.push('Multiple components contradict the combined-stat direction');
 }
 // Stability is a reliability filter, not a directional win-probability boost.
 if(stats.sample>=8&&stats.mean10>0&&stats.sd10!==null){
  const cv=stats.sd10/stats.mean10;
  if(cv>.28){tweaks.roleVolatility=-4.5;warnings.push('Unstable historical minutes (CV '+round(cv*100,0)+'%)');}
  else if(cv<.09&&Math.abs(stats.trend||0)<.09){tweaks.roleVolatility=1;reasons.push('Stable minutes ('+round(stats.mean10)+'±'+round(stats.sd10)+' min)');}
 }
 // Independent RotoWire projected minutes can be used to evaluate whether the
 // line implies a realistic per-36 rate; never fabricate projected minutes.
 if(rotowire?.matched&&num(rotowire.projectedMinutes)>0&&line!==null){
  const required=36*line/rotowire.projectedMinutes;
  const playedRates=rows.map(r=>per36(r,'stat')).filter(x=>x!==null);
  const actual=median(playedRates);
  if(actual!==null&&playedRates.length>=5){
   const distance=sign*(actual-required),scale=Math.max(.75,sd(playedRates)||1);
   tweaks.rateRequired=round(clamp(5*Math.tanh(distance/scale),-5,5),1);
   reasons.push('Needed '+round(required)+' '+stat+' per 36 min to clear vs historic median '+round(actual));
  }
  if(rotowire.projectedMinutes<=20){tweaks.roleFloor=-4;warnings.push('Independently projected minutes at or under 20');}
 }
 // Same-season H2H is noisy. Tiny support only with >=3 prior opponent games.
 const hh=h.hitRates?.h2h;if(hh?.sample>=3){
  const resolved=(hh.win||0)+(hh.loss||0);
  if(resolved>=3){tweaks.h2h=round(clamp(((hh.win+1)/(resolved+2)-.5)*5,-1.5,1.5),1);
   reasons.push('H2H '+hh.win+'W/'+hh.loss+'L/'+(hh.push||0)+'P in '+hh.sample+' pregame games (low weight)');}
 }
 // Game environment is a caution, not double-counted as a huge scoring edge.
 if(rest?.secondNight===true){tweaks.b2b=-2.5;warnings.push('Second night of back-to-back');}
 const gameSpread=Number(String(latestOdds?.spreadText||'').match(/[-+]\d+(?:\.\d+)?/)?.[0]);
 if(latestOdds?.spreadText&&Number.isFinite(gameSpread)&&Math.abs(gameSpread)>=12){
  tweaks.blowout=side==='MORE'?-3.5:-1;warnings.push('Large spread may reduce predictable late-game minutes');
 }
 // Team game total is a very weak scoring-environment indicator; never
 // treat it as an individual points/assists/rebounds projection.
 const gameTotal=num(latestOdds?.total);
 if(gameTotal!==null&&gameTotal>=240){tweaks.gameTotal=side==='MORE'?1:-1;reasons.push('High game total '+gameTotal+' (small adjustment only)');}
 else if(gameTotal!==null&&gameTotal<=213){tweaks.gameTotal=side==='LESS'?1:-1;reasons.push('Low game total '+gameTotal+' (small adjustment only)');}
 const correction=clamp(Object.values(tweaks).reduce((s,v)=>s+v,0),-13,13);
 const score=clampScore(prev.score+correction);
 const baseTier=prev.tier;
 let tier='NEUTRAL',label='NO CLEAR EDGE';
 // Strong priorities demand actual HISTORICAL+MODEL agreement, not just a
 // high arbitrary score or a weak DvP rank. Evidence and readiness separate.
 if(baseTier==='CONFLICT'||rotowire?.historyOpposes||rotowire?.unstableMinutes){tier='CONFLICT';label='HOLD · CONFLICT';}
 else if(score>=74&&prev.modelAgrees&&num(row.margin)>0&&prev.historicalClearance>=51){tier='PRIORITY';label='PRIORITY '+side+' · FINAL VETO';}
 else if(score>=67&&num(row.margin)>0&&(prev.modelAgrees||prev.historicalClearance>=54)){tier='PROMISING';label='PROMISING '+side+' · VERIFY';}
 else if(score>=58&&num(row.margin)>0){tier='WATCH';label='WATCH '+side;}
 else if(num(row.margin)<0){tier='OPPOSED';label='NO · HISTORICAL OPPOSITION';}
 const sourceCount=[rows.length>=8,Boolean(rotowire?.matched),Boolean(defenseGrade?.available&&!defenseGrade.proxy),Boolean(latestOdds?.spreadText)].filter(Boolean).length;
 const readiness=rotowire?.matched?'RotoWire imported; lineup/injuries/pricing still need independent confirmation':'No current RotoWire projection: role and model agreement still pending';
 return {...prev,score,tier,label,readiness,sourceCount,
  normalizedMargin:prev.normalizedMargin,median10:med===null?null:round(med),minutesL10:stats.mean10===null?null:round(stats.mean10),
  statVolatility:observedSd===null?null:round(observedSd),extraComponents:tweaks,
  componentSupport:cm,additionalReasons:reasons, warnings:[...new Set(warnings)],
  method:'RFPP 2.2 directional evidence: normalized baseline gap; shrunken hit history; independent forecast/minutes; exact position DvP if sourced; recent shot/opportunity trends; median/outlier sensitivity; role-minute stability; combined-stat corroboration; small-weight H2H/rest/spread. Unverified tracking stays neutral. NOT a win probability.'};
}
