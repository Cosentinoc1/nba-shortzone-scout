#!/usr/bin/env python3
"""Idempotent, strict RFPP 2.3 overlay on known-good v2.2 install.
Does NOT create GitHub workflow files. `npm test` runs after this installer.
"""
from pathlib import Path
import json, re
ROOT=Path(__file__).resolve().parent

def replace(file,old,new):
    p=ROOT/file
    if not p.is_file(): raise RuntimeError(f'{file} missing')
    a=p.read_text()
    if new in a: return
    c=a.count(old)
    if c!=1: raise RuntimeError(f'{file}: expected 1 old anchor, got {c}: {old[:110]!r}')
    p.write_text(a.replace(old,new,1))
    print('Patched',file,':',old[:65])

def insert(file,needle,prepend):
    p=ROOT/file; a=p.read_text()
    if prepend in a:return
    c=a.count(needle)
    if c!=1:raise RuntimeError(f'{file} injection expected 1 anchor got {c}: {needle[:80]!r}')
    p.write_text(a.replace(needle,prepend+needle,1))
    print('Imported into',file)

assert (ROOT/'lib/published-positions.mjs').exists() and (ROOT/'data/nba_fantasy_positions_2026.csv').exists(), 'Missing sourced position module/data'
# Augment existing ESPN + NBA House contexts; fetch public position source concurrently.
insert('lib/context.mjs',"import {getPublicDvp} from './public-dvp.mjs';", "import {getPublishedPositions} from './published-positions.mjs';\n")
replace('lib/context.mjs',
 "  try{value.publicDvp=await getPublicDvp({day});}catch(e){value.publicDvp={available:false,reason:String(e.message||e)}}",
 "  const [dvpResult,posResult]=await Promise.allSettled([getPublicDvp({day}),getPublishedPositions({day})]);\n"
 "  value.publicDvp=dvpResult.status==='fulfilled'?dvpResult.value:{available:false,reason:String(dvpResult.reason)};\n"
 "  value.publicPositions=posResult.status==='fulfilled'?posResult.value:{available:false,reason:String(posResult.reason)};")

insert('lib/decision.mjs',"import {externalMatchup} from './public-dvp.mjs';", "import {publishedMatchup} from './published-positions.mjs';\n")
replace('lib/decision.mjs',
 "  const publishedDvp=externalMatchup(context.publicDvp,{opponent:r.opponent,pos,stat:r.stat});\n"
 "  const defenseGrade=publishedDvp||defenseMatchup(dvp,{opponent:r.opponent,pos,stat:r.stat,zoneScore:r.zoneScore});",
 "  const publishedDvp=externalMatchup(context.publicDvp,{opponent:r.opponent,pos,stat:r.stat});\n"
 "  const eligibilityDvp=publishedDvp?null:publishedMatchup(context.publicDvp,context.publicPositions,\n"
 "   {team:r.team,player:r.player,opponent:r.opponent,stat:r.stat});\n"
 "  const defenseGrade=publishedDvp||eligibilityDvp||defenseMatchup(dvp,{opponent:r.opponent,pos,stat:r.stat,zoneScore:r.zoneScore});")
replace('lib/decision.mjs',
 "check('Defense vs position',defenseGrade.available?(defenseGrade.proxy?'proxy':'observed'):'pending',",
 "check('Defense vs position',defenseGrade.available?(defenseGrade.proxy?'partial':'observed'):'pending',")
