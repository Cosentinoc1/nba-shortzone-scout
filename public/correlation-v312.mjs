/** Same-game/ticket-risk display, not a covariance or joint-probability estimate. */
export function gameKey(row){const t=[String(row?.team||''),String(row?.opponent||'')].filter(Boolean).sort();return t.length===2?t.join('~'):null;}
export function describeSharedGames(row,selected=[]){
 const k=gameKey(row);if(!k)return '';
 const peers=selected.filter(x=>x!==row&&gameKey(x)===k);
 if(!peers.length)return '';
 const sameTeam=peers.filter(x=>x.team===row.team).length;
 return `${peers.length+1} picks in same game${sameTeam?`, ${sameTeam+1} on ${row.team}`:''} · shared pace/usage risk`;
}
