/** Exact-line price/market coverage: never infer EV from a hit rate or a raw projection gap. */
const n=x=>x===null||x===undefined||x===''||!Number.isFinite(Number(x))?null:Number(x);
const name=x=>String(x||'').toLowerCase().replace(/[^a-z0-9]/g,'');
export function auditMarket(row,{quotes=[],now=Date.now()}={}){
 const observed=Date.parse(row?.observedAt||'');
 const lineFresh=Number.isFinite(observed)&&now-observed>=-300000&&now-observed<=75*60000;
 const candidates=(Array.isArray(quotes)?quotes:[]).filter(q=>{
  const t=Date.parse(q.observedAt||'');
  return name(q.player)===name(row.player)&&q.team===row.team&&q.stat===row.stat&&
   Number.isFinite(t)&&now-t>=-300000&&now-t<=60*60000&&Number.isFinite(Number(q.line))&&
   typeof q.book==='string'&&q.book.length>=2&&!/prizepicks/i.test(q.book);
 });
 const independentBooks=new Set(candidates.map(q=>q.book.toLowerCase()));
 const sameLine=candidates.filter(q=>n(q.line)===n(row.line));
 const matchingSides=sameLine.filter(q=>q.side===row.side&&n(q.americanOdds)!==null);
 const note=lineFresh?'Exact platform line observed recently.':'Exact platform line is stale or has no verified timestamp.';
 const quotesValid=matchingSides.filter(q=>n(q.americanOdds)>100||n(q.americanOdds)<-100);
 const sourceCount=new Set(quotesValid.map(q=>q.book.toLowerCase())).size;
 if(!lineFresh)return {status:'STALE LINE',edgeVerified:false,lineFresh:false,independentBooks:independentBooks.size,
  text:`${note} Refresh the exact PrizePicks standard line; do not rely on old quotes.`,source:'Current prop feed'};
 if(sourceCount<2)return {status:'MARKET NOT VERIFIED',edgeVerified:false,lineFresh:true,independentBooks:sourceCount,
  text:`${note} ${sourceCount} fresh independent book quotes at the SAME line/side. Need at least 2; payout and no-vig fair probability remain unknown. Historical hit rates and RotoWire gaps are not EV.`,source:'Current prop feed; independent bookmaker prices unavailable'};
 return {status:'QUOTE CHECK ONLY',edgeVerified:false,lineFresh:true,independentBooks:sourceCount,
  text:`${note} ${sourceCount} matching fresh independent prices, but no-vig probability and actual platform payout are NOT verified. No positive-EV claim.`,
  source:'Fresh independently sourced book quotes; payout still unverified'};
}
