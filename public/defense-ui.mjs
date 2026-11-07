/** Browser + Node: explains sourced DvP from the pick's chosen direction.
 * A strong LESS matchup is the opposite of a strong MORE matchup.
 * Values describe opponent position allowance, not player hit probability.
 */
const numeric=x=>x!==null&&x!==undefined&&x!==''&&Number.isFinite(Number(x));
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const letterFor=x=>x>=80?'A':x>=68?'B':x>=53?'C':x>=40?'D':'F';
export function defenseView(defense,direction='MORE') {
 const side=direction==='LESS'?'LESS':'MORE';
 const raw=side==='LESS'?defense?.lessScore:defense?.score;
 if (!defense?.available||!numeric(raw)||Number(raw)<0||Number(raw)>100) return {
  available:false,side,score:null,scoreText:'—',letter:'—',verdict:'Not enough reliable data',tone:'missing',
  sourceLabel:'Matchup not scored',sourceQuality:'Unavailable',rangeText:'',oppositeText:'',
  explanation:'The model has no supported defensive grade for this player, prop, and possible position. It is not a neutral or favorable matchup.',
  caution:defense?.reason||'Needs a supported position and stat-specific opposing defense sample.'
 };
 const score=Math.round(clamp(Number(raw),0,100));
 const letter=letterFor(score);
 const verdict=score>=80?'Very favorable':score>=68?'Favorable':score>=53?'Mixed':score>=40?'Unfavorable':'Very unfavorable';
 const tone=score>=68?'good':score>=53?'mixed':'bad';
 const positions=Array.isArray(defense.positionCandidates)?defense.positionCandidates.filter(x=>/^(PG|SG|SF|PF|C)$/.test(String(x))):[];
 const isEstimate=Boolean(defense.proxy&&positions.length);
 const sourceLabel=isEstimate?'Position estimate · '+positions.join('/'):(defense.position?'Single-position data · '+defense.position:'Sourced position comparison');
 const stat=String(defense.stat||'this stat');
 const allowance=side==='LESS'?(tone==='good'?'tends to limit':'does not strongly limit'):(tone==='good'?'tends to allow':'does not especially allow');
 const explanation=tone==='mixed'
  ?'The defense does not give a clear advantage to '+side+' for '+stat+'.'
  :`The opposing defense ${allowance} ${stat} for these positions; that ${tone==='good'?'supports':'works against'} ${side}.`;
 const r=defense.range?.[side==='LESS'?'less':'more'];
 const rangeText=isEstimate&&Array.isArray(r)&&r.length===2&&r.every(numeric)?`Possible-position scores ${Math.round(Number(r[0]))}–${Math.round(Number(r[1]))}/100`:'';
 const other=side==='LESS'?defense.score:defense.lessScore;
 const oppositeText=numeric(other)?`${side==='LESS'?'MORE':'LESS'} ${Math.round(Number(other))}/100`:'';
 return {available:true,side,score,scoreText:`${score}/100`,letter,verdict, tone,sourceLabel,rangeText,oppositeText,
  sourceQuality:isEstimate?'Published fantasy eligibility; game-day position unconfirmed':'Single-position defensive data; actual defender assignment unconfirmed',
  explanation,caution:isEstimate?(rangeText+'. Confirm the role before betting; the average blends eligible positions.'): 'This is a stat-by-position trend, not a guarantee the same defender guards the player.'};
}
