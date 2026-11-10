/** Same-day source attribution for opportunity, never a licensed usage% metric.
 * A team's previous five completed (Chicago-local) game boxes are the sole input.
 * FGA share, AST share, rebound share are descriptive, NOT NBA usage%, potential
 * assists, rebound chances, on/off impacts, or projected possessions.
 */
const n=x=>x===null||x===undefined||x===''||!Number.isFinite(Number(x))?null:Number(x);
const name=x=>String(x||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/ig,'').toLowerCase();
const chicagoDate=x=>{const d=new Date(x);return Number.isFinite(d.getTime())?new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).format(d):null;};
const pct=x=>Math.round(1000*x)/10;
const r1=x=>Math.round(10*x)/10;
const total=(arr,key)=>arr.reduce((s,p)=>s+(n(p.box?.[key])||0),0);
/** One cached per-slate pass over ~150 game summaries, not a new HTTP request per prop. */
export function buildOffenseContext(gameCache, day){
 const byTeam=new Map();
 for(const g of Object.values(gameCache||{})){
  const d=chicagoDate(g?.date);
  if(!d||d>=day||!Array.isArray(g.players)||!Array.isArray(g.teams)||g.teams.length!==2)continue;
  for(const team of g.teams){if(!byTeam.has(team))byTeam.set(team,[]);byTeam.get(team).push(g);}
 }
 const out=new Map();
 for(const [team,all] of byTeam){
  const games=all.sort((a,b)=>Date.parse(a.date)-Date.parse(b.date)).slice(-5);
  if(games.length<3)continue;
  const samples=new Map();const sums={fga:0,ast:0,reb:0};
  for(const g of games){
   const teamPlayers=g.players.filter(p=>p.team===team&&p.played&&n(p.minutes)>0&&p.box);
   if(!teamPlayers.length)continue;
   for(const stat of ['fga','ast','reb'])sums[stat]+=total(teamPlayers,stat);
   for(const p of teamPlayers){
    const key=name(p.name);if(!key)continue;
    if(!samples.has(key))samples.set(key,{player:p.name,team,games:0,minutes:0,fga:0,fta:0,tpa:0,ast:0,reb:0,pts:0,fantasyPts:0,fantasyMins:0,fantasyGames:0});
    const a=samples.get(key);a.games++;a.minutes+=n(p.minutes)||0;
    for(const stat of ['fga','fta','tpa','ast','reb','pts'])a[stat]+=n(p.box[stat])||0;
    // Historical fantasy production under published NBA/FanDuel-style weights.
    // Only calculate when all six source stats are present, never assume zero.
    const categories=['pts','reb','ast','stl','blk','tov'].map(k=>n(p.box[k]));
    if(categories.every(v=>v!==null)){
     const [pts,reb,ast,stl,blk,tov]=categories;
     a.fantasyPts+=pts+1.2*reb+1.5*ast+3*stl+3*blk-tov;
     a.fantasyMins+=n(p.minutes)||0;a.fantasyGames++;
    }
   }
  }
  const ranked={};
  for(const stat of ['fga','ast','reb'])ranked[stat]=[...samples.values()].filter(p=>p.games>=3).sort((a,b)=>b[stat]-a[stat]).map(p=>name(p.player));
  for(const [key,a] of samples){
   const rank=stat=>{const i=ranked[stat].indexOf(key);return i<0?null:i+1};
   const share=stat=>sums[stat]>0?pct(a[stat]/sums[stat]):null;
   out.set(team+'|'+key,{team,player:a.player,sample:a.games,teamGames:games.length,
    fgaRank:rank('fga'),astRank:rank('ast'),rebRank:rank('reb'),
    fgaShare:share('fga'),astShare:share('ast'),rebShare:share('reb'),
    fgaPerGame:r1(a.fga/a.games),ftaPerGame:r1(a.fta/a.games),tpaPerGame:r1(a.tpa/a.games),
    astPerGame:r1(a.ast/a.games),rebPerGame:r1(a.reb/a.games),ptsPer36:a.minutes>0?r1(a.pts*36/a.minutes):null,
    fantasyPointsPerMinute:a.fantasyGames>=3&&a.fantasyMins>0?r1(a.fantasyPts/a.fantasyMins):null,
    fantasyGames:a.fantasyGames,
    source:'ESPN final player box scores · last five completed team games before slate; observed shot/assist/rebound shares NOT true usage% or chance tracking'});
  }
 }
 return out;
}
export function roleFor(context,team,player){return context?.get(team+'|'+name(player))||null;}
export function roleFact(role,stat){
 if(!role||role.sample<3)return {valid:false,topTwo:false,text:'No sufficient pregame team box-score sample to verify offensive responsibility.',source:'ESPN final NBA box scores'};
 const skill=stat==='REB'?'reb':stat==='AST'?'ast':stat==='RA'?'ast':'fga';
 const rank=role[skill+'Rank'],share=role[skill+'Share'];
 const action={fga:'field-goal attempts',ast:'credited assists',reb:'rebounds'}[skill];
 const fantasy=role.fantasyPointsPerMinute!==null?` Historical fantasy production ${role.fantasyPointsPerMinute} per played minute over ${role.fantasyGames} complete game boxes (PTS + 1.2 REB + 1.5 AST + 3 STL + 3 BLK - TO); NOT a projected fantasy score.`:' Historical fantasy points/min unavailable because steals, blocks or turnovers are incomplete.';
 const detail=`Last ${role.teamGames} team games: ${role.player} ranks ${rank==null?'unranked':'#'+rank} on ${role.team} in ${action}${share==null?'':` (${share}% of team ${action})`}. ${role.fgaPerGame} FGA, ${role.tpaPerGame} 3PA, ${role.ftaPerGame} FTA per played game. This is a box-score involvement proxy, not verified usage rate, touches, rebound chances or potential assists.${fantasy}`;
 return {valid:rank!==null,topTwo:rank!==null&&rank<=2,rank,share,text:detail,source:role.source};
}
