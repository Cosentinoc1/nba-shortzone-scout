import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('base and RotoWire paths both attach the same verdict engine',()=>{
 const a=read('lib/decision.mjs'),b=read('lib/rotowire.mjs');
 for(const src of [a,b]){assert.match(src,/import \{assessProp\} from '\.\/decision-v25\.mjs'/);assert.match(src,/recommendation=assessProp/);}
});
test('top list no longer manufactures ten props with no strong/lean candidates',()=>{
 const ui=read('public/clean.js');
 assert.match(ui,/const acceptable=new Set\(\['STRONG','LEAN'\]\)/);
 assert.match(ui,/No approved strong leans at these lines/);
 assert.match(ui,/rec\.helps/);
 assert.match(ui,/rec\.hurts/);
});
test('grade board and full report state chosen side, reasons and missing checks',()=>{
 const list=read('public/clean.js'),report=read('public/insight-ui.js');
 assert.match(list,/STRONG','LEAN'/);assert.match(list,/rec\.score\?\?x\.score/);
 assert.match(report,/WHAT COULD FAIL\?/);assert.match(report,/WHAT TO VERIFY/);
 assert.match(report,/Why it scores this way:/);
});
test('site registers the updated version without changing workflow permissions',()=>{
 assert.match(read('server.mjs'),/version:'2\.6\.0'/);
 assert.equal(JSON.parse(read('package.json')).version,'2.6.0');
});
