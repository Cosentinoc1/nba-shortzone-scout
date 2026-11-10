const $=id=>document.getElementById(id);const esc=x=>String(x??'—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const pct=x=>x==null?'—':`${x.toFixed(1)}%`;
let data={days:[]},selected=null;
function sum(rows){const wins=rows.filter(p=>p.result==='WIN').length,losses=rows.filter(p=>p.result==='LOSS').length,pushes=rows.filter(p=>p.result==='PUSH').length,voids=rows.filter(p=>p.result==='VOID').length,unverified=rows.filter(p=>['UNVERIFIED','PENDING'].includes(p.result)).length;return{wins,losses,pushes,voids,unverified,n:wins+losses,rate:wins+losses?wins/(wins+losses)*100:null}}
const rowsFor=d=>d.audit?.picks||[];const recommended=rows=>rows.filter(p=>!String(p.board||'').toLowerCase().includes('bottom'));
function allVerifiedDays(){return data.days.filter(d=>['audited','partial'].includes(d.status)&&rowsFor(d).length)}
function renderSummary(){const days=allVerifiedDays();const rows=days.flatMap(d=>recommended(rowsFor(d)));const s=sum(rows),more=sum(rows.filter(p=>p.side==='MORE')),less=sum(rows.filter(p=>p.side==='LESS'));
 $('hit').textContent=pct(s.rate);$('hitSmall').textContent=`${s.wins} wins / ${s.losses} losses`; $('more').textContent=pct(more.rate);$('moreSmall').textContent=`${more.wins}W / ${more.losses}L`;$('less').textContent=pct(less.rate);$('lessSmall').textContent=`${less.wins}W / ${less.losses}L`;
 $('days').textContent=days.length;$('daysSmall').textContent=`${data.days.filter(d=>d.status==='no_qualified').length} no-qualified days`;
 $('barWins').style.width=`${s.rate||0}%`;$('barLoss').style.width=`${100-(s.rate||0)}%`;$('winsLabel').textContent=`${s.wins} wins`;$('lossLabel').textContent=`${s.losses} losses`;
 $('exclusions').innerHTML=`<span class="statitem">${s.pushes} pushes</span><span class="statitem">${s.voids} voids</span><span class="statitem">${s.unverified} unresolved</span>`;
}
function renderDiagnostics(){
 const days=allVerifiedDays();
 const entries=days.flatMap(d=>recommended(rowsFor(d)).map(p=>({...p,modelVersion:d.scoringVersion,pregameVerified:d.snapshot?.pretipVerified===true})));
 const fixed=entries.filter(p=>p.pregameVerified&&['PRIORITY','LEAN','WATCH'].includes(String(p.tier).toUpperCase())&&['WIN','LOSS'].includes(p.result));
 const lines=[];
 for(const tier of ['PRIORITY','LEAN','WATCH']){
  const rows=fixed.filter(p=>p.tier===tier),v=sum(rows);
  lines.push(`<span class="statitem">${tier}: ${v.n?v.wins+'/'+v.n+' ('+pct(v.rate)+')':'No graded frozen picks yet'}</span>`);
 }
 const actualMin=entries.filter(p=>['WIN','LOSS'].includes(p.result)&&Number.isFinite(Number(p.minutes))&&p.minutes!=null);
 for(const [label,test] of [['Played 26+ minutes',p=>Number(p.minutes)>=26],['Played under 26 minutes',p=>Number(p.minutes)<26]]){
  const rows=actualMin.filter(test),v=sum(rows);
  lines.push(`<span class="statitem">${esc(label)}: ${v.n?v.wins+'/'+v.n+' ('+pct(v.rate)+')':'No verified results'}</span>`);
 }
 lines.push(`<span class="statitem">${fixed.length} graded 2.7-era pre-tip directional candidates (all tier samples)</span>`);
 $('signalDiagnostics').innerHTML=lines.join('')+`<p class="muted">Minutes groups include legacy audits; RFPP tier comparisons include only captured, pre-tip rankings with an explicit tier. Small samples are descriptive, not evidence of a profitable edge.</p>`;
}
function tag(d){return d.status==='audited'?['Audited','done']:d.status==='no_qualified'?['No qualified picks','none']:d.status==='frozen'?['Frozen · pending games','partial']:d.status==='partial'?['Partial audit','partial']:['Not frozen','none']}
function renderDays(){const f=$('viewMode').value;const days=data.days.filter(d=>f==='all'||(f==='audited'&&['audited','partial'].includes(d.status))||(f==='empty'&&d.status==='no_qualified'));
 $('dayList').innerHTML=days.length?days.map(d=>{const [t,k]=tag(d);const s=sum(recommended(rowsFor(d)));const desc=s.n?`${s.wins}-${s.losses} (${pct(s.rate)}) · ${d.scoringVersion||'unknown model'}`:d.message||'No recorded picks';return `<button type="button" class="day ${selected===d.date?'selected':''}" data-date="${esc(d.date)}"><span class="date">${esc(d.date)}</span><span class="desc">${esc(desc)}</span><span class="tag ${k}">${esc(t)}</span></button>`}).join(''):'<div class="empty">No matching days yet.</div>';
 $('dayList').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{selected=b.dataset.date;renderDays();renderDetail()}));}
