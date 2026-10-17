const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const dir=process.env.SITE_SCREENSHOTS||'work/site-improvements';fs.mkdirSync(dir,{recursive:true});
 try {
 for(const width of [360,390,412,768,1280]){
  const ctx=await browser.newContext({viewport:{width,height:915},permissions:['clipboard-read','clipboard-write']});
  await ctx.addInitScript(()=>{localStorage.setItem('htss_cookie_consent',JSON.stringify({version:1,analytics:false,savedAt:Date.now()}));localStorage.setItem('whatsappClosed','true');});
  const page=await ctx.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8788/',{waitUntil:'networkidle'});
  await page.locator('.hero-media img').evaluate(img=>img.decode());
  const dimensions=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,hero:document.querySelector('.hero').getBoundingClientRect().height,image:document.querySelector('.hero-media img').getBoundingClientRect().toJSON(),source:document.querySelector('.hero-media img').currentSrc}));
  assert.equal(dimensions.overflow,false);assert.match(dimensions.source,/hero-(800|1600)\.webp/);
  assert.ok(Math.abs(dimensions.image.width-width)<2,'photo must span viewport');
  assert.equal(await page.locator('.hero-media img').evaluate(n=>getComputedStyle(n).objectFit),'cover');
  assert.equal(await page.locator('.hero-content').evaluate(n=>getComputedStyle(n).textAlign),'center');
  await page.screenshot({path:`${dir}/home-${width}.png`,fullPage:true});
  assert.equal(await page.locator('.hero-buttons a').first().getAttribute('href'),'quote.html');
  assert.equal(await page.locator('.contact-card-main[href="tel:+353833498496"]').count(),1);
  assert.equal(await page.locator('.contact-card-main[href="mailto:info@hometechmayo.ie"]').count(),1);
  await page.locator('[data-copy-contact="email"]').click();
  await page.waitForFunction(()=>document.querySelector('#contact-copy-status').textContent.includes('Email copied'));
  assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),'info@hometechmayo.ie');
  const cards=await page.locator('#services a.service-card').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('href')));
  assert.equal(cards.length,6);
  for(const href of cards){await page.goto('http://127.0.0.1:8788/'+href);assert.equal(await page.locator(new URL(page.url()).hash).count(),1);await page.reload();assert.equal(await page.locator(new URL(page.url()).hash).count(),1);}
  await page.goto('http://127.0.0.1:8788/');await page.locator('#services a.service-card').first().click();await page.goBack();assert.equal(new URL(page.url()).pathname,'/');
  assert.deepEqual(errors,[]);console.log(`PASS ${width}px: image, overflow, hero (${dimensions.hero}px), contact, copy, deep links, refresh and Back`);await ctx.close();
 }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
