/**
 * Research Desk v1.4. Historic box-score evidence only. No third-party private
 * projections, sportsbook prices, NBA tracking opportunities or Synergy plays
 * are inferred from this data.
 */
import {clamp,keyName,totalShots} from './model.mjs';
export const STATS={PTS:'Points',REB:'Rebounds',AST:'Assists','3PM':'3-pointers made',PRA:'Points + rebounds + assists',RA:'Rebounds + assists',PA:'Points + assists',PR:'Points + rebounds',FGA:'Field-goal attempts','3PA':'Three-point attempts',FTM:'Free throws made','2PM':'Two-pointers made'};
const round=(v,d=1)=>Number.isFinite(v)?Number(v.toFixed(d)):null;
const average=arr=>arr.length?arr.reduce((a,b)=>a+b,0)/arr.length:null;
const quantile=(arr,q)=>{if(!arr.length)return null;const s=[...arr].sort((a,b)=>a-b),p=(s.length-1)*q,lo=Math.floor(p),hi=Math.ceil(p);return round(s[lo]+(s[hi]-s[lo])*(p-lo));};
export function statValue(box,stat){if(!box)return null;const num=k=>box[k]===null||box[k]===undefined||box[k]===''?null:(Number.isFinite(Number(box[k]))?Number(box[k]):null);
 switch(stat){case 'PTS':return num('pts');case 'REB':return num('reb');case 'AST':return num('ast');case '3PM':return num('tpm');case 'FGA':return num('fga');case '3PA':return num('tpa');case 'FTM':return num('ftm');case '2PM':return num('fgm')!==null&&num('tpm')!==null?num('fgm')-num('tpm'):null;
 case 'PRA':case 'RA':case 'PA':case 'PR':{let fields={PRA:['pts','reb','ast'],RA:['reb','ast'],PA:['pts','ast'],PR:['pts','reb']}[stat],vals=fields.map(num);return vals.every(v=>v!==null)?vals.reduce((a,b)=>a+b,0):null;}
 default:return null;
 }}
export function hitRates(samples,stat,line,side='MORE'){
 if(!Number.isFinite(line)||line<0)return null;
 const arr=samples.map(p=>statValue(p.box,stat)).filter(v=>v!==null);let win=0,push=0,loss=0;
 for(const v of arr){if(v===line)push++;else if(side==='MORE'?v>line:v<line)win++;else loss++;}
 return {sample:arr.length,win,push,loss,winPct:arr.length?round(100*win/arr.length):null,pushPct:arr.length?round(100*push/arr.length):null,lossPct:arr.length?round(100*loss/arr.length):null};
}
const enough=g=>g?.box&&g.played&&Number(g.minutes)>0;
// Cache calendar conversion; rescanning dates for every prop caused timeouts on full slates.
const dayFormat=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'});
const gameDays=new Map();
const gameDay=date=>{const key=String(date);if(gameDays.has(key))return gameDays.get(key);
 const value=dayFormat.format(new Date(date));if(gameDays.size>900)gameDays.clear();gameDays.set(key,value);return value;};
