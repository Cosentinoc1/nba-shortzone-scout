import test from 'node:test';import assert from 'node:assert/strict';
import {rotoTeam,rotoNameKey,buildRotoLookup,findRotoProjection,diagnoseRotoMatch} from '../lib/roto-match-v310.mjs';
test('team aliases and opponent decorators normalize to NBA codes',()=>{
 assert.equal(rotoTeam('PHO'),'PHX');assert.equal(rotoTeam('BRO'),'BKN');assert.equal(rotoTeam('NOR'),'NOP');
 assert.equal(rotoTeam('vs. SAS'),'SAS');assert.equal(rotoTeam('@ GS'),'GSW');assert.equal(rotoTeam('NY'),'NYK');
});
test('RotoWire name initials and suffixes match a same-team NBA board identity',()=>{
 assert.equal(rotoNameKey('StevenS. Adams'),rotoNameKey('Steven Adams'));
 assert.equal(rotoNameKey('Anthony A. Edwards'),rotoNameKey('Anthony Edwards'));
 assert.equal(rotoNameKey('DariusD. Acuff Jr.'),rotoNameKey('Darius Acuff Jr.'));
 const look=buildRotoLookup([{name:'StevenS. Adams',team:'HOU',MIN:25},{name:'MilesM. Bridges Jr.',team:'PHO',MIN:30}]);
 assert.equal(findRotoProjection(look,{player:'Steven Adams',team:'HOU'}).projection.MIN,25);
 assert.equal(findRotoProjection(look,{player:'Miles Bridges',team:'PHX'}).projection.MIN,30);
 assert.equal(findRotoProjection(look,{player:'Steven Adams',team:'DAL'}),null);
});
test('ambiguous same-team aliases never choose an arbitrary player',()=>{
 const look=buildRotoLookup([{name:'Steven S. Adams',team:'HOU',MIN:18},{name:'StevenS. Adams',team:'HOU',MIN:34}]);
 assert.equal(findRotoProjection(look,{player:'Steven Adams',team:'HOU'}),null);
});
test('diagnostics identify a wrong-day slate and a mismatched opponent',()=>{
 const none=diagnoseRotoMatch({boardRows:[{team:'ATL'}],projections:[{team:'BOS'}]});
 assert.equal(none.overlapTeamCount,0);assert.match(none.message,/Today vs Tomorrow/);
 const mismatch=diagnoseRotoMatch({boardRows:[{team:'ATL'}],projections:[{team:'ATL'}],wrongOpponent:4});
 assert.match(mismatch.message,/different slate/i);
});
