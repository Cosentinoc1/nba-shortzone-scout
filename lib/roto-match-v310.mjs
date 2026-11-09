/** Safe RotoWire/prop-board identity reconciliation. No fuzzy cross-player matching. */
import {keyName,normalizeTeam} from './model.mjs';

const ALIASES={BRO:'BKN',BRK:'BKN',BK:'BKN',NOR:'NOP',NO:'NOP',NOLA:'NOP',PHO:'PHX',GS:'GSW',GSW:'GSW',NY:'NYK',SA:'SAS',UTAH:'UTA',WSH:'WAS',CHO:'CHA',CHA:'CHA',PHX:'PHX'};
export function rotoTeam(raw){
 const s=String(raw??'').trim().toUpperCase().replace(/^(?:VS\.?\s+|V\.?\s+|AT\s+|@\s*)/, '').replace(/^[-@\s]+/,'');
 const match=/^([A-Z]{2,4})(?:[\s(]|$)/.exec(s);
 if(!match)return '';
 const code=ALIASES[match[1]]||match[1];
 const norm=normalizeTeam(code);
 return /^[A-Z]{3}$/.test(norm)?norm:'';
}
export function rotoNameKey(raw){
 let s=String(raw??'').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
 // RotoWire rendered exports can contain e.g. 'StevenS. Adams' or 'Steven S. Adams'.
 s=s.replace(/^([A-Za-z'\-]{2,})([A-Z])\.\s+(?=[A-Za-z])/, '$1 ');
 s=s.replace(/^([A-Za-z'\-]{2,})\s+[A-Z]\.\s+(?=[A-Za-z])/, '$1 ');
 s=s.replace(/\s*\((?:[A-Z]{2,3})\)\s*$/, '');
 s=s.replace(/(?:\s|\.)(?:Jr\.?|Sr\.?|II|III|IV|V)\s*$/i,'');
 return keyName(s);
}
export function buildRotoLookup(projections){
 const exact=new Map(),canonical=new Map();
 for(const p of projections){
  const team=rotoTeam(p?.team);
  const rawKey=team+':'+keyName(p?.name||'');
  const cleanKey=team+':'+rotoNameKey(p?.name);
  if(exact.has(rawKey))exact.set(rawKey,null);else exact.set(rawKey,p);
  if(canonical.has(cleanKey))canonical.set(cleanKey,null);else canonical.set(cleanKey,p);
 }
 return {exact,canonical};
}
export function findRotoProjection(lookup,row){
 const team=rotoTeam(row?.team),raw=team+':'+keyName(row?.player||'');
 const exact=lookup.exact.get(raw);
 if(exact)return {projection:exact,method:'exact'};
 const canonical=lookup.canonical.get(team+':'+rotoNameKey(row?.player));
 return canonical?{projection:canonical,method:'normalized'}:null;
}
export function diagnoseRotoMatch({boardRows=[],projections=[],matched=0,wrongOpponent=0}={}){
 const boardTeams=new Set(boardRows.map(x=>rotoTeam(x.team)).filter(Boolean));
 const rotoTeams=new Set(projections.map(x=>rotoTeam(x.team)).filter(Boolean));
 const overlap=[...boardTeams].filter(t=>rotoTeams.has(t)).sort();
 let message='RotoWire projections applied to matching players';
 if(matched===0&&overlap.length===0)message='No teams overlap this NBA slate. Check RotoWire Today vs Tomorrow and the selected game date before exporting.';
 else if(matched===0&&wrongOpponent>0)message=`${wrongOpponent} player/stat directions had the right team and name but a DIFFERENT opponent. The RotoWire export appears to be for a different slate; re-export for the selected game day.`;
 else if(matched===0)message=`Teams overlap (${overlap.join(', ')||'none'}), but no same-team player names could be linked. Check the export's NAME field and the date.`;
 else if(wrongOpponent>0)message=`${matched} matching directions; ${wrongOpponent} more had a different opponent and were excluded.`;
 return {boardTeamCount:boardTeams.size,rotoTeamCount:rotoTeams.size,overlapTeams:overlap,overlapTeamCount:overlap.length,issue:matched===0?'NO_MATCHES':wrongOpponent>0?'PARTIAL_OPPONENT_MISMATCH':null,message};
}
