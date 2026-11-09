/** Explainable, source-labeled quick-read summaries for pregame NBA Scout props.
 * This is presentation/evidence composition, not a new betting probability model.
 * Never infer a positive injury minutes boost without independent role projection.
 */
import {gradeNewsZone} from './news-zone-v311.mjs';
import {auditMarket} from './market-gate-v312.mjs';
import {explainPlatformMove} from './line-movement-v312.mjs';
const n = x => x === null || x === undefined || x === '' || !Number.isFinite(Number(x)) ? null : Number(x);
const fmt = (x, digits=1) => n(x) === null ? 'unknown' : Number(x).toFixed(digits).replace(/\.0$/, '');
const key = s => String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/gi,'').toLowerCase();
const isOut = s => /^(out|inactive|suspended|doubtful)$/i.test(String(s||'').trim());
const caution = s => /questionable|game.?time|day.to.day/i.test(String(s||''));
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
const statScore = new Set(['PTS','PA','PR','PRA','FGA','FTM','2PM','3PM','3PA']);
const is3 = s => ['3PM','3PA'].includes(s);
const isCombo=s=>['PA','PR','PRA'].includes(s);
const positionGroup = pos => {
 const v=String(pos||'').toUpperCase().trim();
 if (/^(PG|SG|G)$/.test(v))return 'G';
 if (/^(SF|PF|F)$/.test(v))return 'F';
 if (/^C$/.test(v))return 'C';
 return null;
};
function timely(status,now){const t=Date.parse(status.updatedAt||'');return Number.isFinite(t)&&now-t>=-300000&&now-t<=36*3600000;}
function zoneByProp(row,zone){
 if(!statScore.has(row.stat))return {label:'ZONE CONTEXT',detail:`Shot-zone alignment does not directly establish ${row.stat} opportunities; role and stat-specific chances matter more.`,strength:'neutral',source:'ESPN reconstructed shooting zones'};
 if(!zone)return {label:'ZONE OPPORTUNITY',detail:'No qualifying player-versus-zone sample. Do not assume a favorable matchup.',strength:'unknown',source:'ESPN reconstructed shooting zones'};
 const share=n(zone?.threeShare);
 const type=share!==null?share>=.50?'perimeter-heavy':share<=.20?'inside/mid-range focused':'balanced shot mix':'shot mix unverified';
 const three=is3(row.stat);
 const z=three ? zone?.top3ZoneName : zone?.topZoneName;
 const attempts=three?n(zone?.top3ZoneFgaPerGame):n(zone?.topZonePlayerFgaPerGame);
 const volume=three?n(zone?.top3ZoneVolumeDeltaPP):n(zone?.topZoneVolumeDeltaPP);
 const efficiency=three?n(zone?.top3ZoneFgDeltaPP):n(zone?.topZoneFgDeltaPP);
 const volText=volume===null?'volume comparison unavailable':`${volume>=0?'+':''}${fmt(volume)} pp shot share allowed vs league`;
 const fgText=efficiency===null?'accuracy comparison unavailable':`${efficiency>=0?'+':''}${fmt(efficiency)} pp FG% allowed vs league`;
 const allowed=three && zone?.top3Zone!==zone?.topZone ? null : n(zone?.topZoneFgaAllowed);
 const allowedText=allowed===null?'':` ${Math.round(allowed)} classified opponent attempts allowed there;`;
 if(three && (n(zone?.threePAperGame)??0)<1){return {label:'3-POINT FIT',detail:`Only ${fmt(zone?.threePAperGame)} reconstructed 3PA/game; zone alignment is not a strong three-point volume signal.`,strength:'caution',source:'ESPN season shot coordinates'};}
 if(row.stat==='2PM' && ['left','right','above'].includes(zone?.topZone))return {label:'2-POINT FIT',detail:'Top shot-zone overlap is from three-point territory; not counted as evidence for two-point makes.',strength:'neutral',source:'ESPN reconstructed shooting zones'};
 const orient = row.side==='LESS'?'LESS':'MORE';
 let label = three?'3-POINT ZONE':isCombo(row.stat)?'SCORING COMPONENT':'SHOT-ZONE MATCHUP';
 let s = `${type}; ${z||'leading zone'}${attempts!==null?` (${fmt(attempts)} FGA/game)`:''}. Opponent:${allowedText} ${volText}; ${fgText}.`;
 if(isCombo(row.stat))s+=' Applies to the scoring component only, not the full combination.';
 if(row.stat==='FTM')s+=' Zone location does not directly predict free-throw attempts.';
 const fav = volume!==null&&efficiency!==null && (three ? (volume>0.7&&efficiency>0) : (volume>1&&efficiency>0));
 const oppose = volume!==null&&efficiency!==null && volume< -1.5 && efficiency< -2;
 if(orient==='LESS'){
  if(fav)s+=' Potential scoring resistance to LESS.';
  if(oppose)s+=' Zone environment may support LESS.';
 }else{
  if(fav)s+=' Volume and efficiency both align with MORE.';
  if(oppose)s+=' Both zone signals oppose MORE.';
 }
 return {label,detail:s,strength: fav?(orient==='MORE'?'support':'caution'):oppose?(orient==='LESS'?'support':'caution'):'mixed',source:'ESPN pregame shot coordinates, descriptive not projected attempts'};
}
function availability(row,context,rosters,now){
 const injuries=(context?.injuriesFetched?context.injuries:[])||[];
 const self=injuries.find(x=>x.team===row.team&&key(x.player)===key(row.player)&&timely(x,now));
 if(self && isOut(self.status))return {label:'AVAILABILITY',detail:`ESPN lists ${row.player} ${self.status.toUpperCase()} — do not use this prop.`,strength:'veto',source:'ESPN current injury report'};
 if(self && caution(self.status))return {label:'AVAILABILITY',detail:`ESPN lists ${row.player} ${self.status}; status must be resolved before using this prop.`,strength:'caution',source:'ESPN current injury report'};
 const player=(rosters?.[row.team]||[]).find(p=>String(p.id)===String(row.playerId)||key(p.name)===key(row.player));
 const ownGroup=positionGroup(row.lineupRole||player?.pos);
 const teammates=injuries.filter(x=>x.team===row.team&&key(x.player)!==key(row.player)&&isOut(x.status)&&timely(x,now));
 const sameRole=teammates.filter(x=>{const t=(rosters?.[row.team]||[]).find(p=>key(p.name)===key(x.player));return ownGroup&&positionGroup(t?.pos)===ownGroup;});
 const extra=sameRole.slice(0,2).map(x=>`${x.player} (${x.status})`).join(', ');
 const other=teammates.filter(x=>!sameRole.includes(x)).slice(0,1).map(x=>`${x.player} (${x.status})`).join(', ');
 const projected=n(row?.rotowire?.matched&&!row.rotowire?.matchupMismatch?row.rotowire?.projectedMinutes:null);
 const avg=n(row.minutes);
 const minute=projected!==null?`RotoWire projects ${fmt(projected)} min${avg!==null?` vs ${fmt(avg)} recent actual`:''}.`:`${avg!==null?`Recent actual ${fmt(avg)} min/game.`:'Recent minutes unknown.'} No independent minutes forecast.`;
 const role=row.lineupStatus==='confirmed'?'Confirmed starting role':row.lineupStatus==='expected'?'Expected starter (not confirmed)':'Starter/rotation not independently confirmed';
 let note='';
 if(extra)note=` ${extra} — same listed ${ownGroup} group unavailable; possible opportunity, NOT a verified minutes increase.`;
 else if(other)note=` ${other} unavailable; minutes redistribution has NOT been established.`;
 else note=context?.injuriesFetched?' No verified same-role teammate OUT signal.':' Injury feed unavailable; no teammate opportunity inference.';
 return {label:'MINUTES & INJURIES',detail:`${minute} ${role}.${note}`,strength:extra?'conditional':projected!==null?'supported':'unverified',source:projected!==null?'User-provided RotoWire projection + ESPN injury report':'ESPN historical minutes + current injury report'};
}
function historyFact(row){
 const rec=row.v2History?.hitRates||{};
 const l10=rec.last10||row.hit10||{};
 const w=n(l10.win),l=n(l10.loss),push=n(l10.push)||0,played=n(l10.sample);
 const resolved=w!==null&&l!==null?w+l:null;
 const perc=resolved>0?fmt(100*w/resolved,0)+'%':'—';
 const season=rec.season||{};
 const s=n(season.win),sl=n(season.loss),sp=n(season.push)||0;
 const l5=rec.last5||{};
 const mini=l5.win!=null&&l5.loss!=null?` Last 5: ${l5.win}W/${l5.loss}L${l5.push?`/${l5.push}P`:''}.`:'';
 const detail = resolved!==null && resolved>0 ? `At exact ${fmt(row.line)} ${row.stat} ${row.side}: ${w} wins / ${l} losses / ${push} pushes (${perc} of resolved) from ${played??resolved+push} recent games.${mini}${s!==null&&sl!==null?` Season ${s}W/${sl}L${sp?`/${sp}P`:''}.`:''}`:
  'Historical clearance at this exact line is unavailable; no inferred hit rate.';
 return {label:'EXACT-LINE HISTORY',detail,strength:resolved>=8&&w/resolved>=.7?'support':resolved>=5?'observed':'limited',source:'ESPN pregame game logs; observed rate, not predicted win probability'};
}
function roleStyle(row,zone){
 const h=row.v2History?.opportunity||{};
 const ml=n(h.minutesL5),mt=n(h.minutesL10);
 const fga=n(h.fgaL5),older=n(h.fgaL10);
 const tpa=n(h.tpaL5),old3=n(h.tpaL10);
 const isAssist=['AST','PA','PRA','RA'].includes(row.stat);
 const isRebound=['REB','PR','PRA','RA'].includes(row.stat);
 let fragments=[];
 if(fga!==null)fragments.push(`L5 ${fmt(fga)} FGA/game${older!==null?` vs L10 ${fmt(older)}`:''}`);
 if(tpa!==null && ['PTS','FGA','3PM','3PA','PA','PR','PRA','2PM'].includes(row.stat))fragments.push(`${fmt(tpa)} three-point attempts/game${old3!==null?` vs L10 ${fmt(old3)}`:''}`);
 if(zone?.threeShare!==undefined)fragments.push(`${fmt(100*zone.threeShare,0)}% of charted attempts from three`);
 if(isAssist)fragments.push('Potential assists/touches not in ESPN box scores');
 if(isRebound)fragments.push('Rebound chances not in ESPN box scores');
 if(ml!==null&&mt!==null&&mt>0&&Math.abs(ml/mt-1)>=.12)fragments.push(`minutes trend ${ml>mt?'+':''}${fmt(100*(ml/mt-1),0)}% vs L10`);
 if(!fragments.length)fragments.push('Attempts and role-specific tracking unavailable');
 return {label:'PLAYSTYLE & USAGE',detail:fragments.join(' · ')+'.',strength:'observed',source:'ESPN box score attempts + shot mix (not role projection)'};
}
export function explainQuickPick(row,{zone=null,context={},rosters={},games=[],now=Date.now()}={}){
 const hist=historyFact(row),opportunity=zoneByProp(row,zone),minutes=availability(row,context,rosters,now),style=roleStyle(row,zone);
 const start=(games||[]).find(g=>g.away===row.team||g.home===row.team);
 const gameStarted= start && (start.completed===true||['in','post'].includes(start.state)||Number.isFinite(Date.parse(start.tipoff||''))&&Date.parse(start.tipoff)<=now);
 const lineTime=Date.parse(row.observedAt||'');
 const lineCurrent=Number.isFinite(lineTime) && now-lineTime>=-300000 && now-lineTime<=120*60000;
 const ownCaution=minutes.strength==='veto'||minutes.strength==='caution';
 const research=row.researchRank||{};
 const ranked=['PRIORITY','LEAN','WATCH'].includes(research.tier)?research.tier:'WATCH';
 const status=gameStarted?'CLOSED · GAME STARTED':minutes.strength==='veto'?'PASS · INACTIVE':ownCaution?'HOLD · STATUS UNCERTAIN':!lineCurrent?'HOLD · RECHECK LINE':ranked==='PRIORITY'?'PRIORITY · FINAL CHECK':ranked==='LEAN'?'RESEARCH LEAN': 'WATCH · MORE EVIDENCE';
 const quality = status.startsWith('HOLD')||status.startsWith('PASS')||status.startsWith('CLOSED')?'hold':ranked==='PRIORITY'?'priority':ranked==='LEAN'?'lean':'watch';
 const allRisks=[];
 if(!lineCurrent)allRisks.push('Exact line was not observed within 2 hours; refresh the prop before considering it.');
 if(!start)allRisks.push('Game pairing could not be verified.');
 if(!row.rotowire?.matched)allRisks.push('No independent projected minutes or matching RotoWire projection in this board.');
 if(row.rotowire?.matchupMismatch)allRisks.push('RotoWire opponent does not match today’s game.');
 if(row.lineupStatus!=='confirmed')allRisks.push('Starting role is not confirmed.');
 if(minutes.strength==='conditional')allRisks.push('Teammate injury creates only a possible, unquantified role opening.');
 if(opportunity.strength==='caution')allRisks.push('Defensive zone fit works against this direction or lacks support.');
 if(ownCaution)allRisks.push('Player availability needs resolution before entry.');
 if(gameStarted)allRisks.push('Game already tipped; this is not a pregame actionable pick.');
 allRisks.push('Individual payout / sportsbook price / expected value are not verified.');
 const strongest=hist.strength==='support'?hist.detail.split(' from ')[0]:opportunity.strength==='support'?opportunity.detail.split('. ')[0]:style.detail.split(' · ')[0];
 return {version:'3.9-fast-pick',status,quality,score:n(research.score),
   oneLine:`${row.side} ${fmt(row.line)} ${row.stat} · ${strongest}.`,
   facts:[hist,opportunity,minutes,style],
   risks:[...new Set(allRisks)],
   checks:{lineFresh:lineCurrent,gameStarted:!!gameStarted,starterConfirmed:row.lineupStatus==='confirmed',injuriesSourced:Boolean(context.injuriesFetched),independentMinutes:Boolean(row.rotowire?.matched&&!row.rotowire?.matchupMismatch)},
   disclaimer:'Research shortlist only — the score is not a win probability or a guaranteed, priced betting edge.'};
}
export function enrichBoardQuickReads(board,{zoneReport=null,context={},rosters={},profiles=[],games=null,day=null,now=Date.now()}={}){
 const z=new Map();for(const g of zoneReport?.games||[])for(const c of g.candidates||[]){
  const k=[c.team,c.opponent,key(c.player)].join('|');z.set(k,c);
 }
 const wanted=new Set([...(board.candidates||[]),...(board.topMore||[]),...(board.topLess||[]),...(board.bottom10||[])].map(r=>[r.team,r.opponent,key(r.player),r.stat,r.side,r.line].join('|')));
 const rows=(board.all||[]).map(row=>{
  const id=[row.team,row.opponent,key(row.player),row.stat,row.side,row.line].join('|');
  if(row.researchRank?.eligible!==true&&!wanted.has(id))return row;
  const zone=z.get([row.team,row.opponent,key(row.player)].join('|'))||null;
  const upgraded={...row,...gradeNewsZone(row,{zone,context,rosters,profiles,day,now})};
  const quick=explainQuickPick(upgraded,{zone,context,rosters,games:games||board.games||[],now});
  const ng=upgraded.newsZone||{};
  const market=auditMarket(upgraded,{quotes:context.marketQuotes||[],now});
  quick.market=market;
  quick.facts.push(explainPlatformMove(upgraded,context.lineMovements||{}));
  quick.facts.push({label:'PRICE, LINE MOVEMENT & VALUE',detail:market.text+' There is no reliable historical line movement or independent fair-value quote until a sourced market feed is connected.',
    strength:market.status==='STALE LINE'?'caution':'unknown',source:market.source});
  if(market.status==='STALE LINE'){quick.status='HOLD · EXACT LINE STALE';quick.quality='hold';}
  quick.risks.push('Top 10 research score is not betting EV. Confirm the current payout and independently priced line before submitting.');
  if(ng.shot)quick.facts.push({label:'DEFENSIVE ZONE — RANKING GATE',detail:ng.shot.reason,
    strength:ng.shot.supported?'support':ng.shot.contradicted?'caution':'neutral',source:'ESPN date-isolated reconstructed zone data'});
  if((ng.flags||[]).length){
    quick.facts.push({label:'INJURY & NEWS SIGNALS',
      detail:ng.flags.map(f=>f.title+': '+f.detail).join(' | '),
      strength:ng.flags.some(f=>f.tone==='red')?'caution':ng.flags.some(f=>f.tone==='green')?'support':'conditional',
      source:[...new Set(ng.flags.map(f=>f.source+(f.at?' · '+f.at:'')))].join(' / ')});
  }
  if(ng.veto||ng.hold){quick.status=ng.veto?'PASS · PLAYER OUT':'HOLD · STATUS UNVERIFIED';quick.quality='hold';
    quick.risks.unshift('Same-day availability veto/hold: do not treat a prior-day report as confirmation.');}
  else if(upgraded.researchRank?.tier!=='PRIORITY'&&quick.status==='PRIORITY · FINAL CHECK'){
    quick.status=upgraded.researchRank?.tier==='LEAN'?'RESEARCH LEAN · ZONE GATE':'WATCH · ZONE GATE';
    quick.quality=upgraded.researchRank?.tier==='LEAN'?'lean':'watch';
  }
  quick.risks.unshift('Ranking adjustment '+(ng.adjustment>=0?'+':'')+ng.adjustment+' ordinal points for sourced injury/role and zone fit; not a win probability.');
  return {...upgraded,quickRead:quick};
 });
 const lookup=new Map(rows.map(r=>[[r.team,r.opponent,key(r.player),r.stat,r.side,r.line].join('|'),r]));
 const refresh=arr=>Array.isArray(arr)?arr.map(r=>lookup.get([r.team,r.opponent,key(r.player),r.stat,r.side,r.line].join('|'))||r):arr;
 return {...board,all:rows,candidates:refresh(board.candidates),topMore:refresh(board.topMore),topLess:refresh(board.topLess),top10More:refresh(board.top10More),top10Less:refresh(board.top10Less),bottom10:refresh(board.bottom10),unfavorable:refresh(board.unfavorable),bottom6:refresh(board.bottom6)};
}
