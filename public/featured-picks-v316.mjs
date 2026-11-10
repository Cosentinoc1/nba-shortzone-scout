/** NBA Scout v3.16: clear actionable research, never fabricated betting certainty. */
const esc=x=>String(x??'—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const title={PTS:'points',REB:'rebounds',AST:'assists','3PM':'made threes',PRA:'points + rebounds + assists',PR:'points + rebounds',PA:'points + assists',RA:'rebounds + assists',FTM:'made free throws',FGA:'field-goal attempts','3PA':'three-point attempts','2PM':'made twos'};
const state={count:2};
function why(x){return (x.reasons||[]).map(p=>`<div class="fp-reason fp-${esc(p.kind||'neutral')}"><strong>${esc(p.label)}</strong><p>${esc(p.text)}</p><small>${esc(p.source)}</small></div>`).join('');}
function sourceGrid(p){return `<div class="fp-sources">${(p.sourceCoverage||[]).map(c=>`<div class="fp-source"><strong>${esc(c.name)}</strong><span class="fp-source-state ${/^(SOURCED|CONFIRMED|VERIFIED)$/.test(c.state)?'fp-source-ok':c.state==='MISSING'||c.state==='UNFAVORABLE'?'fp-source-missing':'fp-source-proxy'}">${esc(c.state)}</span><small>${esc(c.source)}</small></div>`).join('')}</div>`;}
function card(p,i){const side=p.side==='LESS'?'LESS':'MORE',status=p.entryReady?'approved':'pending',h=p.lastTen||{},last20=p.lastTwenty||{},match=p.matchupStrength;
 return `<article class="fp-card" data-fp-card="${i}"><div class="fp-card-top"><span class="fp-rank">#${i+1} · ${state.count===2?'BEST 2':'BEST 5'} RESEARCH</span><span class="fp-evidence">${esc(p.confidence)} · ${esc(p.signalCount)}/6 supporting pillars</span></div>
 <div class="fp-person"><h3>${esc(p.player)}</h3><p>${esc(p.team)} vs ${esc(p.opponent)} · ${esc(p.researchTier)} research · RFPP ${esc(p.score)}/100 (not win %)</p></div>
 <div class="fp-pick"><span class="fp-side fp-${side.toLowerCase()}">${side}</span><div><b>${esc(p.line)} ${esc(title[p.stat]||p.stat)}</b><span>STANDARD LINE · confirm selectable before game</span></div></div>
 <div class="fp-stat-strip"><div><b>${h.resolved?esc(h.wins)+'W / '+esc(h.losses)+'L':'—'}</b><small>LAST 10 RESOLVED · ${esc(h.pushes||0)} PUSH</small></div><div><b>${last20.sample?esc(last20.win)+'W / '+esc(last20.loss)+'L':'—'}</b><small>LAST 20 · ${esc(last20.push||0)} PUSH</small></div><div><b>${p.usage?.rank?'#'+esc(p.usage.rank):'—'}</b><small>TEAM ${p.stat==='AST'?'ASSIST':p.stat==='REB'?'REBOUND':'SHOT'} RANK · PROXY</small></div></div>
 <div class="fp-status fp-${status}"><strong>${p.entryReady?'Research checks present — verify live offer':'PRE-GAME RESEARCH · NOT AN AUTOMATIC LOCK'}</strong><span>${esc(p.entryStatus)}</span></div>
 <div class="fp-reasons">${why(p)}</div>
 <div class="fp-bottom"><div class="fp-risk"><b>Why could this miss?</b><ul>${(p.risks?.length?p.risks:['Minutes, foul trouble, game script or a changed line can invalidate any projection.']).slice(0,3).map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>
 <details class="fp-checks"><summary>Remaining final-veto checks (${p.checks?.length||0})</summary><ul>${(p.checks||[]).map(t=>`<li>${esc(t)}</li>`).join('')||'<li>Reconfirm the line, active status, minutes and payout before entry.</li>'}</ul></details>
 <details class="fp-checks"><summary>Source verification — every box accounted for</summary>${sourceGrid(p)}<p class="fp-source-disclaimer">A source being fetched does not establish that the player is confirmed active. A historical proxy never becomes verified usage, rebound chances or potential assists.</p></details>
 <button type="button" class="fp-full" data-fp-open="${i}">Open complete player breakdown</button></div></article>`;
}
export function renderFeaturedPicks(board,open){const node=document.getElementById('featuredPicks');if(!node)return;
 const data=board?.featuredPicks;
 if(!data){node.innerHTML='<div class="fp-loading">Loading NBA research. Open Top 10 to inspect the standard board.</div>';return;}
 const rows=state.count===5?data.top5||[]:data.top2||[];
 node.innerHTML=`<div class="fp-header"><div><span class="fp-overline">START HERE · THE DAILY MATCHUP DESK</span><h2>Best 2 <em>or</em> Best 5 today</h2><p>Tap two picks and read why: actual player role, attempts and playstyle, the opposing defense's weakness, minutes and injuries, historical results and risks.</p></div><div class="fp-switch" role="group" aria-label="Show best two or best five"><button type="button" data-fp-count="2" aria-pressed="${state.count===2}">Top 2</button><button type="button" data-fp-count="5" aria-pressed="${state.count===5}">Top 5</button></div></div>
 <div class="fp-caution"><strong>${esc(data.status==='no_supported_candidates'?'No defensible pregame candidate is available':rows.length?'Closest evidence-supported picks today · verify before submitting':'No picks passed source checks for the day')}</strong><p>${esc(data.message||'Every selection needs evidence.')}</p></div>
 <div class="fp-cards">${rows.length?rows.map(card).join(''):'<div class="fp-empty">No sufficiently supported pregame research candidates. Refresh closer to tipoff or upload today’s RotoWire projections. This page never forces a Top 2 or Top 5.</div>'}</div>
 <p class="fp-note">${esc(data.qualifiedCandidates||0)} pretip candidates passed preliminary screening. All scores describe research quality, not a calibrated chance of winning. Top 2 and Top 5 cannot be considered independent or parlay-safe without price/correlation analysis. This site uses standard lines only; the videos' alternate PRA sportsbook prices do not apply to PrizePicks standard-line payouts.</p>
 <div class="fp-source-links">Research sources: <a href="https://www.nbahouse.net/defense-vs-position" target="_blank" rel="noopener noreferrer">position-specific DvP</a> · <a href="https://www.rotowire.com/basketball/nba-lineups.php" target="_blank" rel="noopener noreferrer">RotoWire lineups</a> · <a href="https://rotogrinders.com/lineuphq" target="_blank" rel="noopener noreferrer">RotoGrinders projections</a> · <a href="https://official.nba.com/nba-injury-report-2026-27-season/" target="_blank" rel="noopener noreferrer">NBA injury reports</a> · <a href="https://www.espn.com/nba/" target="_blank" rel="noopener noreferrer">ESPN box scores/news</a>. Linked sources are not automatic verified integrations.</div>`;
 node.querySelectorAll('[data-fp-count]').forEach(b=>b.addEventListener('click',()=>{state.count=Number(b.dataset.fpCount);renderFeaturedPicks(board,open)}));
 node.querySelectorAll('[data-fp-open]').forEach(b=>b.addEventListener('click',()=>{const item=rows[Number(b.dataset.fpOpen)];if(!item)return;const found=(board.all||[]).find(x=>[x.player,x.team,x.opponent,x.stat,x.side,x.line].join('|')===item.detailKey);if(found)open(found)}));
}
/** Same live feed, no fake filled boxes: readable source audit for every tab. */
export function renderSourcePulse(board){const target=document.getElementById('sourcePulse');if(!target)return;
 const s=board?.sourceStatus||{},rw=board?.rotowireStatus||{},news=board?.sourcePulse||{};
 const items=[
  {name:'Standard PrizePicks lines',ready:board?.freshness?.status==='fresh'&&Number(board.boardCount)>0,partial:Number(board.boardCount)>0,detail:`${board?.boardCount||0} offers · ${board?.freshness?.status||'unverified'} freshness`},
  {name:'Player game logs / minutes',ready:Number(board?.historyGames)>=50,partial:Number(board?.historyGames)>0,detail:`${board?.historyGames??0} cached NBA game summaries`},
  {name:'Exact positional DvP',ready:s.publicDvp?.available===true&&s.sourcedExact>0,partial:s.sourcedEligibilityEstimates>0,detail:`${s.sourcedExact||0} directions with sourced exact-position match; ${s.sourcedEligibilityEstimates||0} estimates`},
  {name:'ESPN injury report',ready:s.espnInjuries===true,partial:false,detail:'Fetched report is not confirmation that unlisted players are healthy'},
  {name:'NBA ESPN news',ready:news.newsFetched===true,partial:false,detail:'News headlines are context, not confirmed lineup changes'},
  {name:'Starting five',ready:s.licensedLineups===true,partial:false,detail:'Expected starters do not equal confirmed starting lineups'},
  {name:'Projected minutes',ready:rw.uniquePropsMatched>0,partial:false,detail:rw.uniquePropsMatched?`${rw.uniquePropsMatched} exact prop lines matched to uploaded RotoWire`:'Upload today’s authorized RotoWire spreadsheet'},
  {name:'Game totals and spread',ready:news.teamOddsFetched===true,partial:false,detail:'Team-market game script only; no player-prop price edge'},
  {name:'Same-line sportsbook odds',ready:false,partial:false,detail:'Two independent fair odds and platform payout are not connected; positive EV unverified'},
  {name:'Tracked chances and on/off',ready:false,partial:false,detail:'Potential assists, rebound chances and on/off minutes require licensed feeds'}
 ];
 const good=items.filter(x=>x.ready).length;
 target.innerHTML=`<details class="fp-source-pulse"><summary><b>SOURCE COVERAGE</b> · ${good}/${items.length} verified-source checks <span>Tap to see what is missing</span></summary><div class="fp-pulse-grid">${items.map(x=>`<div class="fp-pulse-row"><span class="fp-pulse-dot ${x.ready?'ok':x.partial?'partial':'missing'}"></span><b>${esc(x.name)}</b><span class="fp-pulse-label">${x.ready?'SOURCE CONNECTED':x.partial?'PARTIAL / PROXY':'NOT VERIFIED'}</span><small>${esc(x.detail)}</small></div>`).join('')}</div><p class="fp-pulse-note">A connected source does not mean the player's status, exact market edge or future performance is verified. Local RotoWire uploads do not enter server-side automatic postgame snapshots.</p></details>`;
}
