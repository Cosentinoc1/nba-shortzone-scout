#!/usr/bin/env python3
"""NBA Scout 3.11 incremental, fail-closed patch over installed 3.10.
Called by npm pretest after the GitHub Auto-Update action extracts the ZIP.
No old patch scripts are executed. Supports safe repeat runs.
"""
from pathlib import Path
ROOT=Path(__file__).resolve().parent
# This cumulative release runs the 3.11 installer before 3.12. On subsequent
# deployments, the 3.12 edits supersede some 3.11 exact anchors. Treat a
# recognized completed 3.12 installation as already containing 3.11.
_status=ROOT/'server.mjs'
if _status.exists() and any("version:"+repr(v)+",dataQuality:checkDataQuality(" in _status.read_text(encoding='utf8') for v in ("3.12.0","3.13.0")):
    print('NBA Scout v3.11 base is already included in v3.12/v3.13; no duplicate changes.')
    raise SystemExit(0)

def edit(rel, old, new, *, times=1):
    p=ROOT/rel
    if not p.is_file():
        raise RuntimeError(f'{rel}: missing baseline file (v3.10 install required)')
    s=p.read_text(encoding='utf8')
    if new in s:
        print(f'{rel}: already patched')
        return
    n=s.count(old)
    if n!=times:
        raise RuntimeError(f'{rel}: expected {times} exact anchors but found {n} — refusing unsafe partial patch ({old[:95]})')
    p.write_text(s.replace(old,new,times),encoding='utf8')
    print(f'{rel}: upgraded')

for target in ('lib/news-zone-v311.mjs','public/zone-league-v311.mjs','public/zone-v311.css'):
    if not (ROOT/target).exists():raise RuntimeError('Missing packaged v3.11 asset '+target)

edit('server.mjs',
    'zoneReport:zoneReportForPicks(day,slate),now:Date.now()});}',
    'zoneReport:zoneReportForPicks(day,slate),profiles:players,day,now:Date.now()});}')

edit('lib/quick-pick-explainer.mjs',
    'const n = x =>',
    "import {gradeNewsZone} from './news-zone-v311.mjs';\nconst n = x =>")
edit('lib/quick-pick-explainer.mjs',
    'export function enrichBoardQuickReads(board,{zoneReport=null,context={},rosters={},games=null,now=Date.now()}={}){',
    'export function enrichBoardQuickReads(board,{zoneReport=null,context={},rosters={},profiles=[],games=null,day=null,now=Date.now()}={}){')
edit('lib/quick-pick-explainer.mjs',
    "  return {...row,quickRead:explainQuickPick(row,{zone:z.get([row.team,row.opponent,key(row.player)].join('|'))||null,context,rosters,games:games||board.games||[],now})};",
    '''  const zone=z.get([row.team,row.opponent,key(row.player)].join('|'))||null;
  const upgraded={...row,...gradeNewsZone(row,{zone,context,rosters,profiles,day,now})};
  const quick=explainQuickPick(upgraded,{zone,context,rosters,games:games||board.games||[],now});
  const ng=upgraded.newsZone||{};
  if(ng.shot)quick.facts.push({label:'DEFENSIVE ZONE — RANKING GATE',detail:ng.shot.reason,
    strength:ng.shot.supported?'support':ng.shot.contradicted?'caution':'neutral',source:'ESPN date-isolated reconstructed zone data'});
  if((ng.flags||[]).length){
    quick.facts.push({label:'INJURY & NEWS SIGNALS',
      detail:ng.flags.map(f=>f.title+': '+f.detail).join(' | '),
      strength:ng.flags.some(f=>f.tone==='red')?'caution':ng.flags.some(f=>f.tone==='green')?'support':'conditional',
      source:[...new Set(ng.flags.map(f=>f.source+(f.at?' · '+f.at:'')))].join(' / ')});
  }
  if(ng.veto||ng.hold){quick.status=ng.veto?'PASS · PLAYER OUT':'HOLD · STATUS UNVERIFIED';quick.quality='hold';
    quick.risks.unshift('Same-day availability veto/hold: do not treat a prior-day report as confirmation.');}
  else if(upgraded.researchRank?.tier!=='PRIORITY'&&quick.status==='PRIORITY · FINAL CHECK'){
    quick.status=upgraded.researchRank?.tier==='LEAN'?'RESEARCH LEAN · ZONE GATE':'WATCH · ZONE GATE';
    quick.quality=upgraded.researchRank?.tier==='LEAN'?'lean':'watch';
  }
  quick.risks.unshift('Ranking adjustment '+(ng.adjustment>=0?'+':'')+ng.adjustment+' ordinal points for sourced injury/role and zone fit; not a win probability.');
  return {...upgraded,quickRead:quick};''')

