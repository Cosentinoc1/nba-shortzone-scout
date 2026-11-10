#!/usr/bin/env node
/**
 * NBA Scout daily pregame archive and official postgame audit.
 * - No hindsight snapshots. A missing feed is recorded as NOT FROZEN, not 0%.
 * - First valid pretip shortlist is immutable.
 * - Daily records are committed by the scheduled GitHub Actions workflow.
 */
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {summaries, pretipCandidates, gradePick, extractESPNPlayers, matchPlayer, dateInChicago} from './review-lib.mjs';

const HISTORY = new URL('../public/review/history.json', import.meta.url);
const SITE = (process.env.NBA_SCOUT_URL || 'https://nba-shotzone-scout.onrender.com').replace(/\/$/, '');
const cmd = process.argv[2] || 'capture';
const now = new Date();
const yesterday = new Date(now.getTime() - 86400000);
const target = process.argv.find(x => /^\d{4}-\d{2}-\d{2}$/.test(x)) || dateInChicago(cmd === 'grade' ? yesterday : now);
const history = JSON.parse(await readFile(HISTORY, 'utf8'));
if (!Array.isArray(history.days)) throw Error('Malformed review history; refusing to overwrite');
const findDay = () => history.days.find(d => d.date === target);
const preserve = d => Boolean(d?.snapshot?.picks?.length || d?.status === 'audited');

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {'Accept':'application/json', 'Cache-Control':'no-cache', 'User-Agent':'nba-scout-review/3.14'},
    signal:AbortSignal.timeout(28000)
  });
  if (!response.ok) throw Error(`HTTP ${response.status} from ${new URL(url).pathname}`);
  return response.json();
}
function putDay(day) {
  const index = history.days.findIndex(x => x.date === target);
  if (index < 0) history.days.push(day);
  else history.days[index] = day;
  history.days.sort((a,b) => b.date.localeCompare(a.date));
  history.updatedAt = new Date().toISOString();
}
async function save() {
  await mkdir(new URL('../public/review/', import.meta.url), {recursive:true});
  await writeFile(HISTORY, JSON.stringify(history, null, 2) + '\n');
}
function recordStatus(status, message, extra = {}) {
  const existing = findDay();
  if (preserve(existing)) return false;
  const checks = Array.isArray(existing?.captureChecks) ? existing.captureChecks.slice(-19) : [];
  checks.push({at:now.toISOString(), status, message});
  putDay({
    date:target, status, scoringVersion:extra.scoringVersion || existing?.scoringVersion || 'RFPP 2.7',
    message, source:extra.source || existing?.source || {site:SITE,provider:'NBA Scout live ranked API',observedAt:null,providerSidesVerified:false},
    snapshot:null, audit:existing?.audit || null,
    captureChecks:checks, captureAttempts:checks.length,
    observedBoard:extra.observedBoard || existing?.observedBoard || null
  });
  return true;
}
function gameTiming(games) {
  const list = Array.isArray(games) ? games : [];
  return {
    games:list.length,
    beforeTip:list.filter(g => !g.completed && Date.parse(g.tipoff||'') > now.getTime() + 5*60000).length,
    final:list.filter(g => g.completed).length
  };
}
async function capture() {
  if (findDay()?.snapshot?.picks?.length) { console.log(`${target}: already frozen; refusing overwrite`); return; }
  if (target !== dateInChicago(now)) throw Error('Cannot capture an earlier slate retrospectively: historical picks must not be invented');
  let board;
  try {board = await fetchJson(`${SITE}/api/picks?date=${target}`);}
  catch (error) {
    recordStatus('not_frozen', `Pregame capture failed (${error.message}). Retry scheduled; no picks or result percentage can be claimed.`,
      {source:{site:SITE,provider:'NBA Scout /api/picks',observedAt:now.toISOString(),providerSidesVerified:false}});
    await save();console.warn(`${target}: pretip fetch failed: ${error.message}`);return;
  }
  const pickList = pretipCandidates(board, now);
  const fromFeatured = list => (Array.isArray(list) ? list : []).filter(p =>
    p?.team && p?.opponent && p?.player && Number.isFinite(Number(p.line)) &&
    ['MORE','LESS'].includes(p.side) && Date.parse(p.gameTipoff||'') > now.getTime()+5*60000
  ).map(p => ({board:'Featured Top 5',player:p.player,team:p.team,opponent:p.opponent,stat:p.stat,
    side:p.side,line:Number(p.line),rank:p.rank||null,detailKey:p.detailKey,
    pregameResearchStatus:p.entryStatus||'NOT APPROVED',quality:p.confidence||null}));
  const featured={top2:fromFeatured(board.featuredPicks?.top2),top5:fromFeatured(board.featuredPicks?.top5)};
  const directional = pickList.filter(p => p.board !== 'Bottom 10');
  const freshness = board.feed?.freshness || {};
  const sourceFresh = freshness.status === 'fresh' && Number(freshness.ageMinutes) <= 120;
  const timing = gameTiming(board.games);
  const qualified = Number(board.qualified || 0);
  const source = {site:SITE, provider:board.feed?.source || 'NBA Scout /api/picks',
    observedAt:freshness.observedAt || null, providerSidesVerified:board.feed?.directionsUnverified === false};
  const observedBoard = {standardLines:Number(board.boardCount || 0),matchedDirections:Number(board.matched || 0),
    qualifiedDirections:qualified, pretipGames:timing.beforeTip, games:timing.games, feedFresh:sourceFresh};

  if (!timing.games) {
    recordStatus('not_frozen', 'NBA schedule contained no verifiable games. No frozen rankings.', {source,observedBoard});
  } else if (!timing.beforeTip) {
    recordStatus('not_frozen', 'Capture ran after the scheduled games started or finished; no retrospective Top 10 has been invented.', {source,observedBoard});
  } else if (!sourceFresh) {
    recordStatus('not_frozen', `Line feed not independently fresh at capture (${freshness.status || 'unverified'}). No picks frozen.`, {source,observedBoard});
  } else if (!directional.length) {
    recordStatus('no_qualified', `No eligible ranked pre-tip picks among ${observedBoard.standardLines} observed lines / ${observedBoard.matchedDirections} scored directions; not a 0% result.`, {source,observedBoard});
  } else {
    const day = {date:target,status:'frozen',scoringVersion:board.scoringVersion||'RFPP 2.7',
      message:`Captured ${directional.length} directional research picks before their games. Some earlier games may be excluded. Not betting approvals.`,
      source,observedBoard,
      snapshot:{capturedAt:now.toISOString(), qualified, picks:pickList, featured, gameCount:timing.games,
        pretipVerified:true, pretipGames:timing.beforeTip, totalGames:timing.games},
      audit:findDay()?.audit || null};
    putDay(day);
  }
  await save();console.log(`${target}: ${findDay()?.status}; ${directional.length} exact pretip directional picks`);
}
async function grade() {
  const day = findDay();
  if (!day?.snapshot?.picks?.length) {console.log(`${target}: no frozen snapshot, grade correctly skipped`);return;}
  if (day.status === 'audited') {console.log(`${target}: already audited, preserving result`);return;}
  let scoreboard;
  try {scoreboard = await fetchJson(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${target.replaceAll('-','')}`);}
  catch(error) {console.warn(`${target}: scoreboard unavailable; retry later: ${error.message}`);return;}
  const events = scoreboard.events || [];
  if (!events.length) {console.warn(`${target}: no ESPN games; retry later`);return;}
  const teamEvents = new Map();
  for (const event of events) {
    for (const side of event.competitions?.[0]?.competitors || [])
      teamEvents.set(String(side.team?.abbreviation||'').toUpperCase(), event);
  }
  const summaryCache = new Map();
  const picks = [];
  const featuredInput=Array.isArray(day.snapshot.featured?.top5)?day.snapshot.featured.top5:[];
  for (const p of [...day.snapshot.picks,...featuredInput]) {
    const event = teamEvents.get(String(p.team).toUpperCase());
    const teams = (event?.competitions?.[0]?.competitors || []).map(c => String(c.team?.abbreviation||'').toUpperCase());
    if (!event || !teams.includes(p.opponent)) {
      picks.push({...p, result:'UNVERIFIED', actual:null, notes:'Could not verify official team/opponent identity'});continue;
    }
    if (!event.status?.type?.completed) {
      picks.push({...p,result:'PENDING',actual:null,notes:'Game has not been officially marked final'});continue;
    }
    const id = String(event.id);
    if (!summaryCache.has(id)) {
      try {summaryCache.set(id, extractESPNPlayers(await fetchJson(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${id}`)));}
      catch(e) {console.warn(`ESPN summary ${id} failed: ${e.message}`);summaryCache.set(id, null);}
    }
    const athletes = summaryCache.get(id);
    if (!athletes) {picks.push({...p,result:'UNVERIFIED',actual:null,notes:'Official box-score request temporarily failed'});continue;}
    const player = matchPlayer(p,athletes);
    if (!player) {picks.push({...p,result:'UNVERIFIED',actual:null,notes:'Player was not uniquely matched to the official team box score; do not assume DNP'});continue;}
    picks.push(gradePick(p,player));
  }
  const featuredResults=picks.filter(p=>p.board==='Featured Top 5');
  const originalResults=picks.filter(p=>p.board!=='Featured Top 5');
  const top2Keys=new Set((day.snapshot.featured?.top2||[]).map(p=>p.detailKey));
  const featuredTop2=featuredResults.filter(p=>top2Keys.has(p.detailKey));
  const pending = picks.some(p => ['PENDING','UNVERIFIED'].includes(p.result));
  day.audit = {gradedAt:new Date().toISOString(),source:'ESPN official final NBA box scores',
    picks:originalResults,summary:summaries(originalResults),
    featured:{top2:featuredTop2,top5:featuredResults,
      resultsOnly:true,pregameVerified:day.snapshot?.pretipVerified===true},
    allGamesFinal:events.every(e=>e.status?.type?.completed)};
  day.status = pending ? 'partial' : 'audited';
  day.message = pending ? 'Partial review: unresolved picks excluded from hit-rate calculations; will retry.' : 'Official postgame box-score audit completed';
  putDay(day);await save();
  console.log(`${target}: ${day.status} (${day.audit.summary.recommended.wins}/${day.audit.summary.recommended.graded} directional wins)`);
}
if (cmd === 'capture') await capture();
else if (cmd === 'grade') await grade();
else throw Error('Usage: node scripts/update-review.mjs capture|grade [YYYY-MM-DD]');
