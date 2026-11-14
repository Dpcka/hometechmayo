import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {SERVICE_PAGES} from '../data/service-pages.mjs';
import {renderServicePage,renderContentReview,priceRows} from '../scripts/render-service-pages.mjs';
import {safePage,landingContext} from '../js/analytics-policy.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8').replace(/\r\n/g,'\n');
test('five service drafts have unique metadata, clean canonicals, and approved publication signals',()=>{
 assert.equal(SERVICE_PAGES.length,5);assert.equal(new Set(SERVICE_PAGES.map(p=>p.title)).size,5);assert.equal(new Set(SERVICE_PAGES.map(p=>p.description)).size,5);
 for(const p of SERVICE_PAGES){const html=read('services/'+p.slug+'.html');assert.equal(html,renderServicePage(p,{publish:true}));assert.equal((html.match(/<h1\b/g)||[]).length,1);assert.match(html,/name="robots" content="index, follow"/);assert.ok(html.includes(`rel="canonical" href="https://hometechmayo.ie/services/${p.slug}"`));assert.equal(read('sitemap.xml').includes('/services/'+p.slug),true);assert.equal(read('services.html').includes('href="/services/'+p.slug+'"'),true);assert.equal(/\b(?:src|href)="(?:assets|css|js)\//.test(html),false);assert.ok(p.faqs.length>=3&&p.faqs.length<=5);}
 assert.equal(read('docs/SERVICE-PAGE-CONTENT-REVIEW.md'),renderContentReview());
});
test('visible prices are authoritative catalogue labour and size variants, with owner-approved repair rates',()=>{
 const tv=priceRows(SERVICE_PAGES.find(p=>p.category==='tv-mounting'));assert.deepEqual(tv.map(r=>r.cents),[8000,9000,11000,null,null,2000]);
 const wifi=priceRows(SERVICE_PAGES.find(p=>p.category==='wifi'));assert.equal(wifi.find(r=>r.id==='wifi-printer').cents,4000);assert.match(wifi.find(r=>r.id==='wifi-printer').note,/€50 minimum/);
 const computer=priceRows(SERVICE_PAGES.find(p=>p.category==='computer'));assert.deepEqual(computer.filter(r=>r.id==='pc-diagnostics').map(r=>r.cents),[4000,5000]);assert.equal(computer.find(r=>r.id==='pc-ram').cents,4000);
 const handyman=priceRows(SERVICE_PAGES.find(p=>p.category==='handyman'));assert.deepEqual(handyman.slice(0,3).map(r=>r.cents),[4500,17000,32000]);
});
test('all service contact routes reuse the existing quotation and business contacts',()=>{
 for(const p of SERVICE_PAGES){const html=renderServicePage(p);assert.ok(html.includes(`href="/quote?category=${p.category}"`));assert.ok(html.includes('href="tel:+353833498496"'));assert.ok(html.includes('href="https://wa.me/353833498496"'));assert.ok(html.includes('href="mailto:info@hometechmayo.ie"'));assert.ok(html.includes('data-copy-contact="email"'));assert.equal((html.match(/src="\/js\/cookie-consent.mjs"/g)||[]).length,1);assert.equal(html.includes('<form'),false);}
});
test('service schema and breadcrumbs match each real route without invented ratings or offers',()=>{
 for(const p of SERVICE_PAGES){const html=renderServicePage(p);const graph=JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1])['@graph'];const service=graph[0];assert.equal(service.provider['@id'],'https://hometechmayo.ie/#business');assert.equal(service.url,'https://hometechmayo.ie/services/'+p.slug);assert.equal(service.aggregateRating,undefined);assert.equal(service.offers,undefined);assert.equal(graph[1].itemListElement[2].item,service.url);assert.equal((html.match(/<details>/g)||[]).length,p.faqs.length);}
});
test('only existing verified project assets appear, with dimensions and responsive lazy images',()=>{
 for(const p of SERVICE_PAGES){const html=renderServicePage(p);for(const [,path] of html.matchAll(/(?:src|href)="\/(assets\/[^"?#]+)"/g))assert.ok(existsSync(new URL('../'+path,import.meta.url)),path);for(const tag of html.matchAll(/<img\b[^>]*>/g)){assert.match(tag[0],/alt="[^"]*"/);assert.match(tag[0],/width="\d+"/);assert.match(tag[0],/height="\d+"/);}if(['tv-mounting','wifi','computer'].includes(p.category))assert.equal(/<img[^>]+\/assets\/projects\//.test(html),false);}
});
test('new service page analytics use existing safe context and do not leak query or referrer data',()=>{
 for(const p of SERVICE_PAGES){const path='/services/'+p.slug;assert.equal(safePage(path).page_location,'https://hometechmayo.ie'+path);assert.deepEqual(safePage(path),safePage(path+'.html'));const context=landingContext('https://hometechmayo.ie'+path+'?email=private@example.com#secret','https://www.google.ie/search?q=private@example.com');assert.equal(context.page_referrer,'https://www.google.ie/');assert.equal(JSON.stringify(context).includes('private'),false);}
});
test('renderer escapes content and JSON-LD, while publication is an explicit later step',()=>{
 const page={...SERVICE_PAGES[0],intro:'<script>alert("unsafe")</script>'};const html=renderServicePage(page);assert.ok(html.includes('&lt;script&gt;'));assert.equal(html.includes('<script>alert'),false);assert.ok(renderServicePage(page,{publish:true}).includes('content="index, follow"'));
});
