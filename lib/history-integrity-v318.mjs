/** NBA Scout 3.18. Audits the exact *pregame* ESPN player source rows;
 * does not infer anything missing, replace source stats, or leak a same-day result.
 */
const keyName=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]/g,'').toLowerCase();
const statValue=(box,stat)=>{if(!box)return null;const x=k=>box[k]===null||box[k]===undefined||box[k]===''?null:Number.isFinite(Number(box[k]))?Number(box[k]):null;
 const single={PTS:'pts',REB:'reb',AST:'ast','3PM':'tpm',FGA:'fga','3PA':'tpa',FTM:'ftm'};if(single[stat])return x(single[stat]);
 if(stat==='2PM')return x('fgm')!==null&&x('tpm')!==null?x('fgm')-x('tpm'):null;
 const keys={PRA:['pts','reb','ast'],PR:['pts','reb'],PA:['pts','ast'],RA:['reb','ast']}[stat];if(!keys)return null;const values=keys.map(x);return values.some(v=>v===null)?null:values.reduce((a,b)=>a+b,0);};
const dChicago=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'});
const chicagoDay=x=>{const t=Date.parse(x||'');return Number.isFinite(t)?dChicago.format(new Date(t)):null;};
const n=x=>x===null||x===undefined||x===''||!Number.isFinite(Number(x))?null:Number(x);
const okPoints=b=>{const pts=n(b?.pts),fg=n(b?.fgm),threes=n(b?.tpm),ft=n(b?.ftm);return [pts,fg,threes,ft].some(v=>v===null)?null:pts===2*fg+threes+ft;};
/** This validates *internal* consistency and timing. It is NOT independent source corroboration. */
export function auditPlayerHistory({gameCache={},team,playerId=null,playerName='',stat='PTS',day}={}){
 const encountered=new Set(),usable=[],issues=[],unusable=[],sourceKinds=new Set();
 for(const g of Object.values(gameCache||{})){
  if(!g||!g.date||!Array.isArray(g.teams)||!g.teams.includes(team)||!Array.isArray(g.players))continue;
  const gd=chicagoDay(g.date);if(!gd||!day||gd>=day)continue;
  const p=g.players.find(x=>x.team===team&&(playerId!=null&&String(x.id)===String(playerId)||keyName(x.name)===keyName(playerName)));
  if(!p)continue;
  const id=String(g.id||''),key=id||g.date+'|'+g.teams.join('|');
  if(encountered.has(key)){issues.push({type:'DUPLICATE_GAME',gameId:id,date:gd});continue;}
  encountered.add(key);
  if(g.teams.length!==2||g.teams[0]===g.teams[1]||!g.teams.every(Boolean)){
   issues.push({type:'INVALID_GAME_TEAMS',gameId:id,date:gd});continue;
  }
  if(!p.played||!Number.isFinite(n(p.minutes))||n(p.minutes)<=0)continue;
  const value=statValue(p.box,stat);
  if(value===null){unusable.push({gameId:id,date:gd,reason:'Missing component stat for '+stat});continue;}
  if(value<0){issues.push({type:'NEGATIVE_STAT',gameId:id,date:gd});continue;}
  const box=p.box||{};
  if(n(box.fga)!==null&&n(box.fgm)!==null&&n(box.fgm)>n(box.fga) || n(box.tpa)!==null&&n(box.tpm)!==null&&n(box.tpm)>n(box.tpa)){
   issues.push({type:'INVALID_SHOOTING_TOTALS',gameId:id,date:gd});
  }
  const ptsCheck=okPoints(box);if(ptsCheck===false)issues.push({type:'POINTS_ARITHMETIC_MISMATCH',gameId:id,date:gd});
  usable.push({gameId:id,date:gd,opponent:g.teams.find(x=>x!==team),value,minutes:n(p.minutes),sourceKind:g.schemaVersion===1?'ESPN box-only':'ESPN summary/shot-log'});
  sourceKinds.add(g.schemaVersion===1?'BOX_ONLY':g.schemaVersion===2?'SHOT_LOG':'SCHEMA_UNVERIFIED');
 }
 usable.sort((a,b)=>b.date.localeCompare(a.date)||b.gameId.localeCompare(a.gameId));
 const r10=usable.slice(0,10),r20=usable.slice(0,20);
 return {source:'ESPN game box scores (pregame only, America/Chicago); internal arithmetic/timing audit, not independent third-party comparison',
  day,team,stat,playedWithStat:usable.length,last10:r10.length,last20:r20.length,last10Complete:r10.length===10,last20Complete:r20.length===20,
  gameLog:r20,unusable:unusable.slice(0,8),issues:issues.slice(0,12),issueCount:issues.length,missingStatCount:unusable.length,sourceKinds:[...sourceKinds],
  status:issues.length?'CHECK SOURCE':usable.length<5?'INSUFFICIENT GAMES':usable.length<10?'PARTIAL L10':'SOURCE ROWS CONSISTENT',
  warning:issues.length?'Some sourced box scores have arithmetic/team/duplicate inconsistencies. Verify these games before relying on historical rates.':
    usable.length<10?`Only ${usable.length} qualifying played game${usable.length===1?'':'s'} with this stat available before the slate.`:
    usable.length<20?`L10 has 10 games; L20 has only ${usable.length} available this season.`:null};
}
