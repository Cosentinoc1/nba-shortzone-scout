/**
 * RFPP 2.1 — direction-aware statistical evidence screening.
 * Separate statistical separation from data readiness. These scores are
 * neither estimated win probabilities nor sportsbook expected value.
 */
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const finite=x=>x!==null&&x!==undefined&&x!==''&&Number.isFinite(Number(x));
const num=x=>finite(x)?Number(x):null;
const round=(x,d=1)=>finite(x)?Number(Number(x).toFixed(d)):null;
const FLOORS={PTS:3.2,REB:1.8,AST:1.5,'3PM':.8,PRA:4.5,PR:3.8,PA:3.8,RA:2.8,FTM:1.5,FGA:3,'3PA':2,'2PM':1.6};
const SHOTS=new Set(['PTS','3PM','3PA','FGA','2PM']);
function recentSd(row){
 const values=(row.v2History?.recent||[]).map(r=>num(r.stat)).filter(v=>v!==null);
 if(values.length<4)return null;
 const avg=values.reduce((s,v)=>s+v,0)/values.length;
 return Math.sqrt(values.reduce((s,v)=>s+(v-avg)**2,0)/values.length);
}
function shrinkRate(r){
 const win=num(r?.win),loss=num(r?.loss);
 return win!==null&&loss!==null&&win+loss>=4?(win+3)/(win+loss+6):null;
}
export function directionalEvidence(row,{defenseGrade=null,rotowire=null}={}){
 const side=row.side,less=side==='LESS',line=num(row.line)||0;
 const sample=Number(row.v2History?.boxscoreGames)||0;
 const margin=num(row.margin),scale=Math.max(FLOORS[row.stat]||2,recentSd(row)||0,line*.10);
 const z=margin===null?0:clamp(margin/scale,-3,3);
 const r10=shrinkRate(row.v2History?.hitRates?.last10||row.hit10);
 const season=shrinkRate(row.v2History?.hitRates?.season||row.hitSeason);
 const winRate=r10!==null&&season!==null?.70*r10+.30*season:(r10??season);
 const opportunity=num(row.v2?.components?.opportunity)??num(row.evidence?.opportunity)??50;
 // Require an actual numeric grade and named exact position; a partial/legacy mock
 // with available:true must NOT be treated as verified exact-position DvP.
 const exact=Boolean(defenseGrade?.available && defenseGrade.proxy===false &&
  ['PG','SG','SF','PF','C'].includes(String(defenseGrade.position||'').toUpperCase()) &&
  finite(defenseGrade.score) && finite(defenseGrade.lessScore));
 const estimate=Boolean(defenseGrade?.available&&defenseGrade?.proxy&&
  Array.isArray(defenseGrade.positionCandidates)&&finite(defenseGrade.score)&&finite(defenseGrade.lessScore));
 const dvp=(exact||estimate)?(less?defenseGrade.lessScore:defenseGrade.score):null;
 const shot=num(row.zoneScore);
 const shotMatch=shot!==null&&SHOTS.has(row.stat)?(less?100-shot:shot):null;
 const model=Boolean(rotowire?.matched&&num(rotowire.modelGap)!==null);
 const modelGap=model?Number(rotowire.modelGap):null;
 const modelZ=model?clamp(modelGap/scale,-3,3):null;
 const minDiff=num(rotowire?.minutesChangePct);
 const disagreement=model&&z*modelZ<0&&Math.abs(z)>=.30&&Math.abs(modelZ)>=.30;
 const parts={
  historical:margin===null?0:26*Math.tanh(z/1.2),
  recent:winRate===null?0:clamp((winRate-.5)*28,-10,10),
  opportunity:clamp((opportunity-50)*.28,-8,8),
  exactDvp:exact?clamp((dvp-50)*.17,-8.5,8.5):0,
  eligibilityDvp:estimate?clamp((dvp-50)*.065,-3.25,3.25):0,
  shotZone:!exact&&!estimate&&shotMatch!==null?clamp((shotMatch-50)*.07,-3.5,3.5):0,
  independent:model?16*Math.tanh(modelZ/1.2):0,
  minutes:model&&minDiff!==null?clamp((less?-1:1)*minDiff*.14,-5,5):0,
  disagreement:disagreement?-14:0
 };
 let score=50+Object.values(parts).reduce((a,b)=>a+b,0);
 if(sample<8)score=50+(score-50)*.78;
 if(sample<5||margin===null)score=50;
 score=Math.round(clamp(score,8,92));
 const historySupports=sample>=5&&z>=.40&&(winRate===null||winRate>=.52);
 const modelSupports=model&&modelZ>=.30&&!rotowire.unstableMinutes&&!rotowire.historyOpposes;
 const opposed=sample>=5&&z<=-.40;
 const modelOpposes=model&&modelZ<=-.30;
 let tier='NEUTRAL',label='NO CLEAR EDGE';
 if(disagreement||modelOpposes){tier='CONFLICT';label='HOLD · MODEL CONFLICT';}
 else if(score>=71&&historySupports&&modelSupports){tier='PRIORITY';label='PRIORITY '+side+' · VERIFY';}
 else if(score>=67&&historySupports){tier='PROMISING';label='PROMISING '+side+' · VERIFY';}
 else if(score>=59&&margin>0){tier='WATCH';label='WATCH '+side;}
 else if(opposed){tier='OPPOSED';label='NO · HISTORY OPPOSES '+side;}
 const strengths=[];
 if(margin!==null)strengths.push('Historical directional margin '+round(margin)+' ('+round(z,2)+' volatility units)');
 if(winRate!==null)strengths.push('Shrunken historical clearance '+round(winRate*100)+'% of resolved outcomes (not forecast)');
 if(exact)strengths.push('Sourced exact '+defenseGrade.position+' DvP '+round(dvp)+'/100');
 if(estimate)strengths.push('Published-position '+defenseGrade.positionCandidates.join('/')+' DvP ESTIMATE '+round(dvp)+'/100; source-backed eligibility, not game slot');
 if(model)strengths.push('RotoWire directional gap '+round(modelGap)+' ('+round(modelZ,2)+' volatility units)');
 const warnings=[];
 if(!exact)warnings.push(estimate?'Court matchup position unconfirmed; lower-weight published-position estimate used':'Exact PG/SG/SF/PF/C stat DvP unavailable; broad G/F/C is descriptive only');
 if(!model)warnings.push('Independent stat projection and projected minutes not loaded');
 if(disagreement)warnings.push('RotoWire projection conflicts with player history');
 if(rotowire?.unstableMinutes)warnings.push('Projected minutes differ materially from recent minutes');
 if(modelOpposes||opposed)warnings.push('One or more sources oppose this side');
 return {score,tier,label,hasModel:model,modelAgrees:modelSupports,exactDefense:exact,
  normalizedMargin:round(z,2),volatilityScale:round(scale,2),historicalClearance:winRate===null?null:round(winRate*100),
  components:Object.fromEntries(Object.entries(parts).map(([k,v])=>[k,round(v)])),
  strengths,warnings,readiness:model?'INDEPENDENT MODEL LOADED · FINAL VETO STILL REQUIRED':'HISTORY ONLY · INDEPENDENT CHECKS PENDING',
  method:'Stat-normalized historical gap, shrunken historical outcomes, recent measured opportunity, exact-position defense when sourced, and independent projection agreement. NOT a win probability.'};
}
