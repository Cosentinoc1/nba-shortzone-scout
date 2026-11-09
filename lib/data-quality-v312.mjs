/** NBA Scout v3.12 data trust checks. Arithmetic consistency != independent live source verification. */
const Z=['rim','paint','mid','left','right','above'];
const n=x=>x===null||x===undefined||x===''||!Number.isFinite(Number(x))?null:Number(x);
const close=(a,b)=>a!==null&&b!==null&&Math.abs(a-b)<=1e-5;
const day=s=>/^\d{4}-\d{2}-\d{2}/.test(String(s||''))?String(s).slice(0,10):null;
const chicago=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export function checkDataQuality({defense,players=[],rosters={},asOf=null,source=null,today=chicago()}={}){
 const issues=[],warnings=[];
 const teams=Array.isArray(defense?.teams)?defense.teams:[];
 const codeSet=new Set(teams.map(x=>x.code));
 if(teams.length!==30||codeSet.size!==30)issues.push(`Expected 30 unique defensive teams, got ${teams.length} rows and ${codeSet.size} codes`);
 const acc=Object.fromEntries(Z.map(z=>[z,{fga:0,fgm:0}]));let total=0;
 for(const t of teams){
  let teamTotal=0;
  for(const z of Z){const x=t.zones?.[z]||{},fga=n(x.fga),fgm=n(x.fgm),fg=n(x.fg),share=n(x.share);
   if(fga===null||fgm===null||fga<0||fgm<0||fgm>fga){issues.push(`${t.code} ${z}: invalid FGM/FGA`);continue;}
   teamTotal+=fga;acc[z].fga+=fga;acc[z].fgm+=fgm;
   if(fga>0&&fg!==null&&!close(fg,fgm/fga))issues.push(`${t.code} ${z}: FG% inconsistent with FGM/FGA`);
   if(share!==null&&n(t.attempts)>0&&!close(share,fga/n(t.attempts)))issues.push(`${t.code} ${z}: zone share inconsistent`);
  }
  total+=teamTotal;
  if(n(t.attempts)!==null&&!close(n(t.attempts),teamTotal))issues.push(`${t.code}: team attempts do not equal six zone totals`);
 }
 for(const z of Z){const ref=defense?.league?.zones?.[z]||{};
   if(n(ref.fga)!==null&&!close(acc[z].fga,n(ref.fga)))issues.push(`League ${z}: FGA do not sum from teams`);
   if(n(ref.fgm)!==null&&!close(acc[z].fgm,n(ref.fgm)))issues.push(`League ${z}: FGM do not sum from teams`);
   if(n(ref.fg)!==null&&acc[z].fga>0&&!close(n(ref.fg),acc[z].fgm/acc[z].fga))issues.push(`League ${z}: FG% mismatch`);
   if(n(ref.share)!==null&&total>0&&!close(n(ref.share),acc[z].fga/total))issues.push(`League ${z}: shot-share mismatch`);
 }
 if(n(defense?.league?.attempts)!==null&&!close(total,n(defense.league.attempts)))issues.push('League total does not reconcile with all teams');
 const represented=new Set(players.map(p=>p?.team).filter(Boolean));
 const missing=teams.map(t=>t.code).filter(code=>!represented.has(code));
 const validGP=players.filter(p=>n(p?.gp)!==null&&n(p?.gp)>=1);
 const profileByTeam=new Map();for(const p of validGP)profileByTeam.set(p.team,(profileByTeam.get(p.team)||0)+1);
 const usableTeamCoverage=teams.filter(t=>(profileByTeam.get(t.code)||0)>=5).length;
 if(represented.size<30)warnings.push(`Player shot-zone profiles cover ${represented.size}/30 teams; missing ${missing.join(', ')||'unknown'}`);
 if(validGP.length!==players.length)warnings.push(`${players.length-validGP.length} player profiles have no valid games-played count`);
 if(validGP.length<250)warnings.push('Fewer than 250 valid player profiles; do not claim league-wide three-point shooter coverage');
 const dateUsed=day(asOf)||day(defense?.asof);
 const age=dateUsed&&day(today)?Math.round((Date.parse(day(today)+'T12:00:00Z')-Date.parse(dateUsed+'T12:00:00Z'))/86400000):null;
 if(age===null)warnings.push('Source snapshot date unavailable');
 else if(age>2)warnings.push(`Shot-zone data are ${age} calendar days old (${dateUsed})`);
 else if(age < -1)issues.push(`Shot-zone snapshot date ${dateUsed} is later than selected day ${today}`);
 else if(age===-1)warnings.push('UTC-date rollover may be one day ahead of Chicago; verify game-time cutoff before using as pregame data');
 if(!String(source||defense?.source||'').trim())warnings.push('Data source unlabelled');
 warnings.push('Math was checked inside the app; an independent live NBA box-score comparison was not performed');
 return {structuralOk:issues.length===0,fullyVerified:false,teamCount:teams.length,teamFga:total,leagueFga:n(defense?.league?.attempts),
   playerProfiles:players.length,validPlayerProfiles:validGP.length,playerTeamCoverage:represented.size,
   missingPlayerTeams:missing,playerLeaderboardsComplete:usableTeamCoverage===30&&validGP.length>=250,usablePlayerTeams:usableTeamCoverage,
   asOf:dateUsed,ageDays:age,source:source||defense?.source||'unknown',issues:issues.slice(0,30),warnings,
   auditType:'internal arithmetic/provenance/coverage; NOT independent authoritative source verification'};
}
