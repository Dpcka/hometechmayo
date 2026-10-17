// Browser regressions for cart-only service management. All requests stay local;
// no production quote, customer data or live Analytics traffic is used.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async () => {
 const {CATALOGUE, calculate, money} = await import('../js/pricing-catalogue.mjs');
 const browser = await chromium.launch({channel:'msedge',headless:true});
 const page = await browser.newPage({viewport:{width:1280,height:900}});
 const errors=[];page.on('pageerror', e=>errors.push(e.message));
 await page.route('https://www.googletagmanager.com/**',r=>r.abort());
 await page.route('https://www.google-analytics.com/**',r=>r.abort());
 const activeCart=()=>page.locator('.wizard-step:not([hidden]) .calc-summary');
 const row=id=>activeCart().locator(`[data-cart-service="${id}"]`);
 const dialog=page.locator('#service-editor');
 const done=()=>dialog.getByRole('button',{name:'Done',exact:true}).click();
 const add=async service=>{
  await page.locator('#service-search').fill(service.name);
  await page.getByRole('button',{name:`Add ${service.name}`,exact:true}).click();
 };
 await page.goto('http://127.0.0.1:8788/quote.html?category=furniture',{waitUntil:'networkidle'});
 assert.equal(await page.locator('#selected-services, #selected-panel').count(),0);
 // Every existing configurable service/note remains reachable from the cart.
 let servicesChecked=0;
 for (const service of CATALOGUE.filter(s=>Object.keys(s.options).length || s.note)) {
  await add(service);
  await row(service.id).locator('.cart-service-edit').click();
  assert.equal(await dialog.isVisible(),true);
  assert.equal(await dialog.locator('#service-editor-title').innerText(),service.name);
  const configured={};
  for (const [key,def] of Object.entries(service.options)) {
   const input=dialog.locator(`[data-service-option="${key}"]`);
   assert.equal(await input.count(),1,`${service.id}/${key} preserved`);
   if (def.number) {
    await input.fill('2');configured[key]=2;
    await input.fill('25');await done();
    assert.equal(await dialog.isVisible(),true,'invalid numeric option blocks Done');
    await input.fill('2');
   } else {
    configured[key]=def.choices[0].value;
    if (await input.isVisible()) {
     for (const choice of def.choices) await input.selectOption(choice.value);
     configured[key]=def.choices.at(-1).value;
    }
   }
  }
  if (service.note) assert.equal(await dialog.locator('#service-editor-note').innerText(),service.note);
  const estimate=calculate([{id:service.id,quantity:1,materials:'unsure',options:configured}],'Castlebar');
  assert.equal(await activeCart().locator('.estimate-amount').innerText(),`${money(estimate.total)}+`);
  await done();
  assert.equal(await row(service.id).locator('.cart-service-edit').evaluate(n=>n===document.activeElement),true);
  await row(service.id).locator('[data-quantity-direction="1"]').isEnabled().then(async enabled=>{
   if (enabled) await row(service.id).locator('[data-quantity-direction="1"]').click();
  });
  await row(service.id).locator('.cart-service-edit').click();
  for (const [key,value] of Object.entries(configured)) assert.equal(await dialog.locator(`[data-service-option="${key}"]`).inputValue(),String(value),`${service.id}/${key} retained after quantity change`);
  await page.keyboard.press('Escape');
  assert.equal(await dialog.isVisible(),false);
  await row(service.id).locator('input[data-quantity]').fill('0');
  servicesChecked++;
 }
 const small=CATALOGUE.find(s=>s.id==='furniture-small');
 fs.mkdirSync('work',{recursive:true});
 for (const width of [360,390,768,1280]) {
  await page.setViewportSize({width,height:900});
  await page.goto('http://127.0.0.1:8788/quote.html?category=furniture',{waitUntil:'networkidle'});
  // Normal card additions do not open an editor or create another selected list.
  await add(small);
  await page.getByRole('button',{name:`Add ${small.name}`,exact:true}).click({clickCount:2});
  assert.equal(await page.locator('[data-added="furniture-small"]').innerText(),'Added: 3');
  assert.equal(await page.locator('.service-browser [data-quantity-direction]').count(),0);
  assert.equal(await activeCart().locator('tbody tr').count(),1);
  if (width<=900) {
   assert.equal(await activeCart().locator('details').getAttribute('open'),null);
   const cartBox=await activeCart().boundingBox(), catalogueBox=await page.locator('.service-browser').boundingBox();
   assert.ok(cartBox.y<catalogueBox.y,'mobile cart appears before the catalogue');
   const heading=activeCart().locator('.cart-heading');
   await heading.scrollIntoViewIfNeeded();
   await activeCart().evaluate(node=>scrollTo(0,scrollY+node.getBoundingClientRect().top-parseFloat(getComputedStyle(node).top)+100));
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   const sticky=await activeCart().boundingBox(), header=await page.locator('header').boundingBox();
   assert.ok(sticky.y>=header.height+8 && sticky.y<=header.height+24,`mobile cart stays accessible below navigation at ${width}: ${sticky.y}, header ${header.height}`);
   await heading.focus();await page.keyboard.press('Enter');
  }
  assert.equal(await row(small.id).locator('input').inputValue(),'3');
  const edit=row(small.id).locator('.cart-service-edit');
  await edit.focus();await page.keyboard.press('Enter');
  assert.equal(await dialog.isVisible(),true);
  const bounds=await dialog.boundingBox();assert.ok(bounds.x>=0 && bounds.x+bounds.width<=width+1 && bounds.y>=0 && bounds.y+bounds.height<=901,`editor fits at ${width}`);
  for(let i=0;i<5;i++) {await page.keyboard.press('Tab');assert.equal(await dialog.evaluate(d=>d.contains(document.activeElement)),true,'modal contains keyboard focus');}
  await dialog.getByRole('combobox',{name:'Work required',exact:true}).selectOption('installation');
  assert.equal(await row(small.id).locator('.cart-line-price').innerText(),'Quote');
  if (width===390) await page.screenshot({path:'work/cart-options-mobile.png'});
  await page.keyboard.press('Escape');
  assert.equal(await edit.evaluate(n=>n===document.activeElement),true);
  await edit.click();
  assert.equal(await dialog.getByRole('combobox',{name:'Work required',exact:true}).inputValue(),'installation');
  await dialog.getByRole('combobox',{name:'Work required',exact:true}).selectOption('assembly');await done();
  assert.equal(await row(small.id).locator('.cart-line-price').innerText(),'€150.00');
  if (width<=900) await activeCart().locator('.cart-heading').click();
  await page.locator('[data-open-summary]').click();
  assert.equal(await activeCart().locator('details').getAttribute('open'),'');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`no horizontal overflow at ${width}`);
  await row(small.id).locator('[data-quantity-direction="-1"]').click();
  assert.equal(await row(small.id).locator('input').inputValue(),'2');
  await page.getByRole('button',{name:'Continue to estimate',exact:true}).click();
  await page.locator('select[name=area]').selectOption('Westport');
  await page.locator('[data-materials="furniture-small"]').selectOption('yes');
  if (width<=900) await activeCart().locator('.cart-heading').click();
  await row(small.id).locator('.cart-service-edit').click();
  assert.equal(await dialog.getByRole('combobox',{name:'Work required',exact:true}).inputValue(),'assembly');
  await done();
  await page.getByRole('button',{name:'Continue to quote',exact:true}).click();
  if (width<=900) await activeCart().locator('.cart-heading').click();
  await row(small.id).locator('.cart-service-edit').click();
  await dialog.getByRole('combobox',{name:'Work required',exact:true}).selectOption('both');await done();
  assert.equal(await row(small.id).locator('.cart-line-price').innerText(),'Quote');
  await page.locator('.wizard-progress [data-go="1"]').click();
  await row(small.id).locator('.cart-service-edit').click();
  assert.equal(await dialog.getByRole('combobox',{name:'Work required',exact:true}).inputValue(),'both');
  await dialog.getByRole('combobox',{name:'Work required',exact:true}).selectOption('assembly');await done();
  assert.equal(await row(small.id).locator('input').inputValue(),'2');
  if (width<=900) await activeCart().locator('.cart-heading').click();
  await add(CATALOGUE.find(s=>s.id==='furniture-drawers'));
  await add(CATALOGUE.find(s=>s.id==='tv-mount'));
  await page.locator('#service-search').fill('');
  await page.locator('.wizard-progress').scrollIntoViewIfNeeded();
  await page.mouse.click(5,200);
  if(width===390) {
   await page.screenshot({path:'work/cart-selection-mobile.png'});
   await activeCart().locator('.cart-heading').click();
   await page.screenshot({path:'work/cart-selection-mobile-expanded.png'});
  }
  if(width===1280) {
   await page.screenshot({path:'work/cart-selection-desktop.png'});
   await row('tv-mount').locator('.cart-service-edit').click();
   await page.screenshot({path:'work/cart-options-desktop.png'});await done();
  }
 }
 assert.deepEqual(errors,[]);
 console.log(`PASS: ${servicesChecked} existing option/detail editors; immediate pricing and preserved values; numeric option limits; no duplicate selected list; all-step editing; repeated Add/count feedback; modal keyboard focus/Done/Escape; mobile sticky summary, shortcut and no overflow at 360/390/768/1280.`);
 await browser.close();
})().catch(error=>{console.error(error);process.exit(1)});