edit('lib/zone-opportunities.mjs',
    'top3ZoneVolumeDeltaPP:topThree?.volumeDeltaPP??null,top3ZoneFgDeltaPP:topThree?.fgDeltaPP??null,',
    'top3ZoneVolumeDeltaPP:topThree?.volumeDeltaPP??null,top3ZoneFgDeltaPP:topThree?.fgDeltaPP??null,top3ZoneFgaAllowed:topThree?.defenseFga??null,')

edit('lib/context.mjs',
    'export function parseOdds(raw){',
    '''export function parseNews(raw){
 const arr=Array.isArray(raw)?raw:Array.isArray(raw?.headlines)?raw.headlines:Array.isArray(raw?.articles)?raw.articles:[];
 const limitDate=Date.now()-36*3600000;
 return arr.flatMap(x=>{
   const headline=String(x.headline||x.title||'').trim(),link=x.links?.web?.href||x.link||x.url||null;
   const publishedAt=x.published||x.lastModified||x.publishedAt||null;
   const timestamp=Date.parse(publishedAt||'');
   if(!headline||!Number.isFinite(timestamp)||timestamp<limitDate||timestamp>Date.now()+300000)return [];
   const players=[...(x.categories||[])].filter(y=>/athlete|player/i.test(y.type||'')).map(y=>y.description||y.name||'').filter(Boolean);
   return [{headline,url:typeof link==='string'&&/^https?:\\/\\//.test(link)?link:null,publishedAt,players}];
 }).slice(0,35);
}
export function parseOdds(raw){''')
edit('lib/context.mjs',
    "const [inj,odds,licensed]=await Promise.allSettled([fetchJSON('/injuries'),fetchJSON(`/scoreboard?dates=${day.replaceAll('-','')}&limit=50`),licensedLineupsForDay(day,teams)]);",
    "const [inj,odds,licensed,news]=await Promise.allSettled([fetchJSON('/injuries'),fetchJSON(`/scoreboard?dates=${day.replaceAll('-','')}&limit=50`),licensedLineupsForDay(day,teams),fetchJSON('/news?limit=65')]);")
edit('lib/context.mjs',
    "const value={injuries:inj.status==='fulfilled'?parseInjuries(inj.value):[],games:",
    "const value={news:news.status==='fulfilled'?parseNews(news.value):[],newsFetched:news.status==='fulfilled',injuries:inj.status==='fulfilled'?parseInjuries(inj.value):[],games:")

edit('public/defense-zones.mjs',
    "import {zoneSignalGrade} from './zone-metrics.mjs';",
    "import {zoneSignalGrade} from './zone-metrics.mjs';\nimport {zoneLeagueRankings,opposite3paLeaders} from './zone-league-v311.mjs';")
edit('public/defense-zones.mjs',
    '<span class="dz-zone-name"><b>${escapeText(z.name)}</b><small>${escapeText(z.flag)}</small></span>',
    '''<span class="dz-zone-name"><b>${escapeText(z.name)}</b><small>${escapeText(z.flag)}</small>
   <small>NBA shot-access rank #${z.shareRank??'—'}/${z.shareTeams??30} (1 = most)</small>
   <small>NBA FG% allowed rank ${z.accuracyRank==null?'insufficient sample':'#'+z.accuracyRank+'/'+z.accuracyTeams}</small></span>''')
edit('public/defense-zones.mjs',
    " if(!view.zones.some(z=>z.id===selectedZone))selectedZone='rim';",
    " const leagueRanks=zoneLeagueRankings(cached.defense,code);\n view.zones=view.zones.map(z=>({...z,...(leagueRanks[z.id]||{})}));\n if(!view.zones.some(z=>z.id===selectedZone))selectedZone='rim';")
