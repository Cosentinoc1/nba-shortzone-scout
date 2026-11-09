#!/usr/bin/env python3
"""Idempotent v3.10 RotoWire importer hotfix for existing NBA Scout v3.9.
Only patches two known files, refusing unknown source instead of mangling it.
"""
from pathlib import Path


def change(path, old, new):
    p=Path(path);s=p.read_text(encoding='utf-8')
    if new in s:
        print(f'{path}: already patched')
        return
    n=s.count(old)
    if n!=1:
        raise RuntimeError(f'{path}: incompatible source; expected exactly one anchor, found {n}: {old[:115]}')
    p.write_text(s.replace(old,new,1),encoding='utf-8')
    print(f'{path}: patched')

r='lib/rotowire.mjs'
change(r,"import {directionalEvidence} from './edge-v3.mjs';", "import {directionalEvidence} from './edge-v3.mjs';\nimport {rotoTeam,rotoNameKey,buildRotoLookup,findRotoProjection,diagnoseRotoMatch} from './roto-match-v310.mjs';\nimport {rankResearchProp} from './research-rank-v27.mjs';")
change(r,'const team=normalizeTeam(raw.Team||raw.team);','const team=rotoTeam(raw.Team||raw.team);')
change(r,"opp:normalizeTeam(raw.OPP||raw.opp||'')","opp:rotoTeam(raw.OPP||raw.opp||'')")
change(r,"const id=team+':'+sig(name);","const id=team+':'+rotoNameKey(name);")
change(r,"const data=normalizeRotoProjections(rows),lookup=new Map(data.map(p=>[p.team+':'+sig(p.name),p]));", "const data=normalizeRotoProjections(rows),lookup=buildRotoLookup(data);\n const matchedPlayers=new Set(),matchedOffers=new Set();let normalizedNameMatches=0;")
change(r,"const p=lookup.get(r.team+':'+sig(r.player));if(!p){unmatched++;", "const found=findRotoProjection(lookup,r),p=found?.projection;if(!p){unmatched++;")
change(r,"if(p.opp&&p.opp!==r.opponent){wrongOpponent++;", "if(p.opp&&p.opp!==rotoTeam(r.opponent)){wrongOpponent++;")
change(r,"  matched++;\n  const minutes=p.MIN", "  matched++;if(found.method==='normalized')normalizedNameMatches++;\n  matchedPlayers.add(rotoTeam(r.team)+':'+rotoNameKey(r.player));matchedOffers.add(rotoTeam(r.team)+':'+rotoNameKey(r.player)+':'+r.stat+':'+r.line);\n  const minutes=p.MIN")
change(r,'  return {...r,score,v2,edge,recommendation,readiness:edge.readiness,grade:', '  const adjustedRow={...r,score,v2,edge,recommendation,readiness:edge.readiness,grade:')
change(r,"...(r.reasons||[])]};\n });", "...(r.reasons||[])]};\n  return {...adjustedRow,researchRank:rankResearchProp(adjustedRow,recommendation)};\n });")
change(r,"wrongOpponentDirections:wrongOpponent,source:'User-supplied RotoWire XLSX/CSV; estimates, not game confirmations'", "wrongOpponentDirections:wrongOpponent,uniquePlayersMatched:matchedPlayers.size,uniquePropsMatched:matchedOffers.size,normalizedNameMatches,...diagnoseRotoMatch({boardRows:board.all||[],projections:data,matched,wrongOpponent}),source:'User-supplied RotoWire XLSX/CSV; estimates, not game confirmations'")

ui='public/clean.js'
old="if(note){note.dataset.kind='ok';note.textContent=`${data.rotowireStatus?.playerRows||pack.rows.length} RotoWire players · ${Math.floor((data.rotowireStatus?.directionsMatched||0)/2)} matched props · Top 10 now requires forecast/history agreement`;}"
new="""if(note){const rs=data.rotowireStatus||{},matches=rs.uniquePropsMatched??Math.floor((rs.directionsMatched||0)/2);
   note.dataset.kind=matches?'ok':'warning';
   note.textContent=`${rs.playerRows??pack.rows.length} RotoWire players · ${matches} matched prop lines · ${rs.uniquePlayersMatched??0} players matched`+(rs.normalizedNameMatches?` · ${rs.normalizedNameMatches} name aliases reconciled`:'')+(rs.wrongOpponentDirections?` · ${rs.wrongOpponentDirections} opponent mismatches`:'')+(matches===0?` — ${rs.message||'Check the slate date, teams, and player names.'}`:' · RotoWire forecasts applied; lineups still require confirmation');}
""".rstrip('\n')
change(ui,old,new)
print('RotoWire matching hotfix v3.10: complete')