function metric(label,s){return `<div class="card"><div class="label">${esc(label)}</div><div class="big">${pct(s.rate)}</div><div class="caption">${s.wins}W · ${s.losses}L · ${s.pushes} pushes</div></div>`}
function renderDetail(){const d=data.days.find(x=>x.date===selected);if(!d){$('detailPanel').classList.add('hidden');return;}$('detailPanel').classList.remove('hidden');
 const [t,k]=tag(d);$('detailTitle').textContent=selected;$('detailTag').textContent=t;$('detailTag').className=`tag ${k}`;$('detailMessage').textContent=d.message||'';
 const rows=rowsFor(d),rec=recommended(rows);$('dailyMetrics').innerHTML=metric('Overall',sum(rec))+metric('Top MORE',sum(rec.filter(x=>x.side==='MORE')))+metric('Top LESS',sum(rec.filter(x=>x.side==='LESS')))+metric('Bottom 10 countercheck',sum(rows.filter(x=>String(x.board||'').toLowerCase().includes('bottom'))));
 const f=$('boardFilter').value,r=$('resultFilter').value;
 let chosen=rows.filter(x=>f==='recommended'?!String(x.board||'').toLowerCase().includes('bottom'):f==='bottom'?String(x.board||'').toLowerCase().includes('bottom'):x.side===f.toUpperCase()&&!String(x.board||'').toLowerCase().includes('bottom'));
 chosen=chosen.filter(x=>r==='ALL'||(r==='UNRESOLVED'?!['WIN','LOSS'].includes(x.result):x.result===r));
 $('pickTable').innerHTML=chosen.length?chosen.map(p=>{const kind=p.result==='WIN'?'win':p.result==='LOSS'?'loss':p.result==='PUSH'?'push':'void';return `<tr><td><strong>${esc(p.player)}</strong><div class="muted">${esc(p.team)} vs ${esc(p.opponent)}</div></td><td>${esc(p.stat)} <span class="gray">${esc(p.side)}</span></td><td>${esc(p.line)}</td><td>${esc(p.actual)}</td><td><span class="pill ${kind}">${esc(p.result)}</span></td><td>${esc(p.minutes)}</td></tr>`}).join(''):`<tr><td colspan="6" class="empty">${d.status==='no_qualified'?'No qualified picks were frozen on this date.':'No results for this filter.'}</td></tr>`;
 $('dailySource').textContent=`Source: ${d.audit?.source||d.source?.provider||'NBA Scout'} · Scoring ${d.scoringVersion||'unknown'} · ${d.snapshot?.capturedAt?'Frozen at '+d.snapshot.capturedAt:'Not independently verified as a pre-tip snapshot'}${d.source?.providerSidesVerified===false?' · Provider did not confirm selectable side':''}`;
}
async function main(){try{const r=await fetch('/review/history.json?'+Date.now(),{cache:'no-store'});if(!r.ok)throw Error('History not found');data=await r.json();selected=data.days[0]?.date;renderSummary();renderDiagnostics();renderDays();renderDetail();$('viewMode').addEventListener('change',renderDays);$('boardFilter').addEventListener('change',renderDetail);$('resultFilter').addEventListener('change',renderDetail);}catch(e){$('dayList').innerHTML=`<div class="empty">Review history cannot load: ${esc(e.message)}. Check the daily workflow and public/review/history.json.</div>`;}}
main();
