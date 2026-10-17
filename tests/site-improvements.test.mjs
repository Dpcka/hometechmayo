import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const home=readFileSync('index.html','utf8');
test('Projects remains unchanged from the deployed baseline',()=>{
 const previous=execFileSync('git',['show','e0b2b79d3983a22efc84fc313892814fb05a86a6:index.html'],{encoding:'utf8'});
 const section=s=>s.match(/<section id="projects"[\s\S]*?<\/section>/)[0].replace(/\r\n/g,'\n');
 assert.equal(section(home),section(previous));
});
test('hero is responsive with explicit dimensions and approved navigation',()=>{
 assert.match(home,/hero-800.webp 800w/);assert.match(home,/hero-1600.webp 1600w/);
 assert.match(home,/width="1600" height="1066"/);assert.match(home,/Home Repairs &amp; Smart Home Solutions/);
 assert.ok(home.indexOf('<section id="services"')<home.indexOf('<section id="about"'));
});
test('service cards point to existing unique Pricing anchors',()=>{
 const pricing=readFileSync('pricing.html','utf8');
 const cards=home.match(/<a class="service-card" href="pricing.html#pricing-[^"]+">/g);
 assert.equal(cards.length,6);
 for(const card of cards){const anchor=card.match(/#([^"]+)/)[1];assert.equal(pricing.split(`id="${anchor}"`).length-1,1);}
});