replace('lib/decision.mjs',
 "defenseGrade.available?(defenseGrade.sourceUrl?`${defenseGrade.primary} · ${defenseGrade.allowedAverage} ${r.stat} allowed per game to ${defenseGrade.position} position (season table, not player forecast)`:`${defenseGrade.primary} · ${defenseGrade.allowedAverage} ${r.stat} per player (${defenseGrade.sample} observations)`):'Insufficient opponent sample for broad G/F/C defense grade; exact PG/SG/SF/PF/C needs independent data',",
 "defenseGrade.available?(defenseGrade.positionCandidates?`${defenseGrade.primary} · proxy grade ${r.side==='LESS'?defenseGrade.lessGrade:defenseGrade.grade} (possible positions ${defenseGrade.positionCandidates.join('/')} ; ${r.side==='LESS'?defenseGrade.range.less.join('–'):defenseGrade.range.more.join('–')} score range). Public fantasy eligibility, NOT confirmed game position. NBA.com as of ${defenseGrade.positionSourceDate}.`:(defenseGrade.sourceUrl?`${defenseGrade.primary} · ${defenseGrade.allowedAverage} ${r.stat} allowed per game to ${defenseGrade.position} position (season table, not player forecast)`:`${defenseGrade.primary} · ${defenseGrade.allowedAverage} ${r.stat} per player (${defenseGrade.sample} observations)`)):(context.publicDvp?.available?'No exact game-day position or published eligibility match for this player/team/stat':`Public DvP unavailable: ${context.publicDvp?.reason||'source not reached'}`),")
replace('lib/decision.mjs',
 "   matchupGrade:sideMatchup==null?null:{score:Math.round(sideMatchup),letter:grade(sideMatchup),direction:r.side,proxy:true},",
 "   matchupGrade:sideMatchup==null?null:{score:Math.round(sideMatchup),letter:r.side==='LESS'?defenseGrade.lessGrade:defenseGrade.grade,direction:r.side,proxy:Boolean(defenseGrade.proxy),position: (defenseGrade.positionCandidates||[defenseGrade.position]).join('/')},")
replace('lib/decision.mjs',
 "scoreVersion:'RFPP 2.2 · additional stat-specific opportunity, median, role stability, combined stats + public exact DvP',",
 "scoreVersion:'RFPP 2.3 · sourced DvP plus published fantasy position ranges, exact court slot distinguished',")
replace('lib/decision.mjs',
 "  all:rows,allCount:rows.length,qualified:eligible.length,sourceStatus:{espnInjuries:Boolean(context.injuriesFetched),licensedLineups:Boolean(context.lineupsFetched),lineupProviderError:context.lineupError||null,individualPrices:false,independentMinutes:false},",
 "  all:rows,allCount:rows.length,qualified:eligible.length,sourceStatus:{espnInjuries:Boolean(context.injuriesFetched),licensedLineups:Boolean(context.lineupsFetched),lineupProviderError:context.lineupError||null,individualPrices:false,independentMinutes:false,\n"
 "   publicDvp:{available:Boolean(context.publicDvp?.available),statsLoaded:context.publicDvp?.statsLoaded||[],reason:context.publicDvp?.reason||null,updatedAt:context.publicDvp?.updatedAt||null},\n"
 "   publishedPositions:{available:Boolean(context.publicPositions?.available),playerCount:context.publicPositions?.count||0,publishedAt:context.publicPositions?.publishedAt||null,live:Boolean(context.publicPositions?.live),reason:context.publicPositions?.reason||null},\n"
 "   sourcedExact:rows.filter(x=>x.defenseGrade?.available&&!x.defenseGrade.proxy).length,\n"
 "   sourcedEligibilityEstimates:rows.filter(x=>x.defenseGrade?.available&&x.defenseGrade.proxy&&x.defenseGrade.positionCandidates).length,\n"
 "   missingDefensiveMatches:rows.filter(x=>!x.defenseGrade?.available).length},")
replace('lib/decision.mjs',"scoringVersion:'2.2-expanded-evidence'","scoringVersion:'2.3-sourced-position-ranges'")

# Exact DvP gets full weight; fantasy eligibility estimates get a deliberately weaker weight.
replace('lib/edge-v3.mjs',
 " const dvp=exact?(less?defenseGrade.lessScore:defenseGrade.score):null;",
 " const estimate=Boolean(defenseGrade?.available&&defenseGrade?.proxy&&\n"
 "  Array.isArray(defenseGrade.positionCandidates)&&finite(defenseGrade.score)&&finite(defenseGrade.lessScore));\n"
 " const dvp=(exact||estimate)?(less?defenseGrade.lessScore:defenseGrade.score):null;")
