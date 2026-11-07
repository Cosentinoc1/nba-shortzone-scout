/**
 * NBA Scout v2.0 — evidence-gated research score (NOT a probability/EV).
 * Uses *only supplied* pregame measurements. Unavailable fields remain neutral
 * and are explicitly flagged; no inferred RotoWire, DvP, market or lineup data.
 * Video-inspired hypotheses are not trained weights. Track in frozen out-of-sample audits.
 */
const finite = x => x !== null && x !== undefined && x !== '' && Number.isFinite(Number(x));
const num = x => finite(x) ? Number(x) : null;
const clamp = (x, min, max) => Math.min(max, Math.max(min, x));
const round = (x, d=0) => Number(x.toFixed(d));
const avg = x => x.length ? x.reduce((a,b)=>a+b,0)/x.length : null;
const WEIGHTS = Object.freeze({minutesRole:30,projectionEdge:25,opportunity:20,matchup:10,form:10,environment:5});
const STATS = Object.freeze({
 PTS:{floor:3,variable:['fga','fta'],kind:'shots'},
 '2PM':{floor:1.5,variable:['fga'],kind:'shots'},
 FGA:{floor:2.5,variable:['fga'],kind:'shots'},
 FTM:{floor:1.5,variable:['fta'],kind:'shots'},
 '3PM':{floor:.85,variable:['tpa'],kind:'threes'},
 '3PA':{floor:1.8,variable:['tpa'],kind:'threes'},
 REB:{floor:1.8,variable:['reb'],kind:'rebounds'},
 AST:{floor:1.5,variable:['ast'],kind:'assists'},
 PRA:{floor:4.5,variable:['pts','reb','ast'],kind:'combo'},
 PR:{floor:3.6,variable:['pts','reb'],kind:'combo'},
 PA:{floor:3.6,variable:['pts','ast'],kind:'combo'},
 RA:{floor:2.7,variable:['reb','ast'],kind:'combo'},
});
const COMPONENTS={PRA:['pts','reb','ast'],PR:['pts','reb'],PA:['pts','ast'],RA:['reb','ast']};
const oriented = (x, side) => (side==='LESS'?-1:1)*x;
function rate(rows, attr){
 const a=rows.filter(r=>finite(r?.[attr])&&finite(r?.minutes)&&Number(r.minutes)>0);
 return a.length>=3?avg(a.map(r=>Number(r[attr])*36/Number(r.minutes))):null;
}
function directionOpportunity(hist, stat, side, projectedMinutes, tracking=null){
 const rows=Array.isArray(hist?.recent)?hist.recent:[];
 const r5=rows.slice(0,5),r10=rows.slice(0,10);
 const cfg=STATS[stat];if(!cfg)return {value:50,signals:[],missing:['Unknown stat opportunity basis']};
 // The site stores recent rows newest-first. Use each player's per-36 rate to avoid
 // treating more court time as an automatic per-minute skill increase.
 const cols=cfg.variable;
 const gains=cols.map(k=>{
  const a=rate(r5,k),b=rate(r10,k);
  return a!==null&&b!==null&&b>0?{stat:k,delta:clamp(a/b-1,-.35,.35)}:null;
 }).filter(Boolean);
 const missing=[];
 if(!gains.length)missing.push(`No comparable recent ${cols.join('/')} per-36 opportunity sample`);
 const change=gains.length?avg(gains.map(x=>x.delta)):0;
 const tSource=String(tracking?.source||'');
 const certified=Boolean(tracking?.verified&&tSource);
 let liveSignal=null;
 const pairs=({PTS:['fga','baselineFga'], '2PM':['fga','baselineFga'], FGA:['fga','baselineFga'],
 FTM:['fta','baselineFta'], '3PM':['tpa','baselineTpa'], '3PA':['tpa','baselineTpa'],
 REB:['reboundChances','baselineReboundChances'], AST:['potentialAssists','baselinePotentialAssists']});
 const pair=pairs[stat];
 if(pair&&certified){const today=num(tracking[pair[0]]),base=num(tracking[pair[1]]);
  if(today!==null&&base!==null&&base>0)liveSignal=clamp(today/base-1,-.35,.35);
 }
 const trendScore=50+oriented(change,side)*60;
 let score=clamp(trendScore,30,70);
 if(liveSignal!==null){score=clamp(.45*score+.55*(50+oriented(liveSignal,side)*62),20,80);}
 else if(certified&&pair)missing.push(`Tracking source ${tSource} has no verified ${pair[0]} vs ${pair[1]} comparison`);
 const signals=gains.map(x=>`${x.stat.toUpperCase()} per-36 change ${(100*x.delta).toFixed(0)}% (last 5 vs last 10)`);
 if(liveSignal!==null)signals.push(`Sourced ${pair[0]} opportunity ${round(liveSignal*100)}% vs baseline (${tSource})`);
 if(['AST','RA','PA','PRA'].includes(stat)&&!(certified&&num(tracking?.potentialAssists)!==null))missing.push('Potential assists and on-ball creation not verified (no NBA tracking feed)');
 if(['REB','PR','RA','PRA'].includes(stat)&&!(certified&&num(tracking?.reboundChances)!==null))missing.push('Rebound chances, opponents missed shots and lineup size not verified');
 if(['PTS','PA','PR','PRA','FTM'].includes(stat))missing.push('Usage/FTA/shot distribution requires live role check');
 if(cols.length>1){
  const n=cols.length;
  const support=gains.filter(x=>oriented(x.delta,side)>.04).length;
  const opposition=gains.filter(x=>oriented(x.delta,side)<-.04).length;
  if(support>=2)score=clamp(score+5,20,75);
  else if(opposition>=2)score=clamp(score-8,20,70);
  else missing.push(`Combined stat lacks two corroborating opportunity components (${support}/${n} recent component trends support)`);
  signals.push(`${support}/${n} component trends support the ${side} direction`);
 }
 // Independent minutes scale moves *total opportunity*, not per-minute ability.
 const typical=num(hist?.opportunity?.minutesL5),pm=num(projectedMinutes);
 if(pm!==null&&typical!==null&&typical>0){
  score=clamp(score+oriented(clamp(pm/typical-1,-.3,.3),side)*35,20,80);
  signals.push(`Independent minutes ${pm} vs recent ${typical}`);
 }
 return {value:round(score,1),signals,missing};
}
function seasonForm(hist,side){
 const r=hist?.hitRates?.last10;
 if(!r||!finite(r.win)||!finite(r.loss)||Number(r.win)+Number(r.loss)<3)return 50;
 // Shrink observed win rate toward 50% with 12 pseudo-observations.
 // Pushes are excluded from win/loss, but not treated as wins.
 const w=Number(r.win),l=Number(r.loss),p=(w+6)/(w+l+12);
 return round(clamp(50+(p-.5)*42,40,60),1);
}
function metricFromSource(source, key){return num(source?.[key]);}
/**
 * @param {object} args
 *  hist: existing pre-tipoff researchPlayer result.
 *  independent: optional explicitly identified projections {source,minutes,stat,roleVerified,injuryVerified, injuryStatus, statusObservedAt}
 *  dvp: optional verified {score,source,verified}, 0-100 stat-specific score for MORE orientation
 *  market: optional {lineVerified,offeredSideVerified,priceVerified,observedAt}
 *  environment: optional {score,source,verified}, 0-100 score already oriented for this prop side
 */
