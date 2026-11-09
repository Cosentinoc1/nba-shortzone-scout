import test from 'node:test';
import assert from 'node:assert/strict';
import {gradeNewsZone} from '../lib/news-zone-v311.mjs';
const now=Date.parse('2026-11-09T10:00:00Z'),day='2026-11-09';
const row=(other={})=>({player:'Austin Example',team:'LAL',opponent:'DET',stat:'PTS',line:24.5,side:'MORE',state:'RESEARCH ONLY',minutes:29,lineupStatus:'confirmed',researchRank:{score:72,tier:'PRIORITY',eligible:true,reasons:[],risks:[]},...other});
const zone={topZoneName:'Paint',topZoneFgaAllowed:120,topZoneVolumeDeltaPP:3,topZoneFgDeltaPP:3};
const rosters={LAL:[{name:'Austin Example',pos:'SG'},{name:'Luka Example',pos:'PG'}]};
const injuries=(status,at='2026-11-09T08:00:00Z',player='Luka Example')=>({injuriesFetched:true,injuries:[{player,team:'LAL',status,updatedAt:at,reason:'knee'}]});
const projections={matched:true,projectedMinutes:35,matchupMismatch:false};
test('Game-day player OUT veto excludes from shortlist',()=>{
 const r=gradeNewsZone(row({player:'Luka Example'}),{zone,context:injuries('Out','2026-11-09T08:00:00Z','Luka Example'),rosters,day,now});
 assert.equal(r.state,'PASS');assert.equal(r.newsZone.veto,true);assert.equal(r.researchRank.eligible,false);
});
test('Previous-day OUT is not silently carried over as current',()=>{
 const r=gradeNewsZone(row({player:'Luka Example'}),{zone,context:injuries('Out','2026-11-08T19:00:00Z','Luka Example'),rosters,day,now});
 assert.equal(r.state,'PASS');assert.equal(r.newsZone.hold,true);assert.equal(r.newsZone.veto,false);
});
test('Out teammate plus matched projected minutes has an explicit stronger adjustment',()=>{
 const supported=gradeNewsZone(row({rotowire:projections}),{zone,context:injuries('Out'),rosters,day,now});
 const uncertain=gradeNewsZone(row(),{zone,context:injuries('Out'),rosters,day,now});
 assert.ok(supported.newsZone.injuryAdjustment>=9);assert.equal(uncertain.newsZone.injuryAdjustment,0);
 assert.ok(supported.newsZone.flags.some(x=>x.tone==='green'));assert.ok(uncertain.newsZone.flags.some(x=>x.tone==='amber'));
});
test('Three-point attempts do not get scoring-efficiency contribution, and low samples suppress',()=>{
 const attempts=gradeNewsZone(row({stat:'3PA'}),{zone:{top3ZoneName:'Above the break',top3ZoneVolumeDeltaPP:4,top3ZoneFgDeltaPP:-5,top3ZoneFgaAllowed:120},day,now});
 assert.equal(attempts.newsZone.shot.supported,true);
 const thin=gradeNewsZone(row(),{zone:{...zone,topZoneFgaAllowed:36},day,now});
 assert.equal(thin.newsZone.shot.points,0);assert.equal(thin.newsZone.shot.status,'SMALL SAMPLE');
});
test('Combo statistics never treat shot locations as proof of assists and rebounds',()=>{
 const r=gradeNewsZone(row({stat:'PRA'}),{zone,day,now});assert.equal(r.newsZone.shot.points,4);
 const ast=gradeNewsZone(row({stat:'AST'}),{zone,day,now});assert.equal(ast.newsZone.shot.points,0);
});
test('Contradictory defense zone downgrades Priority to Watch',()=>{
 const r=gradeNewsZone(row(),{zone:{...zone,topZoneVolumeDeltaPP:-4,topZoneFgDeltaPP:-5},day,now});
 assert.equal(r.researchRank.tier,'WATCH');assert.ok(r.newsZone.shot.contradicted);
});
