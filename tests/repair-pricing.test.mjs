import test from 'node:test';
import assert from 'node:assert/strict';
import {calculate, estimateText, CATALOGUE} from '../js/pricing-catalogue.mjs';
import {summaryHTML, summaryText} from '../server/quote-emails.mjs';
const item=(id,options={},quantity=1,materials='yes')=>({id,options,quantity,materials});
const calc=(items,area='Castlebar')=>calculate(items,area);

test('drop-off diagnostics are €40 without on-site minimum or provider travel, even for Other',()=>{
 for(const area of ['Castlebar','Westport','Other']){
  const e=calc([item('pc-diagnostics',{location:'dropoff'})],area);
  assert.equal(e.labour,4000);assert.equal(e.minimumAdjustment,0);assert.equal(e.travel,0);assert.equal(e.total,4000);assert.equal(e.incomplete,false);
 }
});
test('on-site diagnostics and RAM apply one €50 minimum plus travel, never €40 plus €50',()=>{
 for(const id of ['pc-diagnostics','pc-ram'])for(const [area,travel] of [['Castlebar',0],['Westport',1000]]){
  const e=calc([item(id)],area);assert.equal(e.labour,4000);assert.equal(e.minimumAdjustment,1000);assert.equal(e.travel,travel);assert.equal(e.total,5000+travel);
 }
});
test('replacement RAM prices are never invented; materials and unknown travel stay excluded',()=>{
 const e=calc([item('pc-ram',{},1,'no')],'Other');assert.equal(e.materials,0);assert.equal(e.travel,null);assert.equal(e.incomplete,true);assert.equal(e.total,5000);assert.equal(e.lines[0].materialUnknown,true);
});
test('confirmed-repair waiver is only a note, not a client-controlled deduction',()=>{
 const e=calc([item('pc-diagnostics'),item('pc-ram')],'Westport');
 assert.equal(e.labour,8000);assert.equal(e.minimumAdjustment,0);assert.equal(e.travel,1000);assert.equal(e.total,9000);
 assert.match(estimateText(e),/waived only when a repair is confirmed/);
 assert.throws(()=>calc([item('pc-diagnostics',{repairConfirmed:'yes'})]),/Unknown service option/);
 assert.equal(calc([{...item('pc-diagnostics'),waiver:999999,price:0}]).total,5000);
});
test('drop-off estimates cannot silently erase travel for on-site work or duplicate the same assessment',()=>{
 assert.throws(()=>calc([item('pc-diagnostics',{location:'dropoff'}),item('pc-ram')]),/separately/);
 assert.throws(()=>calc([item('pc-diagnostics'),item('pc-troubleshoot')]),/same assessment/);
 assert.throws(()=>calc([item('pc-diagnostics',{location:'fake'})]),/Invalid service option/);
});
test('RAM is eligible main labour, diagnostic fees are not discount units; thresholds preserved',()=>{
 for(const [quantity,percent] of [[5,0],[6,5],[10,5],[11,10]]){
  const e=calc([item('pc-ram',{},quantity),item('pc-diagnostics')]);
  assert.equal(e.eligibleUnits,quantity);assert.equal(e.discountPercent,percent);assert.equal(e.discount,quantity*4000*percent/100);
 }
 const e=calc([item('pc-ram'),item('wifi-printer')]);assert.equal(e.total,8000);assert.equal(e.minimumAdjustment,0);
});
test('both email alternatives use authoritative diagnostics total, location and conditional waiver',()=>{
 const e=calc([item('pc-diagnostics',{location:'dropoff'})],'Westport');
 for(const customer of [true,false])for(const output of [summaryHTML(e,customer),summaryText(e,customer)]){
  assert.match(output,/€40\.00/);assert.match(output,/customer drop-off/i);assert.match(output,/waived only when a repair is confirmed/);
  assert.equal(output.includes('€90.00'),false);
 }
 assert.equal(CATALOGUE.find(s=>s.id==='pc-ram').price,4000);
});
