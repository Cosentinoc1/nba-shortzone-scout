import test from 'node:test';import assert from 'node:assert/strict';
import {renderSimplePicks,renderSimpleSources} from '../public/simple-dashboard-v318.mjs';
function fake(){const sections={featuredPicks:{innerHTML:'',querySelectorAll:()=>[]},sourcePulse:{innerHTML:''}};globalThis.document={getElementById:k=>sections[k]||null};globalThis.window={NBAScoutRoto:{activeForDate:()=>({date:'2026-11-10',rows:[{NAME:'X'}]})}};return sections;}
const candidate={player:'Example Player',team:'NYK',opponent:'MIL',line:22.5,side:'MORE',stat:'PTS',score:65,researchTier:'LEAN',entryReady:false,lastTen:{wins:6,losses:3,pushes:0,resolved:9},lastTwenty:{sample:9,win:6,loss:3,push:0},historySample:9,usage:{rank:1},reasons:[{label:'The numbers',text:'6 of 9 games cleared the exact line.'},{label:'Playstyle / opportunities',text:'20 attempts per game.'},{label:'Why this defense?',text:'Opponent allows points to this role.'},{label:'Role and injuries',text:'Minutes not confirmed.'}],risks:['Injury news could change playing time.'],sourceCoverage:[],checks:[],detailKey:'Example Player|NYK|MIL|PTS|MORE|22.5'};
test('Top 2 hero renders a compact side, line, explanations and honest L20 sample',()=>{
 const el=fake(),board={all:[],featuredPicks:{top2:[candidate],top5:[candidate],status:'research',message:'Not a lock.'}};
 renderSimplePicks(board,()=>{});let html=el.featuredPicks.innerHTML;
 assert.match(html,/MORE/);assert.match(html,/22\.5 points/);assert.match(html,/6W–3L/);assert.match(html,/9\/20/);
 assert.match(html,/How this player gets opportunities/);assert.match(html,/What the opponent allows/);assert.match(html,/Not a lock|RESEARCH ONLY/);
});
test('RotoWire upload acknowledgement differs from verified player matches and starting status',()=>{
 const el=fake();renderSimpleSources({rotowireStatus:{playerRows:1,uniquePropsMatched:0,ignoredRows:0},boardCount:18,historyGames:100,sourceStatus:{}});
 assert.match(el.sourcePulse.innerHTML,/1 imported · 1 valid · 0 matched prop lines/);
 assert.match(el.sourcePulse.innerHTML,/No matches found/);
 renderSimpleSources({rotowireStatus:{playerRows:1,uniquePropsMatched:2},boardCount:18,historyGames:100,sourceStatus:{}});
 assert.match(el.sourcePulse.innerHTML,/2 matched prop lines/);
 assert.match(el.sourcePulse.innerHTML,/does NOT confirm starting status/);
});