replace('lib/edge-v3.mjs',
 "  exactDvp:exact?clamp((dvp-50)*.17,-8.5,8.5):0,\n  shotZone:!exact&&shotMatch!==null?clamp((shotMatch-50)*.07,-3.5,3.5):0,",
 "  exactDvp:exact?clamp((dvp-50)*.17,-8.5,8.5):0,\n"
 "  eligibilityDvp:estimate?clamp((dvp-50)*.065,-3.25,3.25):0,\n"
 "  shotZone:!exact&&!estimate&&shotMatch!==null?clamp((shotMatch-50)*.07,-3.5,3.5):0,")
replace('lib/edge-v3.mjs',
 " if(exact)strengths.push('Exact '+defenseGrade.position+' DvP '+round(dvp)+'/100 ('+defenseGrade.sample+' opponent player games)');",
 " if(exact)strengths.push('Sourced exact '+defenseGrade.position+' DvP '+round(dvp)+'/100');\n"
 " if(estimate)strengths.push('Published-position '+defenseGrade.positionCandidates.join('/')+' DvP ESTIMATE '+round(dvp)+'/100; source-backed eligibility, not game slot');")
replace('lib/edge-v3.mjs',
 " if(!exact)warnings.push('Exact PG/SG/SF/PF/C stat DvP unavailable; broad G/F/C is descriptive only');",
 " if(!exact)warnings.push(estimate?'Court matchup position unconfirmed; lower-weight published-position estimate used':'Exact PG/SG/SF/PF/C stat DvP unavailable; broad G/F/C is descriptive only');")

# Full source report uses the same DvP/position resolution as the board.
insert('lib/insight.mjs',"import {buildDvpIndex,defenseMatchup} from './dvp.mjs';",
 "import {externalMatchup} from './public-dvp.mjs';\nimport {publishedMatchup} from './published-positions.mjs';\n")
replace('lib/insight.mjs',
 " result.defenseGrade=defenseMatchup(buildDvpIndex(gameCache,rosters,day),{opponent,pos:who.pos,stat:offerStat,zoneScore:result.shotZone?.score??null});",
 " const courtPos=activeLineup?.pos||who.pos;\n"
 " const publicExact=externalMatchup(context.publicDvp,{opponent,pos:courtPos,stat:offerStat});\n"
 " const publicEstimate=publicExact?null:publishedMatchup(context.publicDvp,context.publicPositions,{team,player:who.name,opponent,stat:offerStat});\n"
 " result.defenseGrade=publicExact||publicEstimate||defenseMatchup(buildDvpIndex(gameCache,rosters,day),{opponent,pos:courtPos,stat:offerStat,zoneScore:result.shotZone?.score??null});")

# Public card and sorting. Put actual score, primary position/range, source accuracy.
insert('public/clean.js',"function renderPicks(){", "function defenseText(d,side){if(!d?.available)return 'NOT VERIFIED';\n"
 " const pos=d.positionCandidates?.join('/')||d.position||'unknown';\n"
 " if(d.positionCandidates){const rng=d.range?.[side==='LESS'?'less':'more'];return side+' · '+pos+' EST. FANTASY POSITION'+(rng?' · '+rng.join('–')+'/100 range':'');}\n"
 " return side+' · '+pos+' · SOURCED EXACT POSITION';}\n")
replace('public/clean.js',
 "<small>${match.available?esc(c.side)+' · '+esc(match.rank)+'/'+esc(match.totalTeams)+' · G/F/C proxy':'NOT VERIFIED'}</small>",
 "<small>${esc(defenseText(match,c.side))}</small>")
