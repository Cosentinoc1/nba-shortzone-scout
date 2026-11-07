export const ZONES = ['rim','paint','mid','left','right','above'];
export const ZONE_NAMES = {rim:'Restricted area',paint:'Paint (non-RA)',mid:'Mid-range',left:'Left corner 3',right:'Right corner 3',above:'Above-break 3'};
export const normalizeTeam = s => ({NO:'NOP',NOLA:'NOP',GS:'GSW',SA:'SAS',NY:'NYK',PHO:'PHX',UTAH:'UTA',WSH:'WAS'})[String(s||'').toUpperCase()]||String(s||'').toUpperCase();
export const keyName = s => String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]/g,'').toLowerCase();
export const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
export const zeroZones = () => Object.fromEntries(ZONES.map(z=>[z,{fgm:0,fga:0}]));
export const totalShots = p => ZONES.reduce((v,k)=>v+(+p?.zones?.[k]?.fga||0),0);
export const ageDay = (date) => { let n=Date.parse(date||'');return Number.isFinite(n)?Math.max(0,Math.floor((Date.now()-n)/86400000)):null; };
export const localDate = () => new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export function coordinateZone(play){
 const point=play.coordinate||{},x=Number(point.x),y=Number(point.y),value=Number(play.pointsAttempted);
 if(value!==2&&value!==3)return null;
 // Some ESPN heaves land at y > 51 (e.g. y=62), but are not recorded
 // as official FGA. Recognize them before the invalid-coordinate check.
 const desc=String(play.type?.text||'')+' '+String(play.text||'');
 if(/heave/i.test(desc)||Number.isFinite(y)&&y>42)return 'heave';
 if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||x>50||y<-3)return 'unknown';
 // ESPN 0-50 wide, hoop near (25,1). These are approximate NBA zones.
 if(value===3){if(y<=14&&Math.abs(x-25)>=21.5)return x<25?'left':'right';return 'above';}
 const dist=Math.hypot(x-25,y-1);
 if(dist<=4.25)return 'rim';
 if(x>=17&&x<=33&&y<=18)return 'paint';
 if(dist<=15&&y<=17)return 'paint';
 return 'mid';
}
function boxFg(stats){let s=(stats||[]).find(x=>x.name==='fieldGoalsMade-fieldGoalsAttempted');let n=s?.displayValue?.split('-').at(-1);return n==null?null:Number(n)}
export function parseESPNGame(ev,data){
 const box=data.boxscore||{};const teams=(box.teams||[]).map(t=>({id:String(t.team?.id||''),code:normalizeTeam(t.team?.abbreviation),fga:boxFg(t.statistics)}));
 if(teams.length!==2||teams.some(t=>!t.id||!t.code))throw Error('No two box-score teams');
 const teamById=Object.fromEntries(teams.map(t=>[t.id,t.code]));const players=new Map(),observed={},heaves={};
 for(const group of box.players||[]){const code=normalizeTeam(group.team?.abbreviation||teamById[String(group.team?.id)]);for(const set of group.statistics||[])for(const item of set.athletes||[]){const a=item.athlete||{},id=String(a.id||'');if(!id)continue;const min=item.stats?.[0],played=!item.didNotPlay&&min!=null&&min!==''&&min!=='DNP'&&min!=='0:00'&&min!=='--';const at=(key)=>{const i=(set.names||set.labels||[]).indexOf(key);const v=i>=0?item.stats?.[i]:null;return v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))?Number(v):null};
 const madeAttempt=(key)=>{const i=(set.names||set.labels||[]).indexOf(key),str=i>=0?String(item.stats?.[i]||''):'';const m=/^(\d+)-(\d+)$/.exec(str);return m?{made:Number(m[1]),attempted:Number(m[2])}:{made:null,attempted:null}};
 const fg=madeAttempt('FG'),threes=madeAttempt('3PT'),ft=madeAttempt('FT');
 players.set(id,{id,name:a.displayName||a.shortName||id,team:code,pos:a.position?.abbreviation||'',played,minutes:/^\d+(?::\d+)?$/.test(String(min||''))?(String(min).includes(':')?Number(String(min).split(':')[0])+Number(String(min).split(':')[1])/60:Number(min)):null,zones:zeroZones(),box:{pts:at('PTS'),reb:at('REB'),ast:at('AST'),fgm:fg.made,fga:fg.attempted,tpm:threes.made,tpa:threes.attempted,ftm:ft.made,fta:ft.attempted,oreb:at('OREB'),dreb:at('DREB')}});}}
 let unknown=0,valid=0;
 for(const shot of data.plays||[]){if(shot.shootingPlay!==true||![2,3].includes(Number(shot.pointsAttempted)))continue;let id=String(shot.participants?.[0]?.athlete?.id||''),tid=String(shot.team?.id||''),code=teamById[tid];if(!id||!code)throw Error('Shot missing ESPN player or team');observed[tid]=(observed[tid]||0)+1;
  let player=players.get(id);if(!player){player={id,name:shot.text?.split(' makes ')[0]?.split(' misses ')[0]||id,team:code,pos:'',played:true,zones:zeroZones()};players.set(id,player)}
  let zone=coordinateZone(shot);if(zone==='heave'){heaves[tid]=(heaves[tid]||0)+1;continue}if(!ZONES.includes(zone)){unknown++;continue}
  player.zones[zone].fga++;if(shot.scoringPlay===true)player.zones[zone].fgm++;valid++;
 }
 let unreconciledFga=0;let sourceAttempts=0;let boxAttempts=0;
 for(const t of teams){
  if(!Number.isFinite(t.fga))throw Error(`${t.code} missing official box-score attempts`);
  const pbp=observed[t.id]||0,heave=heaves[t.id]||0;
  const discrepancy=Math.min(Math.abs(pbp-t.fga),Math.abs((pbp-heave)-t.fga));
  // ESPN corrects scorebook attempts after publishing some play events.
  // Accept only tiny residual mismatches, record their magnitude, and
  // explicitly label the resulting zones as ESPN estimates.
  if(discrepancy>2)throw Error(`${t.code} play-by-play FGA ${pbp} vs box ${t.fga} (difference ${discrepancy})`);
  unreconciledFga+=discrepancy;sourceAttempts+=pbp;boxAttempts+=t.fga;
 }
 if(valid<25)throw Error('Too few classified field goals');
 return {id:String(ev.id),schemaVersion:2,date:ev.date,teams:teams.map(t=>t.code),players:[...players.values()],unknown,valid,unreconciledFga,sourceAttempts,boxAttempts,excludedHeaves:Object.values(heaves).reduce((a,b)=>a+b,0)};
}
export function aggregateGames(games){
 const profiles=new Map(),def=new Map(),last=games.reduce((s,g)=>g.date>s?g.date:s,'');
 for(const g of games){for(const team of g.teams){if(!def.has(team))def.set(team,{code:team,zones:zeroZones(),games:0});def.get(team).games++}
  for(const p of g.players){if(!p.id||!p.team||!g.teams.includes(p.team))continue;
   const k=p.team+':'+p.id;let profile=profiles.get(k);if(!profile){profile={id:p.id,name:p.name,team:p.team,pos:p.pos||'',gp:0,zones:zeroZones()};profiles.set(k,profile)}
   if(p.played||totalShots(p)>0)profile.gp++;
   const opposing=g.teams.find(t=>t!==p.team),d=def.get(opposing);
   for(const z of ZONES){const a=p.zones?.[z]||{};profile.zones[z].fga+=(+a.fga||0);profile.zones[z].fgm+=(+a.fgm||0);if(d){d.zones[z].fga+=(+a.fga||0);d.zones[z].fgm+=(+a.fgm||0)}}
  }
 }
 let teams=[...def.values()];let league={zones:{}};for(const z of ZONES){let fga=teams.reduce((v,t)=>v+t.zones[z].fga,0),fgm=teams.reduce((v,t)=>v+t.zones[z].fgm,0);league.zones[z]={fga,fgm,fg:fga?fgm/fga:0,share:0}}
 let leagueTotal=ZONES.reduce((v,z)=>v+league.zones[z].fga,0);
 for(const z of ZONES)league.zones[z].share=leagueTotal?league.zones[z].fga/leagueTotal:0;
 for(const t of teams){t.attempts=totalShots(t);for(const z of ZONES){const q=t.zones[z];q.share=t.attempts?q.fga/t.attempts:0;q.fg=q.fga?q.fgm/q.fga:0;}}
 for(const z of ZONES){[...teams].sort((a,b)=>a.zones[z].share-b.zones[z].share).forEach((t,i)=>t.zones[z].rank_share=i+1);[...teams].sort((a,b)=>a.zones[z].fg-b.zones[z].fg).forEach((t,i)=>t.zones[z].rank_fg=i+1);}
 return {players:[...profiles.values()],defense:{teams,league,asof:last,source:'ESPN coordinate reconstruction'},asof:last};
}
export function matchupGrade(player, defenseTeam, league){
 if(!player||!defenseTeam||!league?.zones)return null;
 const total=totalShots(player),gp=Number(player.gp)||0;
 if(total<20)return {eligible:false,grade:null,score:null,label:'Insufficient attempts',total,gp,reason:'Fewer than 20 total classified FGA'};
 let volumeScore=0,effScore=0,rows=[];
 for(const z of ZONES){const p=player.zones?.[z]||{},d=defenseTeam.zones?.[z]||{},l=league.zones?.[z]||{},pAtt=Number(p.fga)||0,pShare=total?pAtt/total:0;
  const shareDiff=((Number(d.share)||0)-(Number(l.share)||0))*100;
  const fgDiff=((Number(d.fg)||0)-(Number(l.fg)||0))*100;
  const volumeSignal=clamp(shareDiff/5.5,-1,1),accuracySignal=clamp(fgDiff/7,-1,1);
  volumeScore+=pShare*volumeSignal;effScore+=pShare*accuracySignal;
  rows.push({zone:z,name:ZONE_NAMES[z],playerFga:pAtt,playerFgm:Number(p.fgm)||0,playerFg:pAtt?(+p.fgm||0)/pAtt:null,playerShare:pShare,playerFgaPerGame:gp?pAtt/gp:null,defShare:d.share,defFg:d.fg,defFga:d.fga,defRank:d.rank_share,defFgRank:d.rank_fg,shareDeltaPP:shareDiff,fgDeltaPP:fgDiff,contribution:pShare*(.68*volumeSignal+.32*accuracySignal)});
 }
 const raw=.68*volumeScore+.32*effScore;
 const reliability=gp?Math.min(1,gp/8)*Math.min(1,total/85):Math.min(.55,total/85);
 const score=clamp(50+45*raw*(.75+.25*reliability),10,90);
 const label=score>=65?'A':score>=58?'B':score>=48?'C':score>=40?'D':'F';
 const eligible=total>=40&&gp>=4&&Number.isFinite(score);
 const primary=[...rows].sort((a,b)=>b.playerFga-a.playerFga)[0];
 const drivers=[...rows].filter(r=>r.playerFga>=Math.max(3,total*.05)).sort((a,b)=>Math.abs(b.contribution)-Math.abs(a.contribution)).slice(0,3);
 return {eligible,score:+score.toFixed(1),grade:label,opportunitySignal:+raw.toFixed(3),volumeSignal:+volumeScore.toFixed(3),efficiencySignal:+effScore.toFixed(3),confidence:eligible?(total>=80&&gp>=7?'Moderate':'Limited'):'Insufficient',total,gp,primaryZone:primary.zone,rows,drivers,method:'68% frequency overlap / 32% opponent FG% overlap, weighted by player shot share; descriptive screening score, NOT P(win).'};
}
export function rankMatchups({players,defense,matchups,scope='today',limit=6,rosters={}}){
 const teams=defense?.teams||[],byCode=Object.fromEntries(teams.map(t=>[t.code,t]));let pairings=[];
 if(scope==='today'){pairings=(matchups||[]).flatMap(game=>[{offense:game.away,defense:game.home,game:game.label},{offense:game.home,defense:game.away,game:game.label}]);}
 else for(const off of new Set(Object.keys(rosters).length?Object.keys(rosters):players.map(p=>p.team)))for(const d of teams)if(d.code!==off)pairings.push({offense:off,defense:d.code,game:'Hypothetical matchup'});
 const profiles=new Map(players.map(p=>[p.team+':'+keyName(p.name),p]));
 const all=[];let qualified=0,notQualified=0,missingProfiles=0,availableProfiles=0,totalRosterSlots=0;
 const ungradedNames=[];
 for(const pair of pairings){
  const defTeam=byCode[pair.defense];if(!defTeam)continue;
  const listed=rosters[pair.offense]||players.filter(p=>p.team===pair.offense).map(p=>({name:p.name}));
  for(const r of listed){totalRosterSlots++;
   const p=profiles.get(pair.offense+':'+keyName(r.name));
   if(!p){missingProfiles++;if(ungradedNames.length<15)ungradedNames.push(r.name+' ('+pair.offense+')');continue}
   availableProfiles++;
   const grade=matchupGrade(p,defTeam,defense.league);
   if(!grade?.eligible){notQualified++;if(ungradedNames.length<15)ungradedNames.push(r.name+' ('+pair.offense+', low sample)');continue}
   qualified++;
   all.push({id:String(r.id||p.id),player:r.name,position:r.pos||p.pos||'—',offense:p.team,defense:pair.defense,game:pair.game,score:grade.score,grade:grade.grade,confidence:grade.confidence,attempts:grade.total,games:grade.gp,topZone:grade.primaryZone,volume:grade.volumeSignal,efficiency:grade.efficiencySignal,source:p.source||'unknown'});
  }
 }
 all.sort((a,b)=>b.score-a.score||b.attempts-a.attempts);
 const coverageFraction=totalRosterSlots?qualified/totalRosterSlots:0;
 return {top:all.slice(0,limit),worst:[...all].reverse().slice(0,limit),eligiblePlayers:qualified,unscored:missingProfiles+notQualified,missingProfiles,notQualified,availableProfiles,totalRosterSlots,coveragePct:+(coverageFraction*100).toFixed(1),complete:totalRosterSlots>0&&missingProfiles===0&&notQualified===0,pairings:pairings.length,scope,ungradedExamples:ungradedNames,method:'Qualified players only: GP≥4 and classified FGA≥40. Coverage denominator is roster entries, not confirmed available/active players. No minutes, injuries, lineups, props or prices.'};
}
