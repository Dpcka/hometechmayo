// Consent/GA transport tests use a local mock tag and intercept ALL Google hits.
// No test traffic or personal data is sent to the real Analytics property.
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin = 'http://127.0.0.1:8788';
const KEY = 'htss_cookie_consent';
const ID = 'G-7H312MNH9B';
const record = analytics => JSON.stringify({version:1,analytics,savedAt:Date.now()});
const mockTag = `(() => {
 const consume = args => {
  const [command,name,params] = Array.from(args);
  if (command !== 'event' || window['ga-disable-G-7H312MNH9B']) return;
  document.cookie='htss_ga=synthetic-id; Path=/; SameSite=Lax';
  document.cookie='htss_ga_7H312MNH9B=synthetic-session; Path=/; SameSite=Lax';
  fetch('https://www.google-analytics.com/g/collect?en='+encodeURIComponent(name)+'&payload='+encodeURIComponent(JSON.stringify(params)),{mode:'no-cors'});
 };
 const layer=window.dataLayer || (window.dataLayer=[]);
 const oldPush=layer.push.bind(layer);
 layer.push=(...args)=>{args.forEach(consume);return oldPush(...args)};
 layer.forEach(consume);
})();`;
const sleep = ms => new Promise(resolve=>setTimeout(resolve,ms));
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const errors=[];
 async function context(consent,extra={},verifiedFixture=true) {
  const ctx=await browser.newContext({viewport:{width:390,height:844},...extra});
  const hits=[],scripts=[];
  await ctx.addInitScript(({consent,KEY})=>{
   try {sessionStorage.setItem('htss_ga_debug','1');
   if(consent!==undefined && localStorage.getItem(KEY)===null) localStorage.setItem(KEY,consent);} catch {}
  },{consent,KEY});
  if (verifiedFixture) await ctx.route('**/js/analytics-policy.mjs',r=>r.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(__dirname,'../js/analytics-policy.mjs'),'utf8').replace('export const GOOGLE_CONFIGURATION_VERIFIED = false;', 'export const GOOGLE_CONFIGURATION_VERIFIED = true;')}));
  await ctx.route('https://fonts.googleapis.com/**',r=>r.abort());
  await ctx.route('https://www.googletagmanager.com/**',r=>{scripts.push(r.request().url());return r.fulfill({contentType:'text/javascript',body:mockTag});});
  await ctx.route('https://www.google-analytics.com/**',r=>{const u=new URL(r.request().url());hits.push({name:u.searchParams.get('en'),params:JSON.parse(u.searchParams.get('payload')||'{}')});return r.fulfill({status:204,headers:{'Access-Control-Allow-Origin':'*'}});});
  ctx.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
  return {ctx,hits,scripts};
 }
 const pageviewCount = b => b.hits.filter(e=>e.name==='page_view').length;
 const leadCount = b => b.hits.filter(e=>e.name==='generate_lead').length;
 async function waitForHits(page,b,count) {await page.waitForFunction(n=>window.dataLayer&&Array.from(window.dataLayer).filter(c=>c[0]==='event').length>=n,count);await sleep(60);}
 async function settings(page) {await page.locator('footer [data-cookie-settings]').click();await page.locator('.cookie-dialog[open]').waitFor();}
 // Public production hostname is intercepted locally: the safety gate must
 // block collection even with consent/debug until account settings are verified.
 const {GOOGLE_CONFIGURATION_VERIFIED} = await import('../js/analytics-policy.mjs');
 if (!GOOGLE_CONFIGURATION_VERIFIED) {
  const gated=await context(undefined,{},false);
  await gated.ctx.route('https://hometechmayo.ie/**', async route=>{
   const u=new URL(route.request().url());const r=await fetch(origin+u.pathname+u.search);
   return route.fulfill({status:r.status,headers:{'Content-Type':r.headers.get('content-type')||'text/plain'},body:Buffer.from(await r.arrayBuffer())});
  });
  const gp=await gated.ctx.newPage();await gp.goto('https://hometechmayo.ie/pricing.html',{waitUntil:'networkidle'});
  await gp.locator('[data-choice=accept]').click();await sleep(100);
  assert.equal(gated.scripts.length,0);assert.equal(gated.hits.length,0);await gated.ctx.close();
 }
 // Initial refusal and no analytics before an affirmative choice.
 const first=await context();const p=await first.ctx.newPage();
 await p.goto(origin+'/pricing.html?utm_source=google&utm_medium=cpc&utm_campaign=mayo&email=private%40example.com&utm_term=0831234567&gclid=secret#private',{referer:'https://www.google.ie/search?q=private%40example.com',waitUntil:'networkidle'});
 assert.equal(first.scripts.length,0);assert.equal(first.hits.length,0);
 assert.deepEqual(await first.ctx.cookies(),[]);
 assert.equal(await p.evaluate(KEY=>localStorage.getItem(KEY),KEY),null);
 assert.deepEqual(await p.evaluate(()=>Object.keys(sessionStorage)),['htss_ga_debug']);
 // Changing the visible URL must not replace the sanitized landing metadata.
 await p.evaluate(()=>history.replaceState(null,'','/pricing.html?utm_source=facebook&utm_medium=social&email=changed@example.com'));
 await p.locator('[data-choice=accept]').click();
 await p.waitForFunction(()=>Array.from(window.dataLayer||[]).some(c=>c[1]==='page_view'));await sleep(80);
 assert.equal(first.scripts.length,1);assert.equal(pageviewCount(first),1);
 assert.equal(first.hits[0].params.campaign_source,'google');assert.equal(first.hits[0].params.campaign_medium,'cpc');assert.equal(first.hits[0].params.campaign_name,'mayo');
 assert.equal(first.hits[0].params.page_location,'https://hometechmayo.ie/pricing.html');
 assert.equal(first.hits[0].params.page_referrer,'https://www.google.ie/');
 assert.equal(JSON.stringify(first.hits).includes('private'),false);assert.equal(JSON.stringify(first.hits).includes('0831234567'),false);
 assert.ok((await first.ctx.cookies()).some(c=>c.name==='htss_ga'));
 await p.setViewportSize({width:1280,height:900});
 for(const selector of ['.whatsapp-float','a[href^="tel:"]','.quote-button','.pricing-card-action']) {
  const link=p.locator(selector).first();await link.evaluate(a=>a.addEventListener('click',e=>e.preventDefault()));await link.click();
 }
 await sleep(80);
 assert.equal(first.hits.filter(e=>e.name==='whatsapp_click').length,1);
 assert.equal(first.hits.filter(e=>e.name==='phone_click').length,1);
 assert.equal(first.hits.filter(e=>e.name==='quote_interaction').length,2);
 assert.equal(leadCount(first),0,'contact clicks must never count as submitted leads');
 assert.equal(JSON.stringify(first.hits).includes('353833498496'),false);
 for(const width of [360,390,768,1280]) {
  await p.setViewportSize({width,height:844});await settings(p);
  const box=await p.locator('.cookie-dialog').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width+1&&box.y>=0&&box.height<=844);
  await p.locator('#cookie-analytics-toggle').uncheck();await p.locator('#cookie-cancel').click();
  assert.equal(await p.evaluate(KEY=>JSON.parse(localStorage.getItem(KEY)).analytics,KEY),true);
 }
 await settings(p);await p.locator('#cookie-analytics-toggle').uncheck();await p.locator('#cookie-save').click();
 assert.equal(await p.evaluate(ID=>window['ga-disable-'+ID],ID),true);
 assert.equal((await first.ctx.cookies()).some(c=>c.name.startsWith('htss_ga')),false);
 const before=first.hits.length;
 await p.locator('a[href^="tel:"]').first().click();
 await p.evaluate(()=>document.dispatchEvent(new CustomEvent('htss:quote-submitted')));await sleep(80);
 assert.equal(first.hits.length,before);
 // Reopening/saving preferences doesn't reload the page or duplicate its view.
 await settings(p);await p.locator('#cookie-analytics-toggle').check();await p.locator('#cookie-save').click();await sleep(50);
 assert.equal(first.scripts.length,1);assert.equal(pageviewCount(first),1);
 const second=await first.ctx.newPage();await second.goto(origin+'/services.html',{waitUntil:'networkidle'});assert.equal(first.scripts.length,2);
 await settings(p);await p.locator('#cookie-analytics-toggle').uncheck();await p.locator('#cookie-save').click();
 await second.waitForFunction(ID=>window['ga-disable-'+ID]===true,ID);
 await settings(second);assert.equal(await second.locator('#cookie-analytics-toggle').isChecked(),false);await second.keyboard.press('Escape');
 await first.ctx.close();
 // Expired decisions fail closed and ask again; no attribution is persisted.
 const expired=await context(JSON.stringify({version:1,analytics:true,savedAt:Date.now()-181*86400000}));
 const ep=await expired.ctx.newPage();await ep.goto(origin+'/privacy.html',{waitUntil:'networkidle'});assert.equal(await ep.locator('.cookie-banner').isVisible(),true);assert.equal(expired.scripts.length,0);await expired.ctx.close();
 // Storage failure cannot break the page or imply consent.
 const deniedStorage=await context();await deniedStorage.ctx.addInitScript(()=>{const get=Storage.prototype.getItem,set=Storage.prototype.setItem;Storage.prototype.getItem=function(k){if(k==='htss_cookie_consent'||k==='htss_ga_debug')throw new Error('blocked');return get.call(this,k)};Storage.prototype.setItem=function(k,v){if(k==='htss_cookie_consent'||k==='htss_ga_debug')throw new Error('blocked');return set.call(this,k,v)};});
 const dp=await deniedStorage.ctx.newPage();await dp.goto(origin+'/pricing.html',{waitUntil:'networkidle'});await dp.locator('[data-choice=reject]').click();assert.equal(await dp.locator('.cookie-banner').isVisible(),false);assert.equal(deniedStorage.scripts.length,0);await deniedStorage.ctx.close();
 async function quoteSetup(b) {
  await b.ctx.route('**/api/quote-config',r=>r.fulfill({json:{enabled:true,siteKey:'test-public-key',version:'2026-10-16.1'}}));
  await b.ctx.route('https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit',r=>r.fulfill({contentType:'text/javascript',body:`window.turnstile={render:(el,c)=>{window.testWidget=c;setTimeout(()=>c.callback('synthetic-token'),10);return 'test';},reset:()=>setTimeout(()=>window.testWidget.callback('synthetic-token'),10)};`}));
 }
 async function fillQuote(page) {
  await page.getByRole('button',{name:'Add Printer / device setup',exact:true}).click();
  await page.getByRole('button',{name:'Continue to estimate',exact:true}).click();
  await page.locator('select[name=area]').selectOption('Westport');await page.locator('[data-materials="wifi-printer"]').selectOption('yes');
  assert.equal(await page.locator('#estimate-summary .estimate-amount').innerText(),'€60.00');
  await page.getByRole('button',{name:'Continue to quote',exact:true}).click();
  await page.locator('input[name=name]').fill('Private Person');await page.locator('input[name=phone]').fill('0831234567');
  await page.locator('input[name=email]').fill('private@example.com');await page.locator('input[name=eircode]').fill('F26 A123');
  await page.locator('textarea[name=description]').fill('Private job contents');await page.locator('input[name=consent]').check();
  await page.locator('#quote-submit:not(:disabled)').waitFor();
 }
 const refused=await context(record(false));await quoteSetup(refused);let refusedCalls=0;
 await refused.ctx.route('**/api/quote',r=>{refusedCalls++;return r.fulfill({json:{ok:true,reference:'HT-SYNTHETIC',acknowledgement:false}})});
 const rp=await refused.ctx.newPage();await rp.goto(origin+'/quote.html?category=wifi',{waitUntil:'networkidle'});await fillQuote(rp);
 // Opening/closing Cookie settings must preserve a partly completed form.
 await settings(rp);await rp.locator('#cookie-cancel').click();assert.equal(await rp.locator('input[name=name]').inputValue(),'Private Person');
 await rp.locator('#quote-submit').click();await rp.locator('#quote-status').filter({hasText:'HT-SYNTHETIC'}).waitFor();
 assert.equal(refusedCalls,1);assert.equal(refused.scripts.length,0);assert.equal(refused.hits.length,0);
 await settings(rp);await rp.locator('#cookie-analytics-toggle').check();await rp.locator('#cookie-save').click();await sleep(80);
 assert.equal(leadCount(refused),0,'never backfill a lead that occurred without consent');await refused.ctx.close();
 const allowed=await context(record(true));await quoteSetup(allowed);let posts=0,sent;
 await allowed.ctx.route('**/api/quote',r=>{posts++;sent=r.request().postDataJSON();return r.fulfill(posts===1?{status:503,json:{error:'Synthetic failure'}}:posts===2?{json:{ok:false,error:'Synthetic rejection'}}:{json:{ok:true,reference:'HT-PRIVATE-REFERENCE',acknowledgement:false,duplicate:true}})});
 const ap=await allowed.ctx.newPage();await ap.goto(origin+'/quote.html?category=wifi&email=private@example.com',{waitUntil:'networkidle'});await fillQuote(ap);
 await ap.locator('#quote-submit').click();await ap.locator('#quote-status').filter({hasText:'Synthetic failure'}).waitFor();assert.equal(leadCount(allowed),0);
 await ap.locator('#quote-submit:not(:disabled)').waitFor();await ap.locator('#quote-submit').click();await ap.locator('#quote-status').filter({hasText:'Synthetic rejection'}).waitFor();assert.equal(leadCount(allowed),0);
 await ap.locator('#quote-submit:not(:disabled)').waitFor();await ap.locator('#quote-submit').click();await ap.locator('#quote-status').filter({hasText:'HT-PRIVATE-REFERENCE'}).waitFor();await sleep(80);
 assert.equal(leadCount(allowed),1);assert.equal(posts,3);assert.equal(sent.phone,'0831234567');
 await ap.evaluate(()=>document.dispatchEvent(new CustomEvent('htss:quote-submitted')));await sleep(50);assert.equal(leadCount(allowed),1);
 const sentToGA=JSON.stringify(allowed.hits);
 for(const privateValue of ['Private Person','0831234567','private@example.com','F26 A123','Private job contents','HT-PRIVATE-REFERENCE',sent.requestId,'synthetic-token']) assert.equal(sentToGA.includes(privateValue),false,privateValue);
 assert.ok(allowed.hits.some(h=>h.name==='quote_interaction'&&h.params.action==='step_estimate'));
 assert.ok(allowed.hits.some(h=>h.name==='quote_interaction'&&h.params.action==='step_request'));
 await allowed.ctx.close();
 assert.deepEqual(errors,[]);
 console.log('PASS: zero Google loads/hits/cookies before consent or after reject; safe pending UTM/referrer; one page view; separate contact/quote/lead events; withdrawal/re-consent/cross-tab/expiry/blocked storage; 360/390/768/1280 settings; quote success/failure/duplicate and private-data exclusion. All Google hits and quote delivery mocked.');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
