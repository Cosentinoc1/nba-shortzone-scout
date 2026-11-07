import test from 'node:test';import assert from 'node:assert/strict';
import {lookupLineup,parseLicensedLineups,licensedLineupsForDay} from '../lib/lineups.mjs';
const payload={date:'2026-11-07',teams:{DEN:{status:'expected',players:[{name:'Jamal Murray',pos:'PG'},{name:'C. Braun',pos:'SG'},{name:'C. Johnson',pos:'SF'},{name:'Aaron Gordon',pos:'PF'},{name:'Nikola Jokic',pos:'C'}]}}};
test('Licensed provider expected lineups are NOT confirmed',()=>{const x=parseLicensedLineups(payload,'2026-11-07',['DEN','IND']);assert.equal(x.DEN.status,'expected');assert.equal(lookupLineup(x.DEN,[],'Christian Braun').pos,'SG')});
test('Reject wrong day and teams absent from recognized league',()=>{assert.deepEqual(parseLicensedLineups(payload,'2026-11-06',['DEN']),{});assert.deepEqual(parseLicensedLineups(payload,'2026-11-07',['CHI']),{})});
test('Without licensed URL, no RotoWire automated access is attempted',async()=>{delete process.env.LICENSED_LINEUPS_URL;let called=false;const x=await licensedLineupsForDay('2026-11-07',['DEN'],async()=>{called=true});assert.equal(x.available,false);assert.equal(called,false)});