edit('public/defense-zones.mjs',
    ' const lead=view.weaknesses.slice(0,3);',
    ''' $('dzHighlight').insertAdjacentHTML('beforeend',`<div class="dz-311-ranks"><span><b>#${active.shareRank??'—'}/${active.shareTeams??30}</b><small>NBA shot-access allowed · #1 = most</small></span><span><b>${active.accuracyRank==null?'Low sample':'#'+active.accuracyRank+'/'+active.accuracyTeams}</b><small>NBA FG% allowed · #1 = highest</small></span></div>`);
 const shooters=opposite3paLeaders({team:code,schedule:cached.schedule||[],players:cached.players||[],rosters:cached.rosters||{}});
 const area=(selectedZone==='left'||selectedZone==='right'||selectedZone==='above');
 const heading=shooters.opponent?`${shooters.opponent} · opponent 3-point attempt leaders`:'Opponent 3-point attempt leaders';
 $('dzThrees').innerHTML=`<div class="dz-311-shooters-heading"><h4>${escapeText(heading)}</h4><p>Three-point areas · ${area?'selected outside zone':'select a corner or above-break zone to compare'}. Historical FGA per played game; not projected minutes.</p></div>`+
 (shooters.players.length?`<div class="dz-311-shooters">${shooters.players.map((p,i)=>`<div><b>${i+1}. ${escapeText(p.player)}</b><strong>${p.threePA.toFixed(1)} 3PA/G</strong><small>${p.above.toFixed(1)} above break · ${p.corner.toFixed(1)} corners · ${p.gp} games</small></div>`).join('')}</div>`:
 `<p class="dz-311-none">${escapeText(shooters.message)}</p>`)+
 `<p class="dz-311-note">Only players in the currently listed opponent roster with at least four observed appearances are ranked. ESPN estimated coordinate zones; recent scratches and role changes require separate verification.</p>`;
 const lead=view.weaknesses.slice(0,3);''')

edit('public/clean.js',
    '<span class="qp-scan-person"><b>${escShort(c.player)}</b><small>${escShort(c.team)} vs ${escShort(c.opponent)} · ${escShort(c.side)} ${escShort(c.line)} ${escShort(c.stat)}</small></span>',
    '''<span class="qp-scan-person"><b>${escShort(c.player)}</b><small>${escShort(c.team)} vs ${escShort(c.opponent)} · ${escShort(c.side)} ${escShort(c.line)} ${escShort(c.stat)}</small><small class="qp-311-flag ${c.newsZone?.flags?.some(f=>f.tone==='red')?'qp-311-red':c.newsZone?.flags?.some(f=>f.tone==='green')?'qp-311-green':'qp-311-muted'}">${escShort(c.newsZone?.flags?.find(f=>f.tone==='red'||f.tone==='green')?.title||c.newsZone?.shot?.reason?.slice(0,84)||'Zone/news signals awaiting verification')}</small></span>''')

edit('public/index.html',
    '<div id="dzRows" class="dz-rows" aria-label="Shot zones, attempts and accuracy allowed"></div>',
    '<div id="dzRows" class="dz-rows" aria-label="Shot zones, attempts and accuracy allowed"></div><section id="dzThrees" class="dz-311-3pa" aria-label="Opposing team three-point attempt leaders"></section>')
edit('public/index.html','</head>','<link rel="stylesheet" href="/zone-v311.css?v=3.11"></head>')
edit('public/index.html',
    '<script type="module" src="/defense-zones.mjs?v=3.5"></script>',
    '<script type="module" src="/defense-zones.mjs?v=3.11"></script>')

edit('server.mjs',
    "version:'2.7.1',researchCacheGames:",
    "version:'3.11.0',researchCacheGames:")
edit('server.mjs',
    "'/quick-picks.css':'quick-picks.css'};",
    "'/quick-picks.css':'quick-picks.css','/zone-v311.css':'zone-v311.css','/zone-league-v311.mjs':'zone-league-v311.mjs'};")
print('NBA Scout v3.11 source updates installed. Run npm test for validation.')
