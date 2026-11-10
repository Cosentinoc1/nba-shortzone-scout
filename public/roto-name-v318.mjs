/** No fuzzy cross-player matching: exact team + unambiguous name or suffix/initial canonical identity. */
const aliases={BRO:'BKN',BRK:'BKN',BK:'BKN',NOR:'NOP',NO:'NOP',NOLA:'NOP',PHO:'PHX',GS:'GSW',NY:'NYK',SA:'SAS',UTAH:'UTA',WSH:'WAS',CHO:'CHA'};
export function cleanTeam(value){const raw=String(value??'').trim().toUpperCase().replace(/^(?:VS\.?\s+|V\.?\s+|AT\s+|@\s*)/,'').replace(/^[-@\s]+/,'');const m=/^([A-Z]{2,4})(?:[\s(]|$)/.exec(raw);return m?(aliases[m[1]]||m[1]):'';}
const simpleKey=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/gi,'').toLowerCase();
export function cleanPlayer(value){let s=String(value??'').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'');s=s.replace(/^([A-Za-z'\-]{2,})([A-Z])\.\s+(?=[A-Za-z])/,'$1 ');s=s.replace(/^([A-Za-z'\-]{2,})\s+[A-Z]\.\s+(?=[A-Za-z])/,'$1 ');s=s.replace(/\s*\((?:[A-Z]{2,3})\)\s*$/,'');s=s.replace(/(?:\s|\.)(?:Jr\.?|Sr\.?|II|III|IV|V)\s*$/i,'');return simpleKey(s);}
export function findClientProjection(rows,team,player){const desiredTeam=cleanTeam(team),desiredName=cleanPlayer(player),rawName=simpleKey(player);
 const eligible=(rows||[]).filter(r=>cleanTeam(r?.Team||r?.team)===desiredTeam);
 const exact=eligible.filter(r=>simpleKey(r?.NAME||r?.name)===rawName);
 if(exact.length===1)return exact[0];if(exact.length>1)return null;
 const normalized=eligible.filter(r=>cleanPlayer(r?.NAME||r?.name)===desiredName);
 return normalized.length===1?normalized[0]:null;
}
export function safeProjectionStat(p,stat){if(!p)return null;const map={PTS:['PTS'],REB:['REB'],AST:['AST'],FGA:['FGA'],'3PA':['3PA'],'3PM':['3PM'],FTM:['FTM'],PRA:['PTS','REB','AST'],PR:['PTS','REB'],PA:['PTS','AST'],RA:['REB','AST'],'2PM':['FGM','3PM']};const keys=map[stat];if(!keys)return null;
 const values=keys.map(k=>p[k]===null||p[k]===undefined||p[k]===''?null:Number(p[k]));if(values.some(x=>x===null||!Number.isFinite(x)))return null;
 return stat==='2PM'?values[0]-values[1]:values.reduce((a,b)=>a+b,0);
}
