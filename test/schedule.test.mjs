import test from 'node:test';
import assert from 'node:assert/strict';
import {scoreboardGames,validSlateDay} from '../lib/schedule.mjs';
test('accepts only valid in-season game dates',()=>{
 assert.equal(validSlateDay('2026-11-06'),true);
 assert.equal(validSlateDay('2027-04-11'),true);
 assert.equal(validSlateDay('2026-02-30'),false);
 assert.equal(validSlateDay('2026-09-20'),false);
 assert.equal(validSlateDay('2026-11-06&limit=999'),false);
});
test('creates directional game cards from actual ESPN scoreboard',()=>{
 const games=scoreboardGames([{id:'game-1',season:{type:2},date:'2026-11-07T01:00Z',status:{type:{state:'pre',shortDetail:'Fri 7:00PM'}} ,competitions:[{competitors:[{homeAway:'away',team:{abbreviation:'BOS'}},{homeAway:'home',team:{abbreviation:'CHA'}}]}]},
  {id:'game-2',season:{type:2},date:'2026-11-07T04:00Z',status:{type:{state:'post',completed:true,shortDetail:'Final'}},competitions:[{competitors:[{homeAway:'away',score:'120',team:{abbreviation:'UTAH'}},{homeAway:'home',score:'117',team:{abbreviation:'NO'}}]}]}],{BOS:[],CHA:[],UTA:[],NOP:[]});
 assert.equal(games.length,2);assert.equal(games[0].away,'BOS');assert.equal(games[0].home,'CHA');
 assert.equal(games[1].away,'UTA');assert.equal(games[1].home,'NOP');
 assert.equal(games[1].awayScore,'120');assert.equal(games[1].homeScore,'117');assert.equal(games[1].completed,true);
});
