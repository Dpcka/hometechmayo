import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('public canonicals and sitemap use the same clean apex URLs',()=>{
 const paths=['','services','pricing','privacy','reviews'];
 const urls=[...read('sitemap.xml').matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]);
 assert.deepEqual(urls,paths.map(p=>'https://hometechmayo.ie/'+p));
 for(const p of paths){const html=read((p||'index')+'.html'); assert.ok(html.includes(`rel="canonical" href="https://hometechmayo.ie/${p}"`)); assert.equal(/href="(?:index|services|pricing|privacy|quote|reviews)\.html/.test(html),false);}
 assert.match(read('quote.html'),/name="robots" content="noindex, follow"/);
 assert.match(read('admin/reviews.html'),/noindex/);
 assert.equal(urls.some(u=>/quote|admin|api/.test(new URL(u).pathname)),false);
});
test('calculator has an accessible non-animated loading footprint and a no-JS fallback',()=>{
 assert.match(read('quote.html'),/id="calculator-loading"[^>]*role="status"/);
 assert.match(read('css/calculator.css'),/\.calculator-loading \{min-height:1200px/);
 assert.match(read('js/pricing-calculator.mjs'),/querySelector\('#calculator-loading'\).hidden = true/);
 assert.match(read('quote.html'),/<noscript><style>\.calculator-loading \{display:none\}/);
});
import {safePage} from '../js/analytics-policy.mjs';
test('analytics collapses clean and legacy routes without carrying personal URL data',()=>{
 for(const p of ['services','pricing','quote','privacy']){
  assert.deepEqual(safePage('/'+p+'.html'),safePage('/'+p));
  assert.equal(safePage('/'+p).page_location,'https://hometechmayo.ie/'+p);
 }
});
test('verified service schema links to real service sections and the business identity',()=>{
 const html=read('index.html');const schema=JSON.parse(html.match(/<script type="application\/ld\+json">\s*({[\s\S]*?})\s*<\/script>/)[1]);
 assert.equal(schema.telephone,'+353833498496');assert.equal(schema.email,'info@hometechmayo.ie');
 assert.equal(schema.aggregateRating,undefined);
 for(const item of schema.hasOfferCatalog.itemListElement){const url=new URL(item.itemOffered.url);assert.equal(url.pathname,'/services');assert.ok(read('services.html').includes(`id="${url.hash.slice(1)}"`));assert.equal(item.itemOffered.provider['@id'],schema['@id']);}
});
