/** Transparent 30-team zone ranks. Rank 1 always means MOST allowed.
 * Total FGA are not ranked because teams can have played different game counts.
 * Share is comparable by team; accuracy ranks require at least 60 shots in a zone.
 */
const N=x=>x===null||x===undefined||x===''||!Number.isFinite(Number(x))?null:Number(x);
const ZONES=['rim','paint','mid','left','right','above'];
const rank=(rows,key,value)=>value===null?null:1+rows.filter(x=>key(x)!==null&&key(x)>value+1e-10).length;
export function zoneLeagueRankings(defense,code){
 const teams=(defense?.teams||[]).filter(t=>t?.code&&t.zones);
 const team=teams.find(t=>t.code===code);if(!team)return {};
 return Object.fromEntries(ZONES.map(id=>{
   const own=team.zones?.[id]||{},share=N(own.share),fg=N(own.fg),fga=N(own.fga);
   const shares=teams.map(t=>({v:N(t.zones?.[id]?.share)}));
   const accuracy=teams.map(t=>({v:N(t.zones?.[id]?.fga)>=60?N(t.zones?.[id]?.fg):null}));
   return [id,{shareRank:rank(shares,x=>x.v,share),shareTeams:teams.length,
     accuracyRank:fga>=60?rank(accuracy,x=>x.v,fg):null,
     accuracyTeams:accuracy.filter(x=>x.v!==null).length,
     sample:fga,accuracyReliable:fga>=90,
     rankDirection:'1 = most shot-share allowed or highest FG% allowed'}];
 }));
}
export function opposite3paLeaders({team,schedule=[],players=[],rosters={},asOf=null,slateDay=null}={}){
 const game=schedule.find(g=>g?.home===team||g?.away===team);
 if(!game)return {opponent:null,players:[],message:'No scheduled opponent is matched to this defense on the current slate.'};
 const opponent=game.home===team?game.away:game.home;
 const ids=new Set((rosters[opponent]||[]).map(p=>String(p.id)));
 const profileTeams=new Set(players.filter(p=>p&&p.team).map(p=>p.team));
 const rosterCount=(rosters[opponent]||[]).length;
 const age=asOf&&slateDay?Math.floor((Date.parse(slateDay+'T12:00:00Z')-Date.parse(String(asOf).slice(0,10)+'T12:00:00Z'))/86400000):null;
 if(age!==null&&age>2)return {opponent,players:[],coverageComplete:false,message:`Shot-location profiles are ${age} days old (${String(asOf).slice(0,10)}). Refresh required before naming leading shooters.`};
 if(age!==null&&age<0)return {opponent,players:[],coverageComplete:false,message:'Shot-location dataset includes games after the selected slate date; refusing future-data leakage.'};
 if(!profileTeams.has(opponent))return {opponent,players:[],coverageComplete:false,message:`Player shot-location dataset does not cover ${opponent}. No opposing 3PA ranking is available.`};
 const rows=players.filter(p=>p.team===opponent&&(!ids.size||ids.has(String(p.id)))).map(p=>{
  const gp=N(p.gp),zones=p.zones||{};
  const above=N(zones.above?.fga)||0,corner=(N(zones.left?.fga)||0)+(N(zones.right?.fga)||0);
  if(!gp||gp<4)return null;
  return {player:p.name,gp,threePA:(above+corner)/gp,above:above/gp,corner:corner/gp,total:above+corner};
 }).filter(p=>p&&p.threePA>=0.5).sort((a,b)=>b.threePA-a.threePA||b.total-a.total||a.player.localeCompare(b.player));
 const coverageComplete=rows.length>=8&&rosterCount>=10;
 return {opponent,players:rows.slice(0,6),coverageComplete,coverage:`${rows.length} qualified / ${rosterCount||'unknown'} roster players`,
   message:rows.length?coverageComplete?'Approximate ESPN chart-derived 3PA per played game; no confirmed starters.':`PARTIAL: only ${rows.length} qualifying ${opponent} profiles (${profileTeams.size}/30 league teams represented). These are known shooters, NOT verified team leaders.`:
   'No qualifying four-game sample for the opponent. Do not infer leaders from incomplete data.'};
}
