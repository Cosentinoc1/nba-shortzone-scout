'use strict';
const ZONES=['rim','paint','mid','left','right','above'];
const LABELS={rim:'Restricted Area',paint:'Paint (non-RA)',mid:'Mid-Range',left:'Left Corner 3',right:'Right Corner 3',above:'Above-the-Break 3'};
const clamp=(x,l,h)=>Math.max(l,Math.min(h,x));
function matchupGrade(player,defender,league,opts={}){
  if(!player||!defender||!league?.zones)return {eligible:false,reason:'Missing player or team profile'};
  if(player.team===defender.code)return {eligible:false,reason:'A team cannot face itself'};
  const attempts=ZONES.reduce((n,k)=>n+(Number(player.zones?.[k]?.fga)||0),0);
  if(attempts < (opts.minFga??30))return {eligible:false,reason:`Only ${attempts} FGA in the available sample (minimum ${opts.minFga??30})`,attempts};
  if((defender.attempts||0)<200)return {eligible:false,reason:'Defense zone sample below 200 opponent attempts',attempts};
  let edge=0, volume=0, conversion=0, covered=0;
  let contributions=[];
  for(const k of ZONES){
    const p=player.zones?.[k],dz=defender.zones?.[k],lz=league.zones[k];if(!p||!dz||!lz)continue;
    const fga=Number(p.fga)||0, fgm=Number(p.fgm)||0,w=fga/attempts;
    const defenseShare=Number(dz.share), baselineShare=Number(lz.share);
    const defenseFg=Number(dz.fg), baselineFg=Number(lz.fg);
    if(![defenseShare,baselineShare,defenseFg,baselineFg].every(Number.isFinite))continue;
    // Suppress noise from thin defensive shooting samples, especially corner threes.
    const dSample=Number(dz.fga)||0;
    const reliability=Math.sqrt(dSample/(dSample+45));
    const v=Math.tanh((defenseShare-baselineShare)/.055)*reliability;
    const c=Math.tanh((defenseFg-baselineFg)/.075)*reliability;
    const combined=.6*v+.4*c;
    edge+=w*combined;
    volume+=w*v;
    conversion+=w*c;
    covered+=w;
    contributions.push({zone:k,label:LABELS[k],fga,fgm,playerShare:w,playerFg:fga?fgm/fga:null,defenseShare,defenseFg,defenseFga:dSample,leagueShare:baselineShare,leagueFg:baselineFg,rankShare:dz.rank_share,rankFg:dz.rank_fg,zoneEdge:combined,contribution:w*combined});
  }
  if(covered<.95)return {eligible:false,reason:'Zone coverage incomplete',attempts};
  // Wide 25–75 matchup screening range; never interpreted as a win probability.
  const raw=clamp(50+48*edge,0,100);
  const reliability=clamp(Math.sqrt(attempts/100),.45,1)*clamp(Math.sqrt((defender.attempts||0)/600),.65,1);
  const score=Math.round(50+(raw-50)*reliability);
  const grade=score>=68?'A':score>=59?'B':score>=45?'C':score>=35?'D':'F';
  contributions.sort((a,b)=>b.contribution-a.contribution);
  return {eligible:true,score,grade,attempts,gp:player.gp||null,volumeSignal:volume,accuracySignal:conversion,edge,confidence:Math.round(reliability*100),contributions,topZone:contributions[0]?.zone,
   label:score>=59?'Favorable':score<=40?'Unfavorable':'Mixed',
   methodology:'60% defense shot-frequency deviation, 40% opponent FG%-allowed deviation, weighted by the player’s actual shot distribution; empirical sample-size damping; screening grade, NOT bet probability.'};
}
function rankings(players,defense,options={}){
  const all=defense.teams||[],byCode=Object.fromEntries(all.map(d=>[d.code,d]));
  const matchups=options.matchups||null;
  const out=[];
  for(const p of players){
    const opps=matchups?.[p.team]?[matchups[p.team]]:matchups?[]:all.map(d=>d.code).filter(x=>x!==p.team);
    for(const o of opps){const d=byCode[o];if(!d)continue;const g=matchupGrade(p,d,defense.league);if(g.eligible)out.push({player:p.name,team:p.team,position:p.pos||'',defense:o,playerId:p.id,...g})}
  }
  const asc=[...out].sort((a,b)=>a.score-b.score||b.attempts-a.attempts);
  const desc=[...out].sort((a,b)=>b.score-a.score||b.attempts-a.attempts);
  return {top:desc.slice(0,6),worst:asc.slice(0,6),eligibleCount:out.length,playerCount:new Set(out.map(x=>x.playerId)).size,coverageTeams:[...new Set(players.map(p=>p.team))].length};
}
module.exports={ZONES,LABELS,matchupGrade,rankings};