export function researchPlayer({gameCache={},offense,defense,playerId,playerName,stat='PTS',side='MORE',line=null,expectedMinutes=null,day=null}){
 if(!STATS[stat])throw Error('Unsupported stat category');if(!['MORE','LESS'].includes(side))throw Error('Unsupported side');
 if(line!==null&&(!Number.isFinite(Number(line))||Number(line)<0))throw Error('Line must be zero or greater');
 const target=day||gameDay(new Date().toISOString());
 const games=Object.values(gameCache).filter(g=>g?.date&&Array.isArray(g.players)&&gameDay(g.date)<target&&g.teams?.includes(offense)).sort((a,b)=>a.date.localeCompare(b.date));
 const rows=games.map(g=>{
  const p=g.players.find(x=>x.team===offense&&(String(x.id)===String(playerId)||keyName(x.name)===keyName(playerName)));
  return p&&enough(p)?{...p,gameId:g.id,date:gameDay(g.date),opponent:g.teams.find(x=>x!==offense)}:null;
 }).filter(Boolean);
 const data=rows.filter(p=>statValue(p.box,stat)!==null);
 const last5=data.slice(-5),last10=data.slice(-10),h2h=data.filter(x=>x.opponent===defense),vals=data.map(x=>statValue(x.box,stat));
 const typicalMinutes=average(last5.map(g=>g.minutes));
 const minutes=Number(expectedMinutes),hasMinutes=Number.isFinite(minutes)&&minutes>=1&&minutes<=48;
 const season=average(vals),l5=average(last5.map(x=>statValue(x.box,stat))),l10=average(last10.map(x=>statValue(x.box,stat)));
 const raw=season===null?null:(last5.length>=3?.55*l5+.45*season:season);
 const scale=hasMinutes&&typicalMinutes?clamp(minutes/typicalMinutes,.7,1.3):1;
 const projected=raw===null?null:round(raw*scale);
 const relevant=(source,attr)=>round(average(source.map(x=>x.box?.[attr]).filter(v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))).map(Number)));
 const opportunity={fgaL5:relevant(last5,'fga'),fgaL10:relevant(last10,'fga'),tpaL5:relevant(last5,'tpa'),tpaL10:relevant(last10,'tpa'),ftaL5:relevant(last5,'fta'),ftaL10:relevant(last10,'fta'),rebL5:relevant(last5,'reb'),astL5:relevant(last5,'ast'),minutesL5:round(typicalMinutes),minutesL10:round(average(last10.map(x=>x.minutes))),
  reboundChances:null,potentialAssists:null,possessions:null,usageRate:null,playTypeDefense:null,source:'ESPN game box scores; NBA tracking chances, play types and lineup-adjusted usage are NOT available in this feed.'};
 const l= line===null?null:Number(line),direction=projected===null||l===null?null:side==='MORE'?projected-l:l-projected;
 let lean='NO LEAN';const why=[];
 if(data.length<5)why.push('Fewer than five games with complete box-score statistics');
 if(l===null)why.push('Exact current platform line not supplied');
 if(!hasMinutes)why.push('Independent projected minutes not supplied');
 if(h2h.length<3)why.push('Fewer than three same-season games against this opponent: H2H not reliable');
 if(['REB','RA','PRA','PR'].includes(stat))why.push('Rebound chances/lineup size require independent tracking');
 if(['AST','RA','PA','PRA'].includes(stat))why.push('Potential assists/teammate shooting require independent tracking');
 if(stat==='PTS'||stat==='2PM'||stat==='FTM')why.push('Scoring efficiency, attempts and foul opportunities can vary independently');
 if(l!==null&&data.length>=5&&projected!==null){
  const threshold=Math.max(stat==='3PM'?.55:1.25,.07*Math.max(l,1));
  lean=direction>=threshold?'DIRECTIONAL SUPPORT':direction<=-threshold?'AGAINST SELECTED SIDE':'TOO CLOSE TO LINE';
  if(lean==='DIRECTIONAL SUPPORT')why.push('Projection has a directional margin, but is not a win probability or market edge');
  if(lean==='AGAINST SELECTED SIDE')why.push('The estimated baseline opposes this side');
 }
 const rate=l===null?null:{last5:hitRates(last5,stat,l,side),last10:hitRates(last10,stat,l,side),season:hitRates(data,stat,l,side),h2h:hitRates(h2h,stat,l,side)};
 return {player:playerName,offense,defense,day:target,stat,side,line:l,ready:data.length>0,boxscoreGames:data.length,last5: last5.length,last10:last10.length,h2hGames:h2h.length,seasonMean:round(season),last5Mean:round(l5),last10Mean:round(l10),h2hMean:round(average(h2h.map(x=>statValue(x.box,stat)))),observedP20:quantile(last10.map(x=>statValue(x.box,stat)),.2),observedP80:quantile(last10.map(x=>statValue(x.box,stat)),.8),projectedBaseline:projected,directionalMargin:round(direction),lean,hitRates:rate,opportunity,notes:why,
  recent: last10.map(x=>({date:x.date,opponent:x.opponent,stat:statValue(x.box,stat),minutes:round(x.minutes),fga:x.box.fga,fta:x.box.fta,tpa:x.box.tpa,pts:x.box.pts,reb:x.box.reb,ast:x.box.ast})).reverse(),
  method:'Historical baseline: 55% last-five average + 45% current-season average, with independently entered minutes scale capped at 0.70–1.30. Observed 20th–80th percentiles are descriptive, not prediction intervals. H2H is same-season only. No automatically verified role, DvP, prices, tracking, projections or payout EV.'};
}
