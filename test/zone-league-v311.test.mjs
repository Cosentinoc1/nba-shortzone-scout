import test from 'node:test';
import assert from 'node:assert/strict';
import {zoneLeagueRankings,opposite3paLeaders} from '../public/zone-league-v311.mjs';
const Z=['rim','paint','mid','left','right','above'];
const team=(code,share,fg,attempts=100)=>({code,zones:Object.fromEntries(Z.map(z=>[z,{share,fg,fga:attempts}]))});
test('Rank #1 means highest shot share and highest accuracy allowed',()=>{
 const d={teams:[team('AAA',.32,.58),team('BBB',.21,.46),team('CCC',.13,.31)]};
 const high=zoneLeagueRankings(d,'AAA').above,mid=zoneLeagueRankings(d,'BBB').above;
 assert.equal(high.shareRank,1);assert.equal(high.accuracyRank,1);assert.equal(mid.shareRank,2);
});
test('Accuracy rank withheld when defensive zone sample is below 50',()=>{
 const d={teams:[team('AAA',.4,.8,36),team('BBB',.2,.5,100)]};
 const r=zoneLeagueRankings(d,'AAA').mid;assert.equal(r.accuracyRank,null);assert.equal(r.shareRank,1);
});
test('For NYK defense, list opposing team top shooters by opponent threes per game',()=>{
 const result=opposite3paLeaders({team:'NYK',schedule:[{home:'NYK',away:'BOS'}],rosters:{BOS:[{id:'1'},{id:'2'},{id:'3'}]},players:[
  {id:'1',team:'BOS',name:'A',gp:6,zones:{left:{fga:10},right:{fga:8},above:{fga:36}}},
  {id:'2',team:'BOS',name:'B',gp:8,zones:{left:{fga:6},right:{fga:6},above:{fga:20}}},
  {id:'3',team:'BOS',name:'C',gp:1,zones:{above:{fga:15}}},
  {id:'4',team:'NYK',name:'Wrong Team',gp:6,zones:{above:{fga:90}}}
 ]});
 assert.equal(result.opponent,'BOS');assert.deepEqual(result.players.map(x=>x.player),['A','B']);assert.equal(result.players[0].threePA,9);
});
