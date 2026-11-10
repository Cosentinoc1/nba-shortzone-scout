import test from 'node:test';import assert from 'node:assert/strict';
import {cleanTeam,cleanPlayer,findClientProjection,safeProjectionStat} from '../public/roto-name-v318.mjs';
test('RotoWire browser lookup reconciles team aliases and suffixes safely',()=>{
 const rows=[{NAME:'DariusD. Acuff Jr.',Team:'SAC',MIN:33,PTS:23,REB:5,AST:7},{NAME:'Jalen Brunson',Team:'NY',MIN:36,PTS:29,REB:2,AST:6}];
 assert.equal(cleanTeam('vs NY'),'NYK');assert.equal(cleanPlayer('DariusD. Acuff Jr.'),cleanPlayer('Darius Acuff Jr.'));
 assert.equal(findClientProjection(rows,'SAC','Darius Acuff Jr.').MIN,33);
 assert.equal(findClientProjection(rows,'NYK','Jalen Brunson').MIN,36);
 assert.equal(findClientProjection(rows,'MIA','Jalen Brunson'),null);
});
test('Ambiguous matches are not silently assigned to the wrong player',()=>{
 const rows=[{NAME:'Steven S. Adams',Team:'HOU',MIN:21},{NAME:'StevenS. Adams',Team:'HOU',MIN:28}];
 assert.equal(findClientProjection(rows,'HOU','Steven Adams'),null);
});
test('Missing projected component is unknown, never a made-up zero',()=>{
 assert.equal(safeProjectionStat({PTS:22,REB:6,AST:4},'PRA'),32);
 assert.equal(safeProjectionStat({PTS:22,REB:6,AST:null},'PRA'),null);
 assert.equal(safeProjectionStat({FGM:9,'3PM':3},'2PM'),6);
 assert.equal(safeProjectionStat({FGM:9,'3PM':null},'2PM'),null);
});
