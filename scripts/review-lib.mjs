/** Audit NBA Scout frozen picks against ESPN final NBA player box scores.
 * Audits observed research picks, not real-wager results or model-implied probabilities.
 */
export const normalName = s => String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[’']/g,'').replace(/\b(jr|sr|ii|iii|iv)\.?$/ig,'').replace(/[^a-z0-9]/ig,'').toLowerCase();
export const canonicalStat = x => {
  const s=String(x||'').toLowerCase().replace(/\s/g,'').replace(/\+/g,'').replace(/[.\-_]/g,'');
  const map={points:'PTS',pts:'PTS',rebounds:'REB',reb:'REB',assists:'AST',ast:'AST',threes:'3PM','3pointersmade':'3PM','3pm':'3PM',pra:'PRA',ptsrebast:'PRA',pointsreboundsassists:'PRA',ptsrebsasts:'PRA',ra:'RA',rebast:'RA',rebsasts:'RA',reboundsassists:'RA',pa:'PA',ptsast:'PA',ptsasts:'PA',pointsassists:'PA',pr:'PR',ptsreb:'PR',ptsrebs:'PR',pointsrebounds:'PR',fga:'FGA',fgattempts:'FGA','3pa':'3PA','3pattempts':'3PA',ftm:'FTM',ftmade:'FTM',freethrowsmade:'FTM','2pm':'2PM','2pointersmade':'2PM'};
  return map[s]||null;
};
const toNum = x=>(x===null||x===undefined||String(x).trim()==='')?null:(Number.isFinite(Number(x))?Number(x):null);
export function numericBox(stats, labels){
  const d={};labels.forEach((k,i)=>d[k]=stats[i]);
  const pair=(k,idx=0)=>{const v=String(d[k]??'');const n=Number(v.split('-')[idx]);return Number.isFinite(n)?n:null;};
  const n=(k)=>toNum(d[k]);
  const fgMade=pair('FG'), tpa=pair('3PT',1), tpm=pair('3PT'), fga=pair('FG',1), ftm=pair('FT');
  return {PTS:n('PTS'),REB:n('REB'),AST:n('AST'),'3PM':tpm,'3PA':tpa,FGA:fga,FTM:ftm,'2PM':fgMade==null||tpm==null?null:fgMade-tpm,MIN:toNum(String(d.MIN??'').split(':')[0])};
}
export function statValue(stats, stat){
  const type=canonicalStat(stat); if(!type)return null;
  const joins={PRA:['PTS','REB','AST'],RA:['REB','AST'],PA:['PTS','AST'],PR:['PTS','REB']};
  const keys=joins[type]||[type];const nums=keys.map(x=>stats[x]);
  return nums.some(x=>!Number.isFinite(x))?null:nums.reduce((a,b)=>a+b,0);
}
export function gradePick(p, player){
  if(!player)return {...p,result:'UNVERIFIED',actual:null,notes:'Player identity/team could not be verified in the final box score'};
  if(player.dnp)return {...p,result:'VOID',actual:null,notes:'DNP — excluded from hit-rate denominator'};
  const actual=statValue(player.stats,p.stat);
  if(actual==null)return {...p,result:'UNVERIFIED',actual:null,notes:'Unsupported or missing box-score statistic'};
  const line=Number(p.line);const side=String(p.side||p.direction||'').toUpperCase();
  if(!Number.isFinite(line)||!['MORE','LESS'].includes(side))return {...p,result:'UNVERIFIED',actual:null,notes:'Invalid line or direction'};
  const result=actual===line?'PUSH':(side==='MORE'?actual>line:actual<line)?'WIN':'LOSS';
  return {...p,actual,result,minutes:player.stats.MIN,notes:player.notes||''};
}
export function summaries(picks){
 const groups={more:[],less:[],bottom:[]};
 for(const p of picks){const g=String(p.board||'').toLowerCase().includes('bottom')?'bottom':String(p.side||'').toUpperCase()==='LESS'?'less':'more';groups[g].push(p)}
 const score=arr=>{const n=kind=>arr.filter(p=>p.result===kind).length;const wins=n('WIN'),losses=n('LOSS'),pushes=n('PUSH'),voids=n('VOID'),unverified=n('UNVERIFIED')+n('PENDING');return {wins,losses,pushes,voids,unverified,graded:wins+losses,hitRate:wins+losses?Math.round(wins/(wins+losses)*1000)/10:null,rows:arr.length}};
 const more=score(groups.more),less=score(groups.less),bottom=score(groups.bottom),recommended=score([...groups.more,...groups.less]);return {more,less,bottom,recommended};
}
export function candidatesFromBoard(data){
 // Freeze ONLY exact pregame ranked rows. Bottom 10 is a diagnostic MORE
 // countercheck, never part of the recommended pick denominator.
 const chosen=[];const seen=new Set();
 const entries=[
  ['Top 10 MORE',(data.top10More?.length?data.top10More:data.topMore)||[]],
  ['Top 10 LESS',(data.top10Less?.length?data.top10Less:data.topLess)||[]],
  ['Bottom 10',(data.bottom10||data.unfavorable||[])]
 ];
 for(const [board,rows] of entries){
  for(const c of rows){
   const side=board==='Top 10 LESS'?'LESS':'MORE',stat=canonicalStat(c.stat||c.market||c.prop||c.statType);
   const line=Number(c.line),player=String(c.player||c.name||'').trim(),team=String(c.team||c.offense||'').toUpperCase(),opponent=String(c.opponent||c.defense||'').toUpperCase();
   if(!player||!/^[A-Z]{3}$/.test(team)||!/^[A-Z]{3}$/.test(opponent)||!stat||!Number.isFinite(line))continue;
   const research=c.researchRank||null;
   const tier=research?.tier||c.recommendation?.tier||c.tier||c.recommendation?.state;
   if(board==='Bottom 10'){
    if(c.state==='PASS')continue;
   }else if(research){
    if(research.eligible!==true||!['PRIORITY','LEAN','WATCH'].includes(String(tier).toUpperCase()))continue;
   }else if(!['STRONG','LEAN'].includes(String(tier||'').toUpperCase()))continue;
   const key=`${board}/${normalName(player)}`;if(seen.has(key))continue;seen.add(key);
   chosen.push({board,rank:chosen.filter(x=>x.board===board).length+1,player,team,opponent,stat,side,line,
    grade:toNum(research?.score??c.recommendation?.score??c.score),tier:board==='Bottom 10'?'COUNTERCHECK':String(tier||'QUALIFIED'),
    finalVetoTier:c.recommendation?.tier||null,coverage:research?.coverage||null,
    signalCount:research?.support??null,signals:research?.reasons?.slice(0,5)||[],risks:research?.risks?.slice(0,4)||[],
    verification:{lineFresh:research?.lineFresh??null,projectionMatched:research?.projectionMatched??false},source:c.sources||null});
   if(chosen.filter(x=>x.board===board).length>=10)break;
  }
 }
 return chosen;
}

export function gamesForDate(board){return new Map((board.games||[]).flatMap(g=>[[String(g.away||'').toUpperCase(),g],[String(g.home||'').toUpperCase(),g]]));}
export function pretipCandidates(board,now=new Date()){
 const matches=gamesForDate(board);return candidatesFromBoard(board).filter(p=>{
  const g=matches.get(p.team);if(!g||![g.away,g.home].includes(p.opponent))return false;
  const tip=Date.parse(g.tipoff||'');return Number.isFinite(tip)&&tip>now.getTime()+5*60000&&!g.completed;
 });
}
export function extractESPNPlayers(summary){
 const rows=[];
 for(const group of summary?.boxscore?.players||[]){
  const team=String(group.team?.abbreviation||'').toUpperCase();
  for(const section of group.statistics||[]){const labels=section.labels||[];
   for(const entry of section.athletes||[]){
    const athlete=entry.athlete||{};const stats=numericBox(entry.stats||[],labels);
    const dnp=entry.didNotPlay===true||entry.dnp===true||(!entry.stats?.length&&Boolean(entry.reason||entry.didNotPlay));
    rows.push({id:String(athlete.id||''),name:athlete.displayName||athlete.fullName||'',team,stats,dnp,notes:entry.reason||''});
   }
  }
 }
 return rows;
}
export function matchPlayer(p, players){
 const matches=players.filter(x=>x.team===p.team&&normalName(x.name)===normalName(p.player));
 if(matches.length!==1)return null;return matches[0];
}
export function dateInChicago(now=new Date()){
 return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
}
