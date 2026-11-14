// Read-only calculator interaction: no customer data, submissions or analytics.
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const origin=process.env.TEST_ORIGIN||'http://127.0.0.1:8788';
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const errors=[],posts=[],results=[];
 try{
  for(const width of [360,390,768,1280]){
   const context=await browser.newContext({viewport:{width,height:900}});
   await context.addInitScript(()=>localStorage.setItem('htss_cookie_consent',JSON.stringify({version:1,analytics:false,savedAt:Date.now()})));
   await context.route('**/*',route=>{
    const req=route.request();if(req.method()!=='GET'){posts.push(req.method());return route.abort();}
    if(new URL(req.url()).origin!==origin)return route.abort();return route.continue();
   });
   const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
   await page.goto(origin+'/quote?category=computer',{waitUntil:'networkidle'});
   const cart=()=>page.locator('.wizard-step:not([hidden]) .calc-summary');
   const total=()=>cart().locator('.estimate-amount');
   const expand=async()=>{if(await cart().locator('.cart-disclosure').getAttribute('open')===null)await cart().locator('summary').click();};
   await page.getByRole('button',{name:'Add Computer Diagnostics',exact:true}).click();await expand();
   await assert.equal(await total().innerText(),'€50.00+');
   await cart().locator('[data-cart-service="pc-diagnostics"] .cart-service-edit').click();
   await page.locator('[data-service-option="location"]').selectOption('dropoff');
   await page.getByRole('button',{name:'Done',exact:true}).click();
   assert.equal(await total().innerText(),'€40.00');
   assert.match(await cart().innerText(),/No waiver is deducted automatically/);
   await page.getByRole('button',{name:'Continue to estimate',exact:true}).click();
   await page.locator('select[name="area"]').selectOption('Westport');await expand();
   assert.equal(await total().innerText(),'€40.00');assert.match(await cart().innerText(),/Travel · customer drop-off/);
   await cart().locator('[data-cart-service="pc-diagnostics"] .cart-service-edit').click();
   await page.locator('[data-service-option="location"]').selectOption('onsite');
   await page.getByRole('button',{name:'Done',exact:true}).click();
   assert.equal(await total().innerText(),'€60.00');
   await page.locator('.wizard-progress [data-go="1"]').click();
   await page.getByRole('button',{name:'Add RAM Replacement — labour',exact:true}).click();await expand();
   assert.equal(await total().innerText(),'€90.00+');
   await cart().locator('[data-quantity="pc-diagnostics"]').fill('0');
   assert.equal(await total().innerText(),'€60.00+');
   await page.getByRole('button',{name:'Continue to estimate',exact:true}).click();
   await page.locator('[data-materials="pc-ram"]').selectOption('yes');await expand();
   assert.equal(await total().innerText(),'€60.00');
   await page.getByRole('button',{name:'Continue to quote',exact:true}).click();await expand();
   assert.equal(await total().innerText(),'€60.00');
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   results.push({width,passed:true});await context.close();
  }
  assert.deepEqual(errors,[]);assert.deepEqual(posts,[]);
  console.log(JSON.stringify({origin,results,errors,submittedRequests:posts.length}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