replace('public/clean.js',
 "<small>${def.available?'EXACT VS DEF':'DVP PENDING'}</small>",
 "<small>${def.available?(def.proxy?'POSITION EST.':'EXACT VS DEF'):'DVP PENDING'}</small>")
replace('public/clean.js',
 " if(direction==='EXACT_DVP')pool=pool.filter(x=>x.defenseGrade?.available&&!x.defenseGrade.proxy&&x.state!=='PASS');",
 " if(direction==='EXACT_DVP')pool=pool.filter(x=>x.defenseGrade?.available&&!x.defenseGrade.proxy&&x.state!=='PASS');\n"
 " if(direction==='ANY_DVP')pool=pool.filter(x=>x.defenseGrade?.available&&x.state!=='PASS');")
replace('public/clean.js',
 "position-specific public DvP when successfully refreshed · scores are NOT probabilities",
 "${d.sourceStatus?.sourcedExact??0} exact matchup directions · ${d.sourceStatus?.sourcedEligibilityEstimates??0} sourced position estimates · scores are NOT probabilities")
replace('public/index.html',
 '<option value="EXACT_DVP">Exact position matchup available</option>',
 '<option value="EXACT_DVP">Exact position matchup available</option><option value="ANY_DVP">All sourced defensive matchups</option>')
replace('public/index.html','SMART NBA RESEARCH · RFPP 2.2','SMART NBA RESEARCH · RFPP 2.3')
replace('public/insight-ui.js',
 "const matchup=selected?.defenseGrade?.available&&!selected.defenseGrade.proxy?selected.defenseGrade:{available:false,notes:'Exact position matchup not independently sourced.'};",
 "const matchup=selected?.defenseGrade?.available?selected.defenseGrade:(d.defenseGrade||{available:false,notes:'No source-backed position DvP available.'});")
replace('public/insight-ui.js',
 "<b>${matchup?.available?esc(matchup.rank)+'/'+esc(matchup.totalTeams):'—'}</b><span>DEFENSE RANK</span>",
 "<b>${matchup?.positionCandidates?esc(matchup.positionCandidates.join('/')):matchup?.available&&matchup.rank!=null?esc(matchup.rank)+'/'+esc(matchup.totalTeams):'—'}</b><span>${matchup?.positionCandidates?'PUBLISHED ELIGIBILITY':'DEFENSE RANK'}</span>")
replace('public/insight-ui.js',
 "<small>${matchup?.sourceUrl?'Public DvP: #1 MOST allowed; #30 LEAST allowed':'#1 toughest; larger rank softer'}</small>",
 "<small>${matchup?.positionCandidates?'NBA.com Sept 29 · position not confirmed':matchup?.sourceUrl?'NBA House: #1 MOST allowed':'#1 toughest; larger rank softer'}</small>")
replace('public/insight-ui.js',
 "<small>${matchup?.available?'MORE '+esc(matchup.score)+'/100 · LESS '+esc(matchup.lessScore)+'/100':'Not scored'}</small>",
 "<small>${matchup?.available?'MORE '+esc(matchup.score)+'/100 · LESS '+esc(matchup.lessScore)+'/100'+(matchup.positionCandidates?' · eligibility proxy':''):'Not scored'}</small>")
replace('public/insight-ui.js',
 "${esc(matchup?.notes||'Opponent position comparison requires ESPN prior box scores; not the same as exact FantasyPros PG/SG/SF/PF/C DvP.')}",
 "${esc(matchup?.notes||'Opponent position comparison needs a sourced position; unavailable scores remain blank.')}")

replace('server.mjs',"version:'2.2.0'","version:'2.3.0'")
meta=ROOT/'package.json'; p=json.loads(meta.read_text());p['version']='2.3.0';p.setdefault('scripts',{}).pop('pretest',None);meta.write_text(json.dumps(p,indent=2)+'\n')
print('RFPP 2.3 source-backed position fixes applied; running entire npm test suite.')