export function gradePropV2({prop,side,hist,zone=null,independent=null,dvp=null,market=null,environment=null,tracking=null,consensusProjections=[],now=Date.now()}={}){
 if(!prop||!['MORE','LESS'].includes(side)||!STATS[prop.stat]||!finite(prop.line)||Number(prop.line)<0)throw Error('Valid exact prop and direction required');
 const warnings=[],hard=[],missing=[],drivers=[];
 const lp=Number(prop.line),cfg=STATS[prop.stat];
 const observed=Date.parse(prop.observedAt||market?.observedAt||'');
 const age=Number.isFinite(observed)?Math.max(0,(now-observed)/60000):null;
 if(age===null)missing.push('Exact line observation time missing');
 else if(age>360)hard.push('Exact offered line is older than 6 hours');
 else if(age>120)warnings.push('Line observation is over 2 hours old');
 if(!market?.lineVerified)missing.push('Current exact line not independently rechecked');
 if(!market?.offeredSideVerified)missing.push('This precise MORE/LESS offer not confirmed in-app');
 if(!market?.priceVerified)missing.push('Sportsbook price, payout and vig not verified — no EV calculation');
 const boxCount=Number(hist?.boxscoreGames)||0;
 if(boxCount<5)hard.push('Fewer than five historical games with usable stats');
 const typical=num(hist?.opportunity?.minutesL5), prior=num(hist?.opportunity?.minutesL10);
 if(typical!==null&&typical<18)hard.push('Recent court time under 18 minutes per game');
 if(typical===null)missing.push('Historical recent minutes unavailable');
 const minutes=metricFromSource(independent,'minutes');
 const source=String(independent?.source||'');
 const verifiedMinutes=minutes!==null&&minutes>0&&minutes<=48&&source.length>=3;
 if(!verifiedMinutes)missing.push('Independent projected minutes not available or not sourced');
 if(!independent?.roleVerified)missing.push('Same-day starter/bench role not independently verified');
 const statusTime=Date.parse(independent?.statusObservedAt||'');
 if((independent?.roleVerified||independent?.injuryVerified)&&(!Number.isFinite(statusTime)||Math.abs(now-statusTime)>24*3600000))missing.push('Role/injury verification timestamp absent or older than 24h');
 if(!independent?.injuryVerified)missing.push('Same-day injury/availability not independently verified');
 if(independent?.injuryVerified&&/out|inactive|suspended|doubtful/i.test(independent?.injuryStatus||''))hard.push('Unavailable or doubtful player');
 if(verifiedMinutes&&minutes<16)hard.push('Independent projected minutes under 16');
 const l10=Array.isArray(hist?.recent)?hist.recent.map(r=>num(r.stat)).filter(x=>x!==null):[];
 const mean=num(hist?.projectedBaseline);
 if(mean===null)hard.push('No usable pre-slate baseline');
 const sampleSd=l10.length>=4?Math.sqrt(avg(l10.map(x=>(x-avg(l10))**2))):null;
 const scale=Math.max(cfg.floor,lp*.11,(sampleSd??0)*.85);
 let projection=mean,projSource='Historical box-score baseline only';
 const independentStat=metricFromSource(independent,'stat');
 const sourcedProjection=independentStat!==null&&source.length>=3;
 if(sourcedProjection){projection=independentStat;projSource=source}
 const dirGap=projection===null?null:oriented(projection-lp,side);
 let z=dirGap===null?0:clamp(dirGap/scale,-2.5,2.5);
 let projectionScore=projection===null?50:clamp(50+25*Math.tanh(z),22,78);
 if(!sourcedProjection){
  // Historical model's same-season gap is not a validated projection consensus.
  projectionScore=50+(projectionScore-50)*.6;
  missing.push('No sourced independent projection for this exact stat');
 }else{
  const hdir=mean===null?null:oriented(mean-lp,side);
  if(hdir!==null&&Math.sign(dirGap)!==Math.sign(hdir)&&Math.abs(dirGap)>scale*.3&&Math.abs(hdir)>scale*.3){
   warnings.push('Independent projection and historical baseline disagree');
  }
  if(dirGap!==null&&dirGap<=-scale*.30){
   warnings.push('Independent projection strongly opposes the selected direction');
  }
 }
 if(dirGap!==null&&Math.abs(dirGap)<scale*.18)warnings.push('Projection gap is too small compared with recent volatility');
 if(side==='LESS'&&(['PTS','REB','AST'].includes(prop.stat))&&lp<=({PTS:10,REB:3.5,AST:2.5}[prop.stat]))hard.push('Fragile low counting-stat LESS threshold');
 const roleStability=typical!==null&&prior!==null&&prior>0?clamp(typical/prior-1,-.35,.35):null;
 let minutesScore=50;
 if(verifiedMinutes&&typical!==null&&typical>0){
  const delta=clamp(minutes/typical-1,-.4,.4);
  minutesScore=clamp(50+oriented(delta,side)*52,29,71);
  drivers.push(`Minutes: projected ${minutes.toFixed(1)} (${source}) vs last-five ${typical.toFixed(1)}`);
 }else if(roleStability!==null){
  // Treat a stale recent-minute trend as WEAK evidence, never substitute for projection.
  minutesScore=clamp(50+oriented(roleStability,side)*14,45,55);
 }
 if(verifiedMinutes&&independent?.roleVerified&&independent?.injuryVerified&&/active|available|probable/i.test(independent?.injuryStatus||''))minutesScore=clamp(minutesScore+2,0,100);
 const corroborated=(Array.isArray(consensusProjections)?consensusProjections:[]).filter(x=>x?.source&&x.source!==source&&num(x?.stat)!==null);
 if(!corroborated.length)missing.push('No second independent projection for this exact stat');
 else if(sourcedProjection){
  const disagree=corroborated.some(x=>Math.abs(Number(x.stat)-projection)>Math.max(cfg.floor,lp*.12));
  if(disagree)warnings.push('Independent stat projections disagree beyond stat-specific tolerance');
 }
 const opp=directionOpportunity(hist,prop.stat,side,verifiedMinutes?minutes:null,tracking);
 missing.push(...opp.missing);
 drivers.push(...opp.signals);
 const formScore=seasonForm(hist,side);
 const zscore=num(zone?.score);
 const dvpScore=num(dvp?.score);
 const goodDvp=Boolean(dvp?.verified&&dvp?.source&&dvpScore!==null);
 let matchup=50;
 if(goodDvp&&zscore!==null&&['PTS','2PM','FGA','3PM','3PA'].includes(prop.stat))matchup=.7*dvpScore+.3*zscore;
 else if(goodDvp)matchup=dvpScore;
 else if(zscore!==null&&['PTS','2PM','FGA','3PM','3PA'].includes(prop.stat))matchup=50+(zscore-50)*.35;
 if(side==='LESS')matchup=100-matchup;
 if(!goodDvp)missing.push('Position-specific opponent DvP for this exact stat unverified');
 if(zscore===null&&['PTS','2PM','3PM','FGA','3PA'].includes(prop.stat))missing.push('Shooting-zone matchup unavailable');
 const envScore=environment?.verified&&finite(environment?.score)?clamp(Number(environment.score),0,100):50;
 if(!environment?.verified)missing.push('Pace, spread, blowout, rest and teammate opportunity not independently checked');
 const components={minutesRole:round(minutesScore,1),projectionEdge:round(projectionScore,1),opportunity:round(opp.value,1),matchup:round(matchup,1),form:round(formScore,1),environment:round(envScore,1)};
 const weighted=Object.entries(WEIGHTS).reduce((n,[k,w])=>n+components[k]*w/100,0);
 let score=round(clamp(weighted,0,100));
 if(sourcedProjection&&dirGap!==null&&dirGap<=-scale*.30)score=Math.min(score,52);
 // Unknown minutes/availability/projection is *not* proof of a great prop.
 if(!verifiedMinutes||!independent?.roleVerified||!independent?.injuryVerified)score=Math.min(score,63);
 if(!sourcedProjection)score=Math.min(score,67);
 if(age===null||age>120)score=Math.min(score,61);
 if(hard.length)score=Math.min(score,40);
 const quality=[
  [boxCount>=8,15],[age!==null&&age<=120,15],[verifiedMinutes,20],
  [Boolean(independent?.roleVerified&&independent?.injuryVerified),15],
  [sourcedProjection,10],[corroborated.length>0,5],[goodDvp,8],
  [Boolean(market?.lineVerified&&market?.offeredSideVerified&&market?.priceVerified),7],
  [Boolean(environment?.verified),5]
 ];
 const confidence=quality.reduce((s,[yes,w])=>s+(yes?w:0),0);
 if(hard.length)drivers.push('VETO: '+hard.join('; '));
 const state=hard.length?'PASS':missing.length?'PROVISIONAL':'REVIEW';
 return {score,state,confidence,components,weights:WEIGHTS,projection:projection===null?null:round(projection,1),projectionSource:projSource,
  gap:dirGap===null?null:round(dirGap,2),volatilityScale:round(scale,2),warnings,hard,missing:[...new Set(missing)],drivers,
  scoringVersion:'2.0-hypothesis',methodology:'Role/minutes 30%; sourced projection-vs-exact-line 25%; stat-specific opportunity 20%; DvP/shot zones 10%; shrunken recent hit rates 10%; game environment 5%. Missing data neutral and confidence-gated. Score is not P(win), EV, an independently approved wager, or an empirically fitted model.'};
}
