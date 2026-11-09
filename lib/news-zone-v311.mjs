/** RFPP 3.11 pregame role/news/zone evidence overlay.
 * Adjustments are transparent, ordinal research points, never P(win).
 */
const N=x=>x===null||x===undefined||x===''||!Number.isFinite(Number(x))?null:Number(x);
const norm=x=>String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/gi,'').toLowerCase();
const clamp=(v,lo,hi)=>Math.min(hi,Math.max(lo,v));
const fmt=x=>N(x)===null?'unknown':N(x).toFixed(1).replace(/\.0$/,'');
const chicago=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'});
const gameDay=ts=>{const d=new Date(ts);return Number.isFinite(d.valueOf())?chicago.format(d):null;};
const isOut=x=>/^(out|doubtful|inactive|suspended)$/i.test(String(x||'').trim());
const isUncertain=x=>/questionable|game.?time|day.to.day/i.test(String(x||''));
const group=pos=>{const p=String(pos||'').toUpperCase().trim();return /^(PG|SG|G)$/.test(p)?'G':/^(SF|PF|F)$/.test(p)?'F':p==='C'?'C':null;};
const shotStats=new Set(['PTS','FGA','3PM','3PA','2PM','PA','PR','PRA']);
const combo=new Set(['PA','PR','PRA']);
function classifyZone(row,z){
 if(!shotStats.has(row.stat))return {status:'NOT APPLICABLE',points:0,supported:false,contradicted:false,reason:'Shot zones do not measure assist or rebound chances; use position-specific defense and role.',sample:null};
 if(!z)return {status:'UNVERIFIED',points:0,supported:false,contradicted:false,reason:'No sampled player/defense-zone overlap for this matchup.',sample:null};
 const three=['3PM','3PA'].includes(row.stat),attemptStat=['FGA','3PA'].includes(row.stat);
 const v=N(three?z.top3ZoneVolumeDeltaPP:z.topZoneVolumeDeltaPP),f=N(three?z.top3ZoneFgDeltaPP:z.topZoneFgDeltaPP);
 const a=N(three?z.top3ZoneFgaAllowed:z.topZoneFgaAllowed),name=three?z.top3ZoneName:z.topZoneName;
 if(a===null||a<60)return {status:'SMALL SAMPLE',points:0,supported:false,contradicted:false,sample:a,
  reason:`${name||'Main zone'} has ${a===null?'unverified':a} opponent attempts. Do not use a thin FG% as a strong edge.`};
 if(v===null||(!attemptStat&&f===null))return {status:'UNVERIFIED',points:0,supported:false,contradicted:false,sample:a,reason:'Zone comparison unavailable.'};
 const permissive=attemptStat?v>=1.5:v>=1.5&&f>=2;
 const restrictive=attemptStat?v<=-1.5:v<=-1.5&&f<=-2;
 const supported=row.side==='MORE'?permissive:restrictive;
 const contradicted=row.side==='MORE'?restrictive:permissive;
 const k=combo.has(row.stat)?.5:1,points=Math.round((supported?8:contradicted?-9:0)*k);
 return {status:permissive?'PERMISSIVE':restrictive?'RESTRICTIVE':'MIXED',points,supported,contradicted,sample:a,
   reason:`${name||'Main zone'}: allowed shot share ${v>=0?'+':''}${fmt(v)} pp vs NBA; opponent FG% ${f===null?'unknown':(f>=0?'+':'')+fmt(f)+' pp vs NBA'} (${a} attempts). ${supported?'Supports':contradicted?'Opposes':'Does not clearly support'} ${row.side}.${combo.has(row.stat)?' Applies ONLY to the scoring component.':''}`};
}
function shotAttemptsPerGame(p){const gp=N(p?.gp);return gp&&gp>=4?['rim','paint','mid','left','right','above'].reduce((a,z)=>a+(N(p.zones?.[z]?.fga)||0),0)/gp:null;}
function isFreshForDate(entry,day,now){const t=Date.parse(entry?.updatedAt||'');return Number.isFinite(t)&&gameDay(t)===day&&now-t>=-300000&&now-t<=30*3600000;}
export function gradeNewsZone(row,{zone=null,context={},rosters={},profiles=[],now=Date.now(),day=gameDay(now)}={}){
 const injuries=context.injuriesFetched?(context.injuries||[]):[];
 const playerInjury=injuries.find(e=>e.team===row.team&&norm(e.player)===norm(row.player));
 const flags=[],src='ESPN NBA injury report';
 const current=isFreshForDate(playerInjury,day,now);
 let veto=false,hold=false,injuryAdjustment=0,confirmedOpportunity=false;
 if(playerInjury&&isOut(playerInjury.status)){
  if(current){veto=true;flags.push({tone:'red',title:'OUT — REMOVE PROP',detail:`${row.player}: ${playerInjury.status}; ${playerInjury.reason||'no reason supplied'}.`,source:src,url:'https://www.espn.com/nba/injuries',at:playerInjury.updatedAt});}
  else {hold=true;flags.push({tone:'red',title:'OUT REPORT NOT CURRENT FOR THIS GAME',detail:'Previous injury report is not enough to declare this player OUT today. Recheck game-specific availability.',source:src,url:'https://www.espn.com/nba/injuries',at:playerInjury.updatedAt});}
 }else if(playerInjury&&isUncertain(playerInjury.status)){
  hold=true;flags.push({tone:'red',title:'QUESTIONABLE — HOLD',detail:`${row.player}: ${playerInjury.status}. Verify updated availability.`,source:src,url:'https://www.espn.com/nba/injuries',at:playerInjury.updatedAt});
 }
 const roster=rosters[row.team]||[],self=roster.find(p=>norm(p.name)===norm(row.player));
 const selfGroup=group(row.lineupRole||self?.pos);
 const outs=injuries.filter(e=>e.team===row.team&&norm(e.player)!==norm(row.player)&&isOut(e.status)&&isFreshForDate(e,day,now));
 const related=outs.map(e=>{
  const teammate=roster.find(p=>norm(p.name)===norm(e.player));
  const profile=profiles.find(p=>p.team===row.team&&norm(p.name)===norm(e.player));
  const fga=shotAttemptsPerGame(profile);
  return {...e,sameGroup:Boolean(selfGroup&&selfGroup===group(teammate?.pos)),highVolume:fga!==null&&fga>=12,fga};
 }).filter(e=>e.sameGroup||e.highVolume).sort((a,b)=>Number(b.highVolume)-Number(a.highVolume));
 const absence=related[0]||null,rw=row.rotowire||{};
 const forecast=rw.matched&&!rw.matchupMismatch?N(rw.projectedMinutes):null;
 const base=N(row.minutes),change=forecast!==null&&base!==null?forecast-base:null;
 if(absence){
  const info=`${absence.player} OUT${absence.highVolume?` (${fmt(absence.fga)} FGA/game primary-volume scorer)`:''}. ${change!==null?`RotoWire minutes ${fmt(forecast)} vs recent ${fmt(base)} (${change>=0?'+':''}${fmt(change)})`:'No corroborated minutes change'}.`;
  if(change!==null&&change>=3){
   confirmedOpportunity=row.lineupStatus==='confirmed';
   injuryAdjustment=row.side==='MORE'?(confirmedOpportunity?absence.highVolume?11:9:absence.highVolume?7:5):-11;
   flags.push({tone:row.side==='MORE'?'green':'red',title:confirmedOpportunity?'OUT + CONFIRMED STARTER + MINUTES INCREASE':'OUT + PROJECTED MINUTES INCREASE',detail:info,source:src+'; user-provided RotoWire minutes',url:'https://www.espn.com/nba/injuries',at:absence.updatedAt});
  }else{
   flags.push({tone:'amber',title:'INJURY OPENING — NEEDS ROLE CONFIRMATION',detail:info+' No automatic bonus for an absence without a corroborated opportunity increase.',source:src,url:'https://www.espn.com/nba/injuries',at:absence.updatedAt});
  }
 }
 if(change!==null&&change<=-3){injuryAdjustment-=row.side==='MORE'?8:0;flags.push({tone:'red',title:'PROJECTED MINUTES DOWN',detail:`RotoWire ${fmt(forecast)} vs recent ${fmt(base)} minutes.`,source:'User-uploaded RotoWire',url:null,at:null});}
 const headlines=(context.news||[]).filter(a=>norm(a.headline).includes(norm(row.player))||(a.players||[]).some(x=>norm(x)===norm(row.player))).slice(0,2);
 for(const a of headlines)flags.push({tone:/out|injur|sidelined|restriction|questionable/i.test(a.headline)?'red':/return|active|start/i.test(a.headline)?'green':'amber',title:'NEWS — VERIFY IMPLICATION',detail:a.headline,source:'ESPN NBA news',url:a.url||null,at:a.publishedAt||null});
 const shot=classifyZone(row,zone);
 const adjustment=clamp(injuryAdjustment+shot.points,-20,17);
 const old=row.researchRank||{};let tier=old.tier||'PASS';
 if(veto||hold)tier='PASS';
 else if(shotStats.has(row.stat)){
  if(shot.contradicted&&['LEAN','PRIORITY'].includes(tier))tier='WATCH';
  else if(shot.status!=='PERMISSIVE'&&shot.status!=='RESTRICTIVE'&&tier==='PRIORITY')tier='LEAN';
 }
 const score=clamp(Math.round((N(old.score)??50)+(veto||hold?Math.min(adjustment,0):adjustment)),10,90);
 if(tier==='PRIORITY'&&score<65)tier='LEAN';
 if(tier==='LEAN'&&score<54)tier='WATCH';
 const eligible=tier!=='PASS'&&old.eligible===true&&!veto&&!hold;
 const status=tier==='PRIORITY'?'PRIORITY RESEARCH · VERIFY':tier==='LEAN'?'RESEARCH LEAN · VERIFY':tier==='WATCH'?'WATCHLIST · NOT APPROVED':'PASS — AVAILABILITY OR CONFLICT';
 const researchRank={...old,score,tier,status,eligible,newsZoneAdjustment:adjustment,
  summary:`${status}. Zone/injury adjustment ${adjustment>=0?'+':''}${adjustment} ordinal points; NOT a win %.`,
  reasons:[...(old.reasons||[]),...flags.filter(f=>f.tone==='green').map(f=>f.title+': '+f.detail),...(shot.supported?[shot.reason]:[])].slice(0,10),
  risks:[...(old.risks||[]),...flags.filter(f=>f.tone==='red').map(f=>f.title+': '+f.detail),...(shot.contradicted?[shot.reason]:[])].slice(0,10),
  checks:[...(old.checks||[]),...flags.filter(f=>f.tone==='amber').map(f=>f.title+': '+f.detail)].slice(0,10)};
 return {researchRank,state:veto||hold?'PASS':row.state,newsZone:{flags,shot,adjustment,injuryAdjustment,
   confirmedOpportunity,teammateOut:absence?.player||null,veto,hold,sourceAsOf:context.updatedAt||null,
   note:'Game-day ESPN reports and uploaded RotoWire minutes; descriptive zone ranks are not a winning probability.'}};
}
