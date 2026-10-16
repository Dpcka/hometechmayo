// Offline measurement audit of a freshly downloaded official Google tag.
// All third-party browser traffic is blocked or fulfilled locally. Never sends
// test hits to Google. A fixture-only gate override diagnoses unsafe settings.
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
     if(override&&u.pathname==='/js/analytics-policy.mjs') return r.fulfill({contentType:'text/javascript',body:policy.replace('GOOGLE_CONFIGURATION_VERIFIED = false','GOOGLE_CONFIGURATION_VERIFIED = true')});
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
   await p.goto(origin+'/quote.html?category=wifi&utm_source=google&utm_medium=cpc&utm_campaign=mayo&email=private%40example.com&phone=0831234567&gclid=SYNTHETIC_PRIVATE_CLICK&q=SYNTHETIC_PRIVATE_SEARCH#SYNTHETIC_PRIVATE_HASH',
    {referer:'https://www.google.ie/search?q=SYNTHETIC_PRIVATE_REF',waitUntil:'networkidle'});
   assert.equal(hits.length,0);assert.equal(tagHeaders.length,0);
   await p.locator('[data-choice=accept]').click();await p.waitForTimeout(1500);
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
   });
   await p.evaluate(()=>{
    document.dispatchEvent(new CustomEvent('htss:quote-submitted'));
    history.replaceState(history.state,'','?category=wifi&email=private%40example.com&case=SYNTHETIC_PRIVATE_HISTORY');
    window.scrollTo(0,document.body.scrollHeight);
   });
   await p.waitForTimeout(2200);
   const fields=hits.flatMap(rows);
   const leaking=fields.flatMap(f=>Object.entries(f).filter(([,v])=>markers.some(m=>decode(v).includes(m))).map(([key])=>key));
   const report={width,fixtureGateOverride:override,tagLoads:tagHeaders.length,requests:hits.length,
    events:fields.map(f=>f.en).filter(Boolean),pageLocations:[...new Set(fields.map(f=>f.dl).filter(Boolean))],
    pageReferrers:[...new Set(fields.map(f=>f.dr).filter(Boolean))],
    unsafeParameterKeys:[...new Set(leaking)],
    exposedSyntheticMarkers:[...new Set(fields.flatMap(f=>Object.values(f)).flatMap(v=>markers.filter(m=>decode(v).includes(m))))],
    unsafeHeaderKeys:[...new Set([...hits,...other].flatMap(h=>Object.entries(h.headers).filter(([,v])=>markers.some(m=>decode(v).includes(m))).map(([k])=>k)))],
    tagHasReferer:tagHeaders.some(h=>Object.hasOwn(h,'referer')),blockedExternalRequests:other.map(h=>new URL(h.url).hostname+new URL(h.url).pathname)};
   if(!override) {assert.equal(hits.length,0);assert.equal(tagHeaders.length,0);}
   else {assert.equal(tagHeaders.length,1);assert(fields.some(f=>f.en==='page_view'));
    assert(fields.every(f=>!f.dl||f.dl==='https://hometechmayo.ie/quote.html'));
    assert(fields.every(f=>!f.dr||f.dr==='https://www.google.ie/'));
    assert.equal(report.tagHasReferer,false);
   }
   await p.locator('footer [data-cookie-settings]').click();
   await p.locator('#cookie-analytics-toggle').uncheck();await p.locator('#cookie-save').click();
   await p.waitForTimeout(300);const count=hits.length;
   await p.evaluate(()=>window.gtag?.('event','phone_click',{placement:'footer'}));await p.waitForTimeout(1200);
   report.requestsAfterWithdrawal=hits.length-count;report.remainingAnalyticsCookies=(await ctx.cookies()).filter(c=>c.name.startsWith('htss_ga')).map(c=>c.name);
   assert.equal(report.requestsAfterWithdrawal,0);assert.equal(report.remainingAnalyticsCookies.length,0);
   results.push(report);await ctx.close();
  }
 } finally {await browser.close();}
 const output={checkedAt:new Date().toISOString(),tagSha256:crypto.createHash('sha256').update(tag).digest('hex'),publicTagSettings:tagSettings,allThirdPartyTransportIntercepted:true,
  configurationSafe:results.filter(r=>r.fixtureGateOverride).every(r=>!r.unsafeParameterKeys.length&&!r.unsafeHeaderKeys.length&&!r.events.some(e=>['form_start','form_submit','click','scroll','view_search_results','file_download'].includes(e))),results};
 fs.writeFileSync('work/ga4-network-audit.json',JSON.stringify(output,null,2));
 console.log(JSON.stringify(output,null,2));
 if(!output.configurationSafe) process.exitCode=2; // Expected blocker, not a safe release.
})().catch(e=>{console.error(e);process.exitCode=1;});
