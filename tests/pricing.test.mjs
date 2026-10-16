import test from 'node:test';
import assert from 'node:assert/strict';
import {CATALOGUE, CATEGORIES, VERSION, calculate, estimateText} from '../js/pricing-catalogue.mjs';
const item = (id, quantity = 1, options = {}, materials = 'yes') => ({id, quantity, options, materials});
const calc = (items, area = 'Castlebar') => calculate(items, area);

test('catalogue has 17 categories, unique IDs and explicit discount flags', () => {
  assert.equal(new Set(CATALOGUE.map(s => s.id)).size, CATALOGUE.length);
  assert.equal(CATEGORIES.length, 17);
  for (const s of CATALOGUE) {assert.equal(typeof s.discountEligible, 'boolean'); assert.equal(typeof s.countsForDiscount, 'boolean'); assert.ok(s.source);}
  assert.equal(CATALOGUE.find(s => s.id === 'vent-core').price, null);
});
test('one €40 service becomes €50 minimum', () => {const e = calc([item('wifi-printer')]); assert.equal(e.total, 5000); assert.equal(e.minimumAdjustment, 1000);});
test('one €40 service in Westport totals €60', () => assert.equal(calc([item('wifi-printer')], 'Westport').total, 6000));
test('five eligible units have no discount', () => assert.equal(calc([item('wifi-printer', 5)]).discount, 0));
test('six units get 5% of eligible labour', () => {const e = calc([item('wifi-printer', 6)]); assert.equal(e.discountPercent, 5); assert.equal(e.discount, 1200); assert.equal(e.total, 22800);});
test('eleven units get 10%', () => {const e = calc([item('wifi-printer', 11)]); assert.equal(e.discountPercent, 10); assert.equal(e.discount, 4400);});
test('minor addons neither raise tier nor enter eligible base', () => {
 const e = calc([item('tv-mount', 5, {cables: 'yes'}), item('hardware-addon', 50)]);
 assert.equal(e.eligibleUnits, 5); assert.equal(e.discountPercent, 0); assert.equal(e.eligibleLabour, 40000);
 const d = calc([item('tv-mount', 6, {cables: 'yes'})]); assert.equal(d.discount, 2400); assert.equal(d.labour, 60000);
});
test('unpriced materials are never invented or discounted', () => {
 const yes = calc([item('wifi-printer', 6)]), no = calc([item('wifi-printer', 6, {}, 'no')]);
 assert.equal(no.total, yes.total); assert.equal(no.discount, yes.discount); assert.equal(no.materials, 0); assert.equal(no.incomplete, true);
});
test('travel once per visit regardless of quantities', () => {const e = calc([item('wifi-printer', 11), item('furniture-bed', 2)], 'Ballina'); assert.equal(e.travel, 1000); assert.equal(e.total, e.labour - e.discount + 1000);});
test('Custom Quote does not block known calculations', () => {const e = calc([item('furniture-wardrobe'), item('shelving-custom')]); assert.equal(e.total, 10000); assert.equal(e.incomplete, true); assert.match(estimateText(e), /€100.00\+/);});
test('unknown travel is clearly excluded', () => {const e = calc([item('furniture-wardrobe')], 'Other'); assert.equal(e.travel, null); assert.equal(e.total, 10000); assert.equal(e.incomplete, true); assert.match(estimateText(e), /Custom Quote — not included/);});
test('hourly services excluded from tier and discount; minimum applies', () => {const e = calc([item('handyman-hour', 11), item('wifi-printer', 5)]); assert.equal(e.eligibleUnits, 5); assert.equal(e.discount, 0); assert.equal(calc([item('pc-malware')]).total, 5000);});
test('packages explicit, extra hours at €45, no automatic package substitution', () => {
 assert.equal(calc([item('handyman-half', 1, {extraHours: 2})]).total, 26000);
 assert.equal(calc([item('handyman-full')]).total, 32000);
 assert.equal(calc([item('handyman-hour', 8)]).total, 36000);
 assert.throws(() => calc([item('handyman-half'), item('handyman-hour')]), /Choose one/);
 assert.equal(calc([item('handyman-full'), item('wifi-printer', 6)]).discount, 1200);
});
test('bundles do not double charge base installation or included addons', () => {
 const e = calc([item('tv-mount', 1, {installation: 'inclusive', cables: 'yes'})]); assert.equal(e.labour, 0); assert.equal(e.customOnly, true);
 assert.throws(() => calc([item('outdoor-assembly'), item('outdoor-seasonal')]), /Choose outdoor/);
 const paste = calc([item('pc-service', 1, {}, 'no')]); assert.equal(paste.lines[0].materialUnknown, false);
});
test('TV size prices follow source; bracket supply remains unknown', () => {
 assert.equal(calc([item('tv-mount', 1, {size: 'medium'})]).labour, 9000);
 assert.equal(calc([item('tv-mount', 1, {size: 'large'})]).labour, 11000);
 assert.equal(calc([item('tv-mount', 1, {size: 'oversize'})]).labour, 0);
 assert.equal(calc([item('tv-mount', 1, {bracket: 'needed'})]).incomplete, true);
});
test('invalid IDs, duplicate IDs, quantities, materials, options and area rejected', () => {
 for (const list of [[item('bad')], [item('wifi-printer'), item('wifi-printer')], [item('wifi-printer', -1)], [item('wifi-printer', 1.5)], [item('wifi-printer', 101)], [item('wifi-printer', 1, {extra: 'yes'})], [item('wifi-printer', 1, {}, 'invalid')], [item('tv-mount', 1, {size: 'fake'})]]) assert.throws(() => calc(list));
 assert.throws(() => calc([item('wifi-printer')], 'Dublin'));
 assert.equal(calc([item('flooring', 12.5)]).lines[0].quantity, 12.5);
});
test('browser-supplied prices are ignored', () => assert.equal(calc([{...item('wifi-printer'), price: 1, total: 1}]).total, 5000));
test('minimum applied after discount and no charge for empty basket', () => {assert.equal(calc([]).total, 0); assert.equal(calc([item('smart-speaker')]).total, 5000);});

test('TV main size variant is eligible labour, cable add-on is excluded', () => {
 const e = calc([item('tv-mount', 6, {size: 'medium', cables: 'yes'})]);
 assert.equal(e.eligibleUnits, 6); assert.equal(e.eligibleLabour, 54000);
 assert.equal(e.labour, 66000); assert.equal(e.discount, 2700);
});
