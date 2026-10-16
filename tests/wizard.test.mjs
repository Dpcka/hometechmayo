import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {BY_ID, CATALOGUE, CATEGORIES, calculate} from '../js/pricing-catalogue.mjs';
import {QUOTE_CATEGORIES, categoryById, quoteLink} from '../js/quote-categories.mjs';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const pricing = read('pricing.html');
const attrs = source => Object.fromEntries([...source.matchAll(/([\w-]+)="([^"]*)"/g)].map(match => [match[1], match[2]]));

test('all 17 category links map to unchanged catalogue categories', () => {
 assert.deepEqual(QUOTE_CATEGORIES.map(c => c.name), CATEGORIES);
 assert.equal(new Set(QUOTE_CATEGORIES.map(c => c.id)).size, 17);
 assert.equal(CATALOGUE.length, 46);
 for (const category of QUOTE_CATEGORIES) {
  assert.equal(categoryById(category.id), category);
  assert.ok(pricing.includes(`href="${quoteLink(category.id)}"`), category.id);
 }
 assert.equal(categoryById('unknown'), undefined);
});
test('every starting price agrees with the authoritative catalogue or visit minimum', () => {
 const rows = [...pricing.matchAll(/<li class="pricing-row"([^>]*)>([\s\S]*?)<\/li>/g)];
 assert.equal(rows.length, 32);
 for (const [, raw, body] of rows) {
  const data = attrs(raw);
  const displayed = body.match(/<strong class="pricing-price">([^<]+)<\/strong>/)[1];
  let expected;
  if (data['data-minimum']) expected = calculate([{id:'wifi-printer', quantity:1, materials:'yes', options:{}}], 'Castlebar').total;
  else if (data['data-custom'] || data['data-material']) expected = null;
  else {
   const service = BY_ID.get(data['data-service']); assert.ok(service, raw);
   expected = service.price;
   if (data['data-option']) {
    const option = service.options[data['data-option']].choices.find(c => c.value === data['data-value']);
    expected = option.price === null ? null : expected + option.price;
   }
   if (data['data-addon']) expected = service.options[data['data-addon']].choices.find(c => c.value === data['data-value']).price;
  }
  if (expected === null) assert.match(displayed, /Quote required|Priced separately/);
  else assert.equal(Number(displayed.match(/€(\d+)/)[1]) * 100, expected, body);
 }
});
test('Pricing contains starting cards and links but no inline calculator', () => {
 assert.ok(pricing.indexOf('id="starting-prices"') < pricing.indexOf('id="pricing-information"'));
 assert.equal(pricing.includes('id="quote-form"'), false);
 assert.equal(pricing.includes('src="js/pricing-calculator.mjs"'), false);
 assert.ok(pricing.includes('src="js/pricing-page.mjs"'));
});
test('new quote utility page has metadata without changing the existing sitemap', () => {
 const quote = read('quote.html');
 assert.match(quote, /<title>Get a Quote in Mayo/);
 assert.match(quote, /rel="canonical" href="https:\/\/hometechmayo.ie\/quote.html"/);
 assert.match(quote, /name="robots" content="noindex, follow"/);
 assert.equal(read('sitemap.xml').includes('quote.html'), false);
 assert.equal([...quote.matchAll(/class="wizard-step"/g)].length, 3);
});
