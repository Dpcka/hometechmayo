// Offline measurement audit of a freshly downloaded official Google tag.
// All third-party browser traffic is blocked or fulfilled locally. Never sends
// test hits to Google. Positive runs use the release source; a disabled-gate
// fixture preserves fail-closed coverage independently of activation.
const assert = require('node:assert/strict');
const fs = require('node:fs'), crypto = require('node:crypto');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const tagPath = process.env.GA_TAG_FILE || 'work/ga-real-tag.js';
const tag = fs.readFileSync(tagPath, 'utf8');
const tagSettings = JSON.parse(tag.match(/"tags":(\[[\s\S]*?\]),\s*"predicates":/)[1])
 .filter(t=>['__ogt_auto_events','__ogt_1p_data_v2','__ccd_em_site_search','__ccd_em_page_view','__ccd_auto_redact','__ccd_ga_regscope'].includes(t.function));
const policy = fs.readFileSync('js/analytics-policy.mjs', 'utf8');
const origin = 'http://127.0.0.1:8788';
const markers = ['SYNTHETIC_PRIVATE', 'private@example.com', '0831234567'];
const personalHashes=['private@example.com','0831234567','+353831234567','353831234567'].map(v=>crypto.createHash('sha256').update(v).digest('hex'));
function decode(value) {for (let i=0;i<3;i++) {try {value=decodeURIComponent(value);} catch {break;}} return value;}
function rows(hit) {
  const base = new URL(hit.url);
  return (hit.body ? hit.body.split('\n') : ['']).map(line => {
    const fields = Object.fromEntries(new URLSearchParams(base.search));
    for (const [k,v] of new URLSearchParams(line)) fields[k]=v;
    return fields;
  });
}
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const results=[];
 try {
  for (const width of [390,1280]) for (const override of [false,true]) {
   const ctx=await browser.newContext({viewport:{width,height:844},serviceWorkers:'block'});
   const hits=[],other=[],tagHeaders=[];
   await ctx.addInitScript(()=>{try {sessionStorage.setItem('htss_ga_debug','1');} catch {}});
   await ctx.route('**/*',async r=>{
    const req=r.request(),u=new URL(req.url());
    if(u.origin===origin) {
     // Positive runs use the actual release source; negative runs force the
     // disabled gate only in the fixture, preserving fail-closed coverage.
     if(!override&&u.pathname==='/js/analytics-policy.mjs') return r.fulfill({contentType:'text/javascript',body:policy.replace(/GOOGLE_CONFIGURATION_VERIFIED = (?:true|false)/,'GOOGLE_CONFIGURATION_VERIFIED = false')});
     return r.continue();
    }
    if(u.hostname==='www.googletagmanager.com'&&u.pathname==='/gtag/js') {
     tagHeaders.push(await req.allHeaders());
     return r.fulfill({contentType:'text/javascript',body:tag});
    }
    if(u.pathname.endsWith('/collect')) {
     hits.push({url:req.url(),body:req.postData()||'',headers:await req.allHeaders()});
     return r.fulfill({status:204,headers:{'Access-Control-Allow-Origin':'*'}});
    }
    other.push({url:req.url(),headers:await req.allHeaders()});return r.abort();
   });
   const p=await ctx.newPage();
   const cdp=await ctx.newCDPSession(p);
   await cdp.send('Emulation.setFocusEmulationEnabled',{enabled:true});
   await p.bringToFront();
   await p.goto(origin+'/quote.html?category=wifi&utm_source=google&utm_medium=cpc&utm_campaign=mayo&email=private%40example.com&phone=0831234567&gclid=SYNTHETIC_PRIVATE_CLICK&q=SYNTHETIC_PRIVATE_SEARCH#SYNTHETIC_PRIVATE_HASH',
    {referer:'https://www.google.ie/search?q=SYNTHETIC_PRIVATE_REF',waitUntil:'networkidle'});
   assert.equal(hits.length,0);assert.equal(tagHeaders.length,0);
   if(width===390) {
    await p.locator('[data-choice=reject]').click();await p.reload({waitUntil:'networkidle'});
    assert.equal(hits.length,0);assert.equal(tagHeaders.length,0);
    assert.equal(await p.locator('.cookie-banner').isVisible(),false);
    await p.locator('footer [data-cookie-settings]').click();
    await p.locator('#cookie-analytics-toggle').check();await p.locator('#cookie-save').click();
   } else await p.locator('[data-choice=accept]').click();
   await p.waitForTimeout(1500);
   await p.getByRole('button',{name:'Add Printer / device setup',exact:true}).click();
   await p.getByRole('button',{name:'Continue to estimate',exact:true}).click();
   await p.locator('select[name=area]').selectOption('Castlebar');
   await p.getByRole('button',{name:'Continue to quote',exact:true}).click();
   await p.locator('input[name=name]').fill('SYNTHETIC_PRIVATE_NAME');
   await p.locator('input[name=phone]').fill('0831234567');
   await p.locator('input[name=email]').fill('private@example.com');
   await p.locator('textarea[name=description]').fill('SYNTHETIC_PRIVATE_JOB');
   await p.evaluate(()=>{
    const link=document.createElement('a');
    link.href='https://wa.me/353831234567?text=SYNTHETIC_PRIVATE_CONTACT';
    link.textContent='Synthetic contact';document.body.append(link);
    link.addEventListener('click',e=>e.preventDefault());link.click();link.remove();
    const phone=document.createElement('a');phone.href='tel:+353831234567';
    document.body.append(phone);phone.addEventListener('click',e=>e.preventDefault());phone.click();phone.remove();
   });
   await p.evaluate(()=>{
    document.dispatchEvent(new CustomEvent('htss:quote-submitted'));
    history.pushState(history.state,'','?category=wifi&phone=0831234567&case=SYNTHETIC_PRIVATE_PUSH');
   });
   await p.waitForTimeout(1300);
   await p.evaluate(()=>{
    history.replaceState(history.state,'','?category=wifi&email=private%40example.com&case=SYNTHETIC_PRIVATE_HISTORY');
    window.scrollTo(0,document.body.scrollHeight);
   });
   await p.waitForTimeout(1300);await p.evaluate(()=>history.back());
   await p.waitForTimeout(2200);
   // Leave an engaged foreground interval after the last manual event so
   // engagement is not merely attached to that event's _et parameter.
   if(override) await p.waitForTimeout(12000);
   // Ask the browser to enter its real frozen lifecycle state, then resume.
   // This exercises automatic engagement/visibility handlers without calling
   // gtag('event', 'user_engagement') or fabricating a reserved Analytics event.
   if(override) {
    await cdp.send('Emulation.setFocusEmulationEnabled',{enabled:false});
    await cdp.send('Page.setWebLifecycleState',{state:'frozen'});await p.waitForTimeout(700);
    await cdp.send('Page.setWebLifecycleState',{state:'active'});await p.waitForTimeout(700);
   }
   // A trusted navigation flushes Google's automatic engagement lifecycle.
   // The terminal page has no tag, so it cannot create a second page view.
   await ctx.route(origin+'/ga-audit-finish',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><title>Audit finished</title>'}));
   const returnUrl=p.url();
   await p.goto(origin+'/ga-audit-finish');await p.waitForTimeout(1000);
   const fields=hits.flatMap(rows);
   const leaking=fields.flatMap(f=>Object.entries(f).filter(([,v])=>markers.some(m=>decode(v).includes(m))).map(([key])=>key));
   const report={width,gateMode:override?'actual release source':'disabled fixture',tagLoads:tagHeaders.length,requests:hits.length,
    consentPath:width===390?'reject, reload, grant through settings':'Accept analytics',
    events:fields.map(f=>f.en).filter(Boolean),pageLocations:[...new Set(fields.map(f=>f.dl).filter(Boolean))],
    beforeConsentRequests:0,afterRejectRequests:0,
    sessionStartFlags:fields.filter(f=>f._ss==='1').length,
    firstVisitFlags:fields.filter(f=>f._fv==='1').length,
    engagementTimeParameters:fields.filter(f=>f._et).map(f=>({event:f.en,engagement_time_msec:f._et,page_location:f.dl,page_referrer:f.dr})),
    engagementEvents:fields.filter(f=>f.en==='user_engagement').map(f=>({event:f.en,page_location:f.dl,page_referrer:f.dr,engagement_time_msec:f._et})),
    sessionFields:fields.filter(f=>f._ss==='1').map(f=>({event:f.en,session_start:f._ss,page_location:f.dl,page_referrer:f.dr,hasSessionId:!!f.sid,sessionNumber:f.sct})),
    pageReferrers:[...new Set(fields.map(f=>f.dr).filter(Boolean))],
    defaultContextSafe:fields.every(f=>(!f.dl||f.dl==='https://hometechmayo.ie/quote.html')&&(!f.dr||f.dr==='https://www.google.ie/')),
    unsafeParameterKeys:[...new Set(leaking)],
    knownPersonalHashKeys:[...new Set(fields.flatMap(f=>Object.entries(f).filter(([,v])=>personalHashes.some(hash=>decode(v).toLowerCase().includes(hash))).map(([key])=>key)))],
    exposedSyntheticMarkers:[...new Set(fields.flatMap(f=>Object.values(f)).flatMap(v=>markers.filter(m=>decode(v).includes(m))))],
    unsafeHeaderKeys:[...new Set([...hits,...other].flatMap(h=>Object.entries(h.headers).filter(([,v])=>markers.some(m=>decode(v).includes(m))).map(([k])=>k)))],
    tagHasReferer:tagHeaders.some(h=>Object.hasOwn(h,'referer')),blockedExternalRequests:other.map(h=>new URL(h.url).hostname+new URL(h.url).pathname)};
   if(!override) {assert.equal(hits.length,0);assert.equal(tagHeaders.length,0);}
   else {assert.equal(tagHeaders.length,1);assert(fields.some(f=>f.en==='page_view'));
    // Report unsafe automatic context instead of throwing away the evidence.
    assert.equal(report.tagHasReferer,false);
   }
   // Restore the real page solely to exercise withdrawal; report above covers
   // the original document, including its real pagehide/engagement transport.
   const beforeReturn=hits.length,tagLoadsBeforeReturn=tagHeaders.length;
   await cdp.send('Emulation.setFocusEmulationEnabled',{enabled:true});
   await p.goto(returnUrl,{waitUntil:'networkidle'});await p.bringToFront();
   // The real library batches repeat-visit events; allow its transport timer.
   await p.waitForTimeout(override?7000:500);
   const returnFields=hits.slice(beforeReturn).flatMap(rows);
   report.returnVisit={tagLoads:tagHeaders.length-tagLoadsBeforeReturn,pageViews:returnFields.filter(f=>f.en==='page_view').length,sessionStartFlags:returnFields.filter(f=>f._ss==='1').length,bannerVisible:await p.locator('.cookie-banner').isVisible(),
    unsafeKeys:[...new Set(returnFields.flatMap(f=>Object.entries(f).filter(([,v])=>markers.some(m=>decode(v).includes(m))).map(([k])=>k)))],
    pageLocations:[...new Set(returnFields.map(f=>f.dl).filter(Boolean))],pageReferrers:[...new Set(returnFields.map(f=>f.dr).filter(Boolean))]};
   fs.writeFileSync('work/ga4-audit-progress.json',JSON.stringify([...results,report],null,2));
   assert.equal(report.returnVisit.pageViews,override?1:0);assert.equal(report.returnVisit.bannerVisible,false);
   await p.locator('footer [data-cookie-settings]').click();
   await p.locator('#cookie-analytics-toggle').uncheck();await p.locator('#cookie-save').click();
   await p.waitForTimeout(300);const count=hits.length;
   await p.evaluate(()=>window.gtag?.('event','phone_click',{placement:'footer'}));await p.waitForTimeout(1200);
   report.requestsAfterWithdrawal=hits.length-count;report.remainingAnalyticsCookies=(await ctx.cookies()).filter(c=>c.name.startsWith('htss_ga')).map(c=>c.name);
   assert.equal(report.requestsAfterWithdrawal,0);assert.equal(report.remainingAnalyticsCookies.length,0);
   const deniedCount=hits.length,deniedTagLoads=tagHeaders.length;
   await p.reload({waitUntil:'networkidle'});await p.waitForTimeout(700);
   report.returnAfterWithdrawal={requests:hits.length-deniedCount,tagLoads:tagHeaders.length-deniedTagLoads};
   assert.deepEqual(report.returnAfterWithdrawal,{requests:0,tagLoads:0});
   results.push(report);await ctx.close();
  }
 } finally {await browser.close();}
 const output={checkedAt:new Date().toISOString(),tagSha256:crypto.createHash('sha256').update(tag).digest('hex'),publicTagSettings:tagSettings,allThirdPartyTransportIntercepted:true,
  configurationSafe:results.filter(r=>r.gateMode==='actual release source').every(r=>r.defaultContextSafe&&!r.unsafeParameterKeys.length&&!r.returnVisit.unsafeKeys.length&&!r.unsafeHeaderKeys.length&&!r.knownPersonalHashKeys.length&&r.events.filter(e=>e==='page_view').length===1&&!r.events.some(e=>['form_start','form_submit','click','scroll','view_search_results','file_download'].includes(e))),results};
 fs.writeFileSync('work/ga4-network-audit.json',JSON.stringify(output,null,2));
 console.log(JSON.stringify(output,null,2));
 if(!output.configurationSafe) process.exitCode=2; // Expected blocker, not a safe release.
})().catch(e=>{console.error(e);process.exitCode=1;});
