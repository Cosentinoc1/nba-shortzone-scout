/** NBA Scout v3.18: one-screen, transparent, text-first prop research.
 * No extra service, prediction, ad, or betting-lock claim. Mobile-first UI.
 */
const esc=x=>String(x??'—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=x=>x===null||x===undefined||x===''||!Number.isFinite(Number(x))?null:Number(x);
const title={PTS:'points',REB:'rebounds',AST:'assists','3PM':'made threes',PRA:'points + rebounds + assists',PR:'points + rebounds',PA:'points + assists',RA:'rebounds + assists',FTM:'made free throws',FGA:'field-goal attempts','3PA':'three-point attempts','2PM':'made twos'};
const state={count:2};
const lookup=(p,label)=>(p.reasons||[]).find(x=>x.label===label)||null;
const summaryText=(p,label,fallback)=>lookup(p,label)?.text||fallback;
const good=(p,label)=>lookup(p,label)?.kind==='support';
function lineText(p){return `${p.side==='LESS'?'LESS':'MORE'} ${p.line} ${title[p.stat]||p.stat}`;}
function gradeLine(p){const h=p.lastTen||{},n=h.resolved??null;
 return n!==null&&n>0?`${h.wins}W–${h.losses}L${h.pushes?` · ${h.pushes} push`:''} in ${n+(h.pushes||0)} games`:'Not enough completed games';}
function extractFacts(p){
 const fact=(label,alt)=>({label,text:summaryText(p,label,alt),source:lookup(p,label)?.source||null});
 const a=[fact('The numbers','Historical results for this line are incomplete.'),fact('Playstyle / opportunities','Player-specific recent attempts or chances have not been verified.'),fact('Why this defense?','The opponent has no reliably verified stat-specific weakness in this matchup.'),fact('Role and injuries','Rotation and injury status still need confirmation.')];
 const role=fact('Team offensive role','Team involvement is not verified with enough source games.');
 const model=lookup(p,'Independent projection');
 return {main:a,role,model};
}
function renderCard(p,i){const facts=extractFacts(p),rw=p.rotowireMatch;
 const status=p.entryReady?'CHECK LIVE APP':'RESEARCH ONLY';
 const side=p.side==='LESS'?'LESS':'MORE';
 const recent=p.historySample||p.lastTen?.resolved||0;
 const displayHistory=p.lastTwenty?.sample?`${p.lastTwenty.sample}/20`:`${Math.min(20,recent)}/20`;
 const historyWarning=p.historyAudit?.issueCount?`Source history check: ${p.historyAudit.issueCount} inconsistent game record(s); verify before relying on these clearances.`:null;
 const risk=(p.risks||[])[0]||'Playing time, injury news, exact line and payout could still change.';
 return `<article class="sd-card" data-sd-pick="${i}">
 <div class="sd-card-h"><span class="sd-number">${i+1}</span><div class="sd-name"><h3>${esc(p.player)}</h3><p>${esc(p.team)} vs ${esc(p.opponent)} · ${esc(p.researchTier||'research')} · ${esc(p.score??'—')}/100 evidence</p></div><span class="sd-status">${esc(status)}</span></div>
 <div class="sd-decision"><span class="sd-side sd-${side.toLowerCase()}">${side}</span><strong>${esc(p.line)} ${esc(title[p.stat]||p.stat)}</strong><small>Standard line · verify current availability</small></div>
 <div class="sd-quickstats"><span><b>${esc(gradeLine(p))}</b><small>Recent actual results</small></span><span><b>${esc(displayHistory)}</b><small>Last 20 available</small></span><span><b>${p.usage?.rank?'#'+esc(p.usage.rank):'—'}</b><small>Team opportunity rank (proxy)</small></span></div>
 <div class="sd-story">
 ${facts.main.slice(0,3).map((f,j)=>`<div class="sd-why"><span class="sd-why-num">${j+1}</span><div><b>${['Recent results at this line','How this player gets opportunities','What the opponent allows'][j]}</b><p>${esc(f.text)}</p></div></div>`).join('')}
 </div>
 ${historyWarning?`<p class="sd-history-warning">${esc(historyWarning)}</p>`:''}
 <div class="sd-role"><b>Tonight's playing time</b><p>${rw?`RotoWire projects ${esc(rw.minutes)} minutes and ${esc(rw.projection)} ${esc(p.stat)}. ${rw.opposes?'Projection OPPOSES this side.':rw.supports?'Projection supports this direction.':'Projection is close to the line.'}`:esc(facts.main[3].text)}</p>
 ${rw?'<small>Uploaded player forecast; does not confirm the starter or guarantee minutes.</small>':'<small>Upload your RotoWire sheet for an independent minutes and stat estimate.</small>'}</div>
 <div class="sd-watch"><b>What could make it miss?</b><p>${esc(risk)}</p></div>
 <div class="sd-card-bottom"><button type="button" class="sd-open" data-sd-open="${i}">View full player report</button><details><summary>Sources & remaining checks</summary><div class="sd-checklist">${(p.sourceCoverage||[]).map(s=>`<div><b>${esc(s.name)}</b><span>${esc(s.state)}</span><small>${esc(s.source)}</small></div>`).join('')}</div><p>${(p.checks||[]).map(x=>esc(x)).join(' · ')}</p><p>ESPN box scores and team opportunity are historical observations; defense ranks may use positional estimates. Research grades are not predicted win rates.</p></details></div>
 </article>`;
}
export function renderSimplePicks(board,open){const node=document.getElementById('featuredPicks');if(!node)return;
 const list=board?.featuredPicks;
 if(!list){node.innerHTML='<div class="sd-placeholder">Loading current standard lines and player history…</div>';return;}
 const rows=(state.count===5?list.top5:list.top2)||[];
 const projected=board?.rotowireStatus||{};
 const rwRows=projected.playerRows||0,matched=projected.uniquePropsMatched||0;
 const titleText=list.status==='no_supported_candidates'?'No picks qualify before tipoff':list.message||'These are research candidates, not guaranteed picks.';
 node.innerHTML=`<div class="sd-home-head"><div><span class="sd-eyebrow">YOUR QUICK PICK DESK</span><h2>Today's top ${state.count}</h2><p>See the exact line, the opportunity and the defense matchup without digging through data tables.</p></div><div class="sd-toggle" role="group" aria-label="Show top two or top five"><button type="button" data-sd-count="2" aria-pressed="${state.count===2}">Top 2</button><button type="button" data-sd-count="5" aria-pressed="${state.count===5}">Top 5</button></div></div>
 <div class="sd-context">${rwRows?`<strong>RotoWire applied: ${rwRows} players accepted · ${matched} props matched.</strong> Matching projections appear on individual cards; starting status is a separate check.`:'<strong>RotoWire not applied to this board.</strong> Import today’s spreadsheet to compare projected minutes and stats.'}<p>${esc(titleText)}</p></div>
 <div class="sd-cards">${rows.length?rows.map(renderCard).join(''):'<div class="sd-placeholder">No eligible pregame candidate meets even the preliminary evidence requirements for this date. Check the next game day rather than forcing picks.</div>'}</div>
 <div class="sd-method"><b>How these picks are chosen:</b> recent playing time and real shot/assist/rebound volume → offensive role → opponent weakness → recent game results → RotoWire model agreement → injury, lineup, exact-line and price veto. <b>There are no automatic locks.</b></div>`;
 node.querySelectorAll('[data-sd-count]').forEach(b=>b.addEventListener('click',()=>{state.count=Number(b.dataset.sdCount);renderSimplePicks(board,open)}));
 node.querySelectorAll('[data-sd-open]').forEach(b=>b.addEventListener('click',()=>{const item=rows[Number(b.dataset.sdOpen)];if(!item)return;const selected=(board.all||[]).find(r=>[r.player,r.team,r.opponent,r.stat,r.side,r.line].join('|')===item.detailKey);if(selected)open(selected)}));
}
export function renderSimpleSources(board){const node=document.getElementById('sourcePulse');if(!node)return;
 const status=board?.rotowireStatus||{},store=typeof window!=='undefined'?window.NBAScoutRoto?.activeForDate?.():null;
 const incoming=store?.rows?.length||0,accepted=num(status.playerRows),matched=num(status.uniquePropsMatched)||0;
 const badOpp=num(status.wrongOpponentDirections)||0,skipped=num(status.ignoredRows)||0;
 const saved=Boolean(store),confirmed=accepted!==null;
 const uploadText=!saved?'No RotoWire spreadsheet for this game day':!confirmed?`${incoming} RotoWire players imported · matching projections…`:`${incoming} imported · ${accepted} valid · ${matched} matched prop lines${skipped?` · ${skipped} unusable rows`:''}${badOpp?` · ${badOpp} opponent mismatches`:''}`;
 const tip=!saved?'Import the correct-day RotoWire XLSX above.':!confirmed?'Processing upload; if this does not change, check the import status above.':matched===0?'No matches found: check slate date, Team/OPP columns, player names and spreadsheet headers.':'Matched forecasts are now included. A forecast does NOT confirm starting status.';
 const extras=[['Standard lines',Number(board?.boardCount)>0,`${board?.boardCount||0} offers observed`],['Player box scores',Number(board?.historyGames)>0,`${board?.historyGames??'—'} cached games`],['Opposing defense',Boolean(board?.sourceStatus?.publicDvp?.available),board?.sourceStatus?.publicDvp?.reason||'Position DvP from source if available'],['Injury data',Boolean(board?.sourceStatus?.espnInjuries),'Report fetched ≠ confirmed active'],['Starting lineups',Boolean(board?.sourceStatus?.licensedLineups),'Independent confirmed status required'],['RotoWire projections',matched>0,`${accepted??incoming} parsed · ${matched} lines matched`],['Odds and payout',false,'Not automatically verified'],['Tracking chances',false,'Requires licensed data']];
 node.innerHTML=`<details class="sd-source"><summary><span class="sd-source-dot ${matched?'on':saved?'wait':'off'}"></span><span><b>Data connections</b><small>${esc(uploadText)}</small></span><span class="sd-source-expand">Details</span></summary><p>${esc(tip)}</p><div class="sd-source-list">${extras.map(([label,yes,detail])=>`<div><b>${esc(label)}</b><span class="${yes?'sd-good':'sd-pending'}">${yes?'Available':'Check needed'}</span><small>${esc(detail)}</small></div>`).join('')}</div><p class="sd-source-disclaimer">Uploaded RotoWire files stay in this browser. No data source can guarantee a result; source connection ≠ confirmation of an individual player's status.</p></details>`;
}
