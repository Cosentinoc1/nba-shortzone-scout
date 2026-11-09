/** Observational PrizePicks line-change ledger, process-local and strictly timestamped.
 * NOT sharp market movement, CLV, or evidence of positive expected value.
 */
const saved=new Map();
const n=x=>x===null||x===undefined||x===''||!Number.isFinite(Number(x))?null:Number(x);
const norm=x=>String(x||'').toLowerCase().replace(/[^a-z0-9]/g,'');
export function lineKey(row){return [row?.team,norm(row?.player),String(row?.stat||'').toUpperCase()].join('~');}
export function observePlatformLines(rows,day,now=Date.now()){
 const out={};
 if(!/^\d{4}-\d{2}-\d{2}$/.test(String(day||'')))return out;
 for(const row of (Array.isArray(rows)?rows:[])){
  const line=n(row.line),observedAt=Date.parse(row.observedAt||row.observed_at||'');
  if(line===null||line<0||!Number.isFinite(observedAt)||now-observedAt<-300000||now-observedAt>120*60000)continue;
  const id=day+'~'+lineKey(row),prev=saved.get(id);
  if(prev&&observedAt>prev.observedAt&&line!==prev.line){
   out[lineKey(row)]={from:prev.line,to:line,delta:Math.round((line-prev.line)*100)/100,
    fromObservedAt:new Date(prev.observedAt).toISOString(),toObservedAt:new Date(observedAt).toISOString(),
    source:'Observed platform feed only; not sharp-book market movement'};
  }
  if(!prev||observedAt>prev.observedAt)saved.set(id,{line,observedAt});
 }
 if(saved.size>12000)saved.clear();
 return out;
}
export function explainPlatformMove(row,lineMovements={}){
 const move=lineMovements[lineKey(row)];
 if(!move)return {label:'LINE MOVEMENT',strength:'unknown',detail:'No independently observed prior platform line change for this exact player and prop in the current process. Opening/closing line and sharp market movement are unknown.',source:'NBA Scout session ledger'};
 const worse=row.side==='MORE'?move.delta>0:move.delta<0;
 const better=row.side==='MORE'?move.delta<0:move.delta>0;
 return {label:'OBSERVED PLATFORM LINE MOVE',strength:worse?'caution':better?'conditional':'neutral',
  detail:`Observed ${move.from} → ${move.to} (${move.delta>0?'+':''}${move.delta}) for ${row.stat} between ${move.fromObservedAt} and ${move.toObservedAt}. ${worse?'The newer line is harder for this side.':better?'The newer line is easier for this side, but may reflect injuries or news.':'No directional conclusion.'} This does not establish a betting edge.`,source:move.source};
}
export function resetLineHistoryForTests(){saved.clear();}
