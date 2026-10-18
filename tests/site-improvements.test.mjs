import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const home=readFileSync('index.html','utf8');
test('existing project titles, descriptions and cover images are preserved; Hero remains unchanged',()=>{
 const previous=execFileSync('git',['show','5d0dd3929ac626756494e695f13fa6aef7d4a837:index.html'],{encoding:'utf8'});
 const section=(s,id)=>s.match(new RegExp(`<section id="${id}"[\\s\\S]*?<\\/section>`))[0].replace(/\r\n/g,'\n');
 assert.equal(section(home,'home'),section(previous,'home'));
 const oldProjects=section(previous,'projects');
 for(const title of ['Bathroom Ventilation Upgrade','Furniture Assembly'])assert.ok(home.includes(`<h3>${title}</h3>`));
 for(const path of ['assets/projects/PXL_20260713_151848763-800.webp','assets/projects/about-800.webp'])assert.ok(home.includes(path)&&oldProjects.includes(path));
 const descriptions=[...oldProjects.matchAll(/<div class="project-content">[\s\S]*?<p>([\s\S]*?)<\/p>/g)].map(m=>m[1].replace(/\s+/g,' ').trim());
 for(const description of descriptions)assert.ok(home.replace(/\s+/g,' ').includes(description));
});

test('hero is responsive with explicit dimensions and approved navigation',()=>{
 assert.match(home,/hero-800.webp/);assert.match(home,/hero-1600.webp/);
 assert.match(home,/width="1600"\s+height="1066"/);assert.match(home,/Professional Home Improvement/);
 assert.ok(home.indexOf('<section id="services"')<home.indexOf('<section id="about"'));
});
test('service cards point to existing unique Pricing anchors',()=>{
 const pricing=readFileSync('pricing.html','utf8');
 const cards=home.match(/<a class="service-card" href="pricing.html#pricing-[^"]+">/g);
 assert.equal(cards.length,6);
 for(const card of cards){const anchor=card.match(/#([^"]+)/)[1];assert.equal(pricing.split(`id="${anchor}"`).length-1,1);}
});
