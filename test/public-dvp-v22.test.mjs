import test from 'node:test';
import assert from 'node:assert/strict';
import {parsePositionPage,externalMatchup,getPublicDvp} from '../lib/public-dvp.mjs';
const teams=['Atlanta Hawks','Boston Celtics','Brooklyn Nets','Charlotte Hornets','Chicago Bulls','Cleveland Cavaliers','Dallas Mavericks','Denver Nuggets','Detroit Pistons','Golden State Warriors','Houston Rockets','Indiana Pacers','Los Angeles Clippers','Los Angeles Lakers','Memphis Grizzlies','Miami Heat','Milwaukee Bucks','Minnesota Timberwolves','New Orleans Pelicans','New York Knicks','Oklahoma City Thunder','Orlando Magic','Philadelphia 76ers','Phoenix Suns','Portland Trail Blazers','Sacramento Kings','San Antonio Spurs','Toronto Raptors','Utah Jazz','Washington Wizards'];
const htmlFor=(stat='PTS')=>`<main><table><thead><tr><th>Team</th><th>vs PG</th><th>vs SG</th><th>vs SF</th><th>vs PF</th><th>vs C</th></tr></thead><tbody>${teams.map((t,i)=>`<tr><td>${t}</td>${[1,2,3,4,5].map(j=>`<td><strong>${(stat==='PTS'?23:5)+i/10+j}</strong> #${i+1}</td>`).join('')}</tr>`).join('')}</tbody></table></main>`;
test('Parser pulls sourced full 30×5 values and honors ranking convention',()=>{
 const out=parsePositionPage(htmlFor(), 'PTS');assert.equal(out.size,150);assert.equal(out.get('ATL|PG|PTS').rankMostAllowed,1);assert.equal(out.get('WAS|C|PTS').rankMostAllowed,30);
 const feed={available:true,values:Object.fromEntries(out),source:'public',updatedAt:'2026-11-07',url:'https://example.org'};
 assert.equal(externalMatchup(feed,{opponent:'ATL',pos:'PG',stat:'PTS'}).score,95);
 assert.equal(externalMatchup(feed,{opponent:'WAS',pos:'PG',stat:'PTS'}).score,5);
 assert.equal(externalMatchup(feed,{opponent:'WAS',pos:'PG',stat:'PTS'}).lessScore,95);
});
test('Missing component or broad position never pretends to be exact',()=>{
 const feed={available:true,values:Object.fromEntries(parsePositionPage(htmlFor(), 'PTS'))};
 assert.equal(externalMatchup(feed,{opponent:'ATL',pos:'G',stat:'PTS'}),null);
 assert.equal(externalMatchup(feed,{opponent:'ATL',pos:'PG',stat:'PRA'}),null);
 assert.throws(()=>parsePositionPage('<main>Nothing</main>','PTS'));
});
test('Public refresh fills four exact categories from source, no invented observations',async()=>{
 const now=Date.parse('2026-11-07T19:00:00Z');let calls=0;
 const mocked=async url=>{calls++;const stat=new URL(url).searchParams.get('stat');return {ok:true,text:async()=>htmlFor(stat)};};
 const x=await getPublicDvp({day:'2026-11-07',now,fetcher:mocked});
 assert.equal(x.available,true);assert.equal(calls,4);assert.equal(Object.keys(x.values).length,600);
 const c=externalMatchup(x,{opponent:'ATL',pos:'PG',stat:'PRA'});
 assert.equal(c.score,95);assert.equal(c.components.length,3);
 const h=await getPublicDvp({day:'2026-11-06',now,fetcher:mocked});
 assert.equal(h.available,false);assert.equal(calls,4);assert.match(h.reason,/leak future/);
});
