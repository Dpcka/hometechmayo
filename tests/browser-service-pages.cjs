// Local-only service landing-page review. No live submissions, emails or GA hits.
const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const origin='http://127.0.0.1:8788',output='work/service-landing-review';
(async()=>{
 const {SERVICE_PAGES}=await import('../data/service-pages.mjs');
 fs.mkdirSync(output,{recursive:true});
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const rows=[],errors=[],failures=[],external=[],posts=[];
 try {
  for(const width of [360,390,768,1280]){
   const context=await browser.newContext({viewport:{width,height:900},permissions:['clipboard-read','clipboard-write'],hasTouch:width<=390,isMobile:width<=390});
   await context.addInitScript(()=>localStorage.setItem('htss_cookie_consent',JSON.stringify({version:1,analytics:false,savedAt:Date.now()})));
   await context.route('**/*',route=>{
    const request=route.request(),url=new URL(request.url());
    if(request.method()==='POST'){posts.push(url.pathname);return route.abort();}
    if(url.origin!==origin){external.push(url.hostname);return route.abort();}
    if(url.pathname==='/api/reviews')return route.fulfill({json:{reviews:[]}});
    return route.continue();
   });
   const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
   page.on('response',r=>{if(r.url().startsWith(origin)&&r.status()>=400&&!r.url().includes('/api/quote-config'))failures.push({path:new URL(r.url()).pathname,status:r.status()});});
   for(const service of SERVICE_PAGES){
    const path='/services/'+service.slug,response=await page.goto(origin+path,{waitUntil:'networkidle'});
    assert.equal(response.status(),200,path);assert.equal(new URL(page.url()).pathname,path);
    assert.equal(await page.locator('h1').innerText(),service.h1);
    for(const selector of ['.landing-breadcrumb a','.landing-actions .btn-secondary'])assert.equal(await page.locator(selector).first().evaluate(n=>getComputedStyle(n).color==='rgb(255, 255, 255)'),false,'light background must not have white link text');
    assert.equal(await page.locator('link[rel=canonical]').getAttribute('href'),'https://hometechmayo.ie'+path);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`overflow ${path} ${width}`);
    const faq=page.locator('.landing-faq details').first();await faq.locator('summary').focus();await page.keyboard.press('Enter');assert.equal(await faq.getAttribute('open'),'');await page.keyboard.press('Enter');assert.equal(await faq.getAttribute('open'),null);
    for(const image of await page.locator('main img').all()){await image.scrollIntoViewIfNeeded();await image.evaluate(n=>n.decode());assert.ok(await image.evaluate(n=>n.naturalWidth>0));}
    const menu=page.locator('.menu-toggle');
    if(await menu.isVisible()){await page.evaluate(()=>scrollTo(0,0));await menu.click();assert.equal(await menu.getAttribute('aria-expanded'),'true');await page.keyboard.press('Escape');assert.equal(await menu.getAttribute('aria-expanded'),'false');}
    const copy=page.locator('[data-copy-contact=email]');await copy.click();await page.waitForFunction(()=>document.querySelector('#contact-copy-status').textContent.includes('Email copied'));assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),'info@hometechmayo.ie');
    assert.ok(await page.locator('a[href="tel:+353833498496"]').count());assert.ok(await page.locator('a[href="https://wa.me/353833498496"]').count());
    await page.evaluate(()=>{document.documentElement.style.scrollBehavior='auto';document.activeElement?.blur();scrollTo(0,0);});await page.waitForTimeout(100);
    if([390,1280].includes(width)){await page.screenshot({path:`${output}/${service.slug}-${width}.png`});await page.screenshot({path:`${output}/${service.slug}-${width}-full.png`,fullPage:true});}
    await page.locator('.landing-actions a[href^="/quote"]').first().click();
    await page.waitForFunction(category=>document.querySelector('#service-category')?.value===category,service.category);
    assert.equal(new URL(page.url()).searchParams.get('category'),service.category);
    const add=page.locator('#service-results button[data-add]').first();await add.click();assert.equal(await page.locator('#order-summary .cart-table tbody tr').count(),1);
    await page.goBack();assert.equal(new URL(page.url()).pathname,path);
    rows.push({width,path,passed:true});
   }
   await context.close();
  }
  const nojs=await browser.newContext({javaScriptEnabled:false});await nojs.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());const page=await nojs.newPage();
  for(const service of SERVICE_PAGES){await page.goto(origin+'/services/'+service.slug);assert.equal(await page.locator('h1').innerText(),service.h1);assert.ok(await page.locator('.landing-price-list dt').count());await page.locator('.landing-faq summary').first().click();assert.equal(await page.locator('.landing-faq details').first().getAttribute('open'),'');}
  await nojs.close();
  assert.deepEqual(errors,[]);assert.deepEqual(failures,[]);assert.deepEqual(posts,[]);assert.equal(external.some(h=>/google-analytics|googletagmanager/.test(h)),false);
  const result={passed:true,layoutChecks:rows.length,rows,noJavaScriptPages:5,pageErrors:errors,failedLocalResources:failures,submittedRequests:posts.length,analyticsLoads:0};fs.writeFileSync(output+'/results.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
