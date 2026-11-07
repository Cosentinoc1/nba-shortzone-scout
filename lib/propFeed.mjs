/** NBA Scout props feed adapter.
 * All providers are independent, documented APIs or a user-published CSV.
 * Server-side keys are never forwarded to browsers. No PrizePicks private endpoint.
 * ParlayAPI: https://api.parlay-api.com/docs (/v1/sports/{sport}/props)
 */
import { readFileSync } from 'node:fs';
import { keyName } from './model.mjs';
import { parseCsv, normalizeRows, freshness } from './props.mjs';

const ROSTERS = JSON.parse(readFileSync(new URL('../data/rosters.json', import.meta.url), 'utf8'));
const MAX_BODY = 16 * 1024 * 1024;
const SUCCESS_TTL_MS = 150 * 60000;  // ≤ 864 three-credit calls in a 30-day month even if always awake.
const ERROR_TTL_MS = 20 * 60000;
const FOREVER_MONTH = 32 * 86400000;
const MARKET = {
  player_points: 'Points', player_rebounds: 'Rebounds', player_assists: 'Assists',
  player_threes: '3-Pointers Made', player_three_pointers: '3-Pointers Made', player_three_pointers_made:'3-Pointers Made',
  player_pra: 'Pts+Rebs+Asts', player_pts_rebs_asts: 'Pts+Rebs+Asts', player_pts_rebs: 'Pts+Rebs',
  player_pts_asts: 'Pts+Asts', player_rebs_asts: 'Rebs+Asts',
  player_fg_attempts: 'FG Attempts', player_field_goal_attempts: 'FG Attempts', player_threes_attempted: '3PA', player_three_point_attempts:'3PA',
  player_ft_made: 'Free Throws Made'
};
const alias = new Map();
for (const [team, players] of Object.entries(ROSTERS)) {
  for (const p of players) {
    const k = keyName(p.name);
    if (!alias.has(k)) alias.set(k, team);
    else if (alias.get(k) !== team) alias.set(k, null); // never guess ambiguous player identity
  }
}
function stamp(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number') value = new Date(value > 1e11 ? value : value * 1000).toISOString();
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}
function errFrom(status, text, headers) {
  let info = {};
  try { info = JSON.parse(text); } catch {}
  const code = String(info?.error?.code || info?.error || info?.code || `HTTP_${status}`).slice(0, 90);
  const r = Number(headers.get('retry-after'));
  const e = new Error(`Feed HTTP ${status} (${code})`);
  e.status = status;
  e.code = code;
  e.retryAfterSeconds = Number.isFinite(r) && r > 0 ? r : null;
  return e;
}
async function fetchData(url, headers = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(url, { headers: { Accept: 'application/json', ...headers }, signal: controller.signal });
    const length = Number(response.headers.get('content-length') || 0);
    if (length > MAX_BODY) throw new Error('Provider exceeded the maximum response size');
    const text = await response.text();
    if (text.length > MAX_BODY) throw new Error('Provider response exceeded the maximum size');
    if (!response.ok) throw errFrom(response.status, text, response.headers);
    return { text, headers: response.headers };
  } finally { clearTimeout(timeout); }
}
/** Adapts ParlayAPI's independent NBA PrizePicks rows to our existing standard-line model. */
export function normalizeParlayRows(input, rosterMap = alias) {
  if (!Array.isArray(input)) return [];
  const adapted = [];
  for (const row of input) {
    if (!row || !['prizepicks', 'prizepicks_mobile'].includes(String(row.bookmaker || '').toLowerCase())) continue;
    // Do not assume unknown tiers or segments are standard, full-game offers.
    const tier = String(row.odds_type || row.projection_type || '').toLowerCase();
    if (tier !== 'standard' || String(row.period || '').toUpperCase() !== 'FULL') continue;
    const market = MARKET[String(row.market_key || '').toLowerCase()];
    if (!market || !row.player || row.line == null) continue;
    const provided = row.team_abbr || row.team;
    const team = /^[A-Za-z]{3}$/.test(String(provided || '')) ? provided : rosterMap.get(keyName(row.player));
    if (!team || !/^[A-Z]{3}$/.test(String(team).toUpperCase())) continue;
    let observed = stamp(row.last_observed) || stamp(row.last_update_ms) || stamp(row.last_update);
    // Age is an observation-age signal; only use it when a capture clock exists.
    if (!observed && Number.isFinite(row.age_seconds) && row.age_seconds >= 0)
      observed = new Date(Date.now() - row.age_seconds * 1000).toISOString();
    if (!observed) continue;
    if (Number.isFinite(row.age_seconds) && row.age_seconds > 3600) continue;
    const start = stamp(row.commence_time);
    adapted.push({
      player: row.player, team: String(team).toUpperCase(), stat: market,
      line: row.line, tier: 'standard', period: 'Full game',
      Sides: 'more, less', // provider's normalized odds are NOT proof both directions are actually offered
      observed_at: observed, starts_at: start, id: row.native_identity?.id || row.id || null
    });
  }
  return normalizeRows(adapted);
}
/** All observed provider offers are shown as read-only, including tiers the model must not rank. */
export function listParlayOffers(input, rosterMap=alias){
 if(!Array.isArray(input))return [];
 return input.filter(r=>r&&r.line!=null&&r.line!==''&&['prizepicks','prizepicks_mobile'].includes(String(r.bookmaker||'').toLowerCase()))
 .slice(0,10000).map(r=>{
  const name=String(r.player||'').slice(0,120), market=String(r.market_key||'').slice(0,100);
  const provided=String(r.team_abbr||r.team||'').toUpperCase();
  const team=/^[A-Z]{3}$/.test(provided)?provided:rosterMap.get(keyName(name))||null;
  const line=Number(r.line),tier=String(r.odds_type||r.projection_type||'unverified').toLowerCase().slice(0,30);
  let observed=stamp(r.last_observed)||stamp(r.last_update_ms)||stamp(r.last_update);
  if(!observed&&Number.isFinite(r.age_seconds))observed=stamp(Date.now()-r.age_seconds*1000);
  return {player:name,team,market:MARKET[market]||market,line:Number.isFinite(line)?line:null,
   tier,period:String(r.period||'unknown'),startsAt:stamp(r.commence_time),observedAt:observed,source:String(r.bookmaker)};
 }).filter(r=>r.player&&r.line!=null);
}
async function fromParlay(key) {
  // One scoped call (3 credits). 10k limit is documented; do not silently treat truncation as complete.
  const u = new URL('https://parlay-api.com/v1/sports/basketball_nba/props');
  u.searchParams.set('bookmakers', 'prizepicks,prizepicks_mobile');
  u.searchParams.set('limit', '10000');
  u.searchParams.set('maxAgeSec', '3600');
  const { text, headers } = await fetchData(u.href, { 'X-API-Key': key });
  let parsed;
  try { parsed = JSON.parse(text); } catch { throw Error('ParlayAPI returned invalid JSON'); }
  if (!Array.isArray(parsed)) throw Error('ParlayAPI did not return a props array');
  const rows = normalizeParlayRows(parsed);
  const offers=listParlayOffers(parsed);
  const incomplete = headers.get('x-result-truncated') === 'true'
    || headers.get('x-result-degraded')==='true' || headers.get('x-result-has-more') === 'true';
  const offered = parsed.filter(x=>['prizepicks','prizepicks_mobile'].includes(String(x.bookmaker||'').toLowerCase()));
  const coverage={providerRows:parsed.length,prizepicksRows:offered.length,standardSupported:rows.length,
   otherTiersOrUnsupported:Math.max(0,offered.length-rows.length),
   rowCountHeader:Number(headers.get('x-result-row-count'))||null,
   hasMore:headers.get('x-result-has-more')==='true',
   truncated:headers.get('x-result-truncated')==='true',
   degraded:headers.get('x-result-degraded')==='true',
   scope:'PrizePicks NBA lines observed by provider within the last hour; not guaranteed all offers on PrizePicks'};
  return {rows,offers,incomplete:incomplete||coverage.hasMore,coverage,notice:incomplete?'Provider reported incomplete coverage; verify missing players and lines directly.':'Provider coverage is not guaranteed to match every line in the PrizePicks app.'};
}
async function fromPrizepicksApi(key) {
  let data = [], cursor = null;
  for (let i = 0; i < 5; i++) {
    const u = new URL('https://prizepicksapi.com/api/v1/projections');
    for (const [name, value] of Object.entries({ league: 'NBA', tier: 'standard', status: 'active', view: 'compact', limit: '1000' }))
      u.searchParams.set(name, value);
    if (cursor) u.searchParams.set('cursor', cursor);
    const { text } = await fetchData(u.href, { Authorization: `Bearer ${key}`, 'X-User-Request': 'NBA Scout current standard-line feed' });
    let body;
    try { body = JSON.parse(text); } catch { throw Error('PrizePicksAPI returned invalid JSON'); }
    if (!Array.isArray(body.data)) throw Error('PrizePicksAPI response omitted projection rows');
    data.push(...body.data);
    cursor = body.meta?.next_cursor || null;
    if (!cursor) return { rows: normalizeRows(data), incomplete: false, notice: null };
  }
  return { rows: normalizeRows(data), incomplete: true, notice: 'API pagination limit reached; this may not be the complete board.' };
}
async function fromSheet(url) {
  const u = new URL(url);
  if (u.protocol !== 'https:' || !['docs.google.com', 'script.google.com'].includes(u.hostname))
    throw Error('PROPS_CSV_URL must be a user-published HTTPS Google Sheets or Apps Script CSV');
  const { text } = await fetchData(url, {});
  return { rows: normalizeRows(parseCsv(text)), incomplete: false, notice: null };
}
let cache = { fetchedAt: 0, nextTry: 0, identifier: '', result: null }, pending = null;
function monthReset(now = Date.now()) {
  const d = new Date(now);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) - now;
}
function isMonthlyQuota(error) { return error?.code === 'MONTHLY_QUOTA_EXCEEDED'; }
export async function loadPropsFeed() {
  const keyParlay = process.env.PARLAY_API_KEY?.trim();
  const keyPP = process.env.PRIZEPICKS_API_KEY?.trim();
  const urlCSV = process.env.PROPS_CSV_URL?.trim();
  const options = [
    ...(keyParlay ? [{ source: 'ParlayAPI · PrizePicks NBA', call: () => fromParlay(keyParlay) }] : []),
    ...(keyPP ? [{ source: 'Independent PrizePicksAPI', call: () => fromPrizepicksApi(keyPP) }] : []),
    ...(urlCSV ? [{ source: 'User-published NBA CSV', call: () => fromSheet(urlCSV) }] : [])
  ];
  if (!options.length) return {
    configured: false, source: 'Not configured', rows: [], fetchedAt: null,
    status: 'not-configured', error: null,
    notice: 'Add a free provider key in Render (PARLAY_API_KEY), use the existing PRIZEPICKS_API_KEY, or import a current CSV.'
  };
  const identifier = options.map(x => x.source).join('|');
  if (cache.identifier === identifier && cache.result && Date.now() < cache.nextTry) return cache.result;
  if (pending) return pending;
  pending = (async () => {
    const errors = [];
    let longestBackoff = ERROR_TTL_MS;
    for (const option of options) {
      try {
        const { rows, offers, incomplete, notice, coverage } = await option.call();
        if (!rows.length && !(offers?.length)) { errors.push(`${option.source}: no supported NBA props or observed offers`); continue; }
        const result = {
          configured: true, source: option.source, rows, offers:offers||rows.map(r=>({...r,tier:'standard',market:r.stat,period:'full'})), fetchedAt: new Date().toISOString(),
          status: !rows.length||incomplete ? 'partial' : 'ok', freshness: freshness(rows), coverage:coverage||null,
          error: null, notice: !rows.length?'Only nonstandard or unsupported offers were observed; no props are eligible for the Top 6 screen.':(notice || (errors.length ? `Other source unavailable: ${errors.join('; ')}` : null)),
          // A missing direction offer must be verified in the PrizePicks app.
          directionsUnverified: option.source.startsWith('ParlayAPI')
        };
        cache = { identifier, result, fetchedAt: Date.now(), nextTry: Date.now() + SUCCESS_TTL_MS };
        return result;
      } catch (e) {
        errors.push(`${option.source}: ${e.message}`);
        if (isMonthlyQuota(e)) longestBackoff = Math.max(longestBackoff, monthReset());
        else if (e.retryAfterSeconds) longestBackoff = Math.max(longestBackoff, e.retryAfterSeconds * 1000);
      }
    }
    const result = {
      configured: true, source: options.map(x => x.source).join(' → '), rows: [],
      fetchedAt: new Date().toISOString(), status: 'error', error: errors.join(' | '),
      freshness: freshness([]), notice: 'Do not use stale lines. Confirm provider status or import current CSV.'
    };
    cache = { identifier, result, fetchedAt: Date.now(), nextTry: Date.now() + Math.min(longestBackoff, FOREVER_MONTH) };
    return result;
  })();
  try { return await pending; } finally { pending = null; }
}
export function feedStatusOnly(feed) { const { rows, offers, ...other } = feed; return { ...other, count: rows.length, allObservedCount:(offers||rows||[]).length }; }
