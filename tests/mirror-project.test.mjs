import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import sharp from 'sharp';
import {MIRROR_PROJECT as p} from '../data/mirror-project.mjs';
import {PROJECTS} from '../js/project-data.mjs';
import {safePage} from '../js/analytics-policy.mjs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('Castlebar mirror is exactly one project with four approved photographs in 2,1,4,3 order',()=>{
  assert.equal(PROJECTS.filter(v=>v.id===p.id).length,1);
  const selection=JSON.parse(read('social-media/2026-11-21-castlebar-mirror/image-selection.json'));
  assert.deepEqual(selection.order,[2,1,4,3]);assert.equal(p.images.length,4);
  assert.deepEqual(p.images,JSON.parse(read('assets/projects/'+p.id+'/images.json')));
  assert.match(p.images[0].src,/staircase-finished/);
  assert.equal(p.completionDate,'2026-11-21');assert.equal(p.websiteReviewAssociation,false);
  assert.equal(p.testimonial.rating,5);assert.match(p.testimonial.url,/^https:\/\/www.google.com\/search\?/);
  assert.equal(p.testimonial.source,'Google');assert.equal(p.testimonial.author,'Austin');
  assert.match(p.testimonial.verification,/owner-provided screenshots/);
  assert.ok(p.testimonial.fullText.includes(p.testimonial.text));
});
test('mirror project metadata and discoverability use the clean canonical URL',()=>{
  const html=read(p.detailUrl.slice(1)+'.html');
  assert.equal((html.match(/<h1>/g)||[]).length,1);
  assert.match(html,/<footer class="footer">/);assert.match(html,/container footer-grid/);
  assert.match(html,/\/css\/cookie-consent.css/);assert.match(html,/\/js\/cookie-consent.mjs/);
  assert.ok(html.includes('rel="canonical" href="https://hometechmayo.ie'+p.detailUrl+'"'));
  assert.match(html,/<title>Large Mirror Installation in Castlebar, Mayo/);
  assert.match(html,/1900 × 1400 mm/);assert.match(html,/Block wall/);
  assert.match(html,/2 hours 21 minutes/);assert.match(html,/Two people/);
  assert.ok(read('sitemap.xml').includes('https://hometechmayo.ie'+p.detailUrl));
  assert.ok(read('index.html').includes('href="'+p.detailUrl+'"'));
  const schema=JSON.parse(html.match(/application\/ld\+json">(.*?)<\/script>/s)[1]);
  assert.equal(schema['@graph'][0].image.length,4);
  assert.equal(schema['@graph'][0].creator['@id'],'https://hometechmayo.ie/#business');
  assert.equal(schema['@graph'][0].aggregateRating,undefined);
  assert.equal(safePage(p.detailUrl).page_location,'https://hometechmayo.ie'+p.detailUrl);
  execFileSync(process.execPath,['scripts/render-mirror-project.mjs','--check']);
});
test('screenshot-confirmed Google feedback preserves the exact wording, five stars and first-name-only attribution',()=>{
  const html=read(p.detailUrl.slice(1)+'.html');
  for(const paragraph of p.testimonial.fullText.split('\n\n'))assert.ok(html.includes(paragraph.replaceAll('&','&amp;')));
  assert.match(html,/Austin, Castlebar/);assert.match(html,/Google review</);
  assert.match(html,/aria-label="5 out of 5 stars"/);
  assert.doesNotMatch(html,/Austin Lacey|reviewRating|aggregateRating/);
  assert.match(html,/href="\/services\/handyman"/);assert.match(html,/href="\/quote\?category=handyman"/);
});

test('Google Reviews carousel includes Austin once, preserves its two existing reviews and links to the full text',()=>{
  const section=read('index.html').match(/<section id="reviews"[\s\S]*?<\/section>/)[0];
  assert.equal((section.match(/class="review-slide"/g)||[]).length,3);
  assert.equal((section.match(/data-google-review="castlebar-mirror-austin"/g)||[]).length,1);
  assert.ok(section.includes(p.testimonial.text.replaceAll('&','&amp;')));
  assert.match(section,/<h3>Austin<\/h3>/);assert.doesNotMatch(section,/Austin Lacey/);
  assert.match(section,/Michael van der Klei/);assert.match(section,/Ann Smyth/);
  assert.ok(section.includes('href="'+p.detailUrl+'"'));
});
test('responsive mirror exports have correct dimensions, no location metadata and a bounded size',async()=>{
  for(const image of p.images){
    for(const entry of image.srcset.split(', ')){
      const [file,w]=entry.split(' ');assert.ok(existsSync(file));
      const m=await sharp(file).metadata();assert.equal(m.width,Number(w.slice(0,-1)));
      assert.ok(Math.abs(m.width/m.height-3/4)<0.002);assert.equal(m.exif,undefined);assert.equal(m.xmp,undefined);assert.equal(m.iptc,undefined);
      assert.ok(readFileSync(file).length<250000);
    }
  }
});
test('Facebook package has four natural portrait exports and is explicitly a manual draft',async()=>{
  const dir='social-media/2026-11-21-castlebar-mirror/';
  const text=read(dir+'facebook-post.txt');assert.ok(text.includes('https://hometechmayo.ie'+p.detailUrl));
  assert.ok(text.includes(p.testimonial.text));assert.match(read(dir+'README.txt'),/NOT PUBLISHED/);
  for(const [i,image]of p.images.entries()){
    const name=image.src.split('/').at(-1).replace('-800.webp','.jpg');
    const m=await sharp(dir+(i+1)+'-'+name).metadata();
    assert.equal(m.width/m.height,3/4);assert.equal(m.exif,undefined);
  }
});
