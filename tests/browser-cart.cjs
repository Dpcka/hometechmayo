// Regression checks for the compact read-only cart. No real quote is sent.
const assert = require('node:assert/strict');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async()=>{
 const browser = await chromium.launch({channel:'msedge',headless:true});
 const page = await browser.newPage({viewport:{width:1280,height:900}});
 const errors=[]; page.on('pageerror', e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8788/quote.html?category=furniture',{waitUntil:'networkidle'});
 const add=async(name,query,quantity)=>{
  await page.locator('#service-search').fill(query);
  await page.getByRole('button',{name:`Add ${name}`,exact:true}).click();
  if(quantity) await page.locator(`[data-quantity="${quantity[0]}"]`).fill(String(quantity[1]));
 };
 await add('Small furniture item','Small furniture',['furniture-small',2]);
 await add('Chest of drawers','Chest of drawers',['furniture-drawers',3]);
 await add('Smart speaker setup','Smart speaker');
 await add('Multiple-device / automation setup','Multiple-device');
 await add('Core drilling / new ventilation opening','Core drilling');
 const cart=page.locator('#order-summary');
 assert.equal(await cart.locator('.cart-table tbody tr').count(),5);
 const small=cart.locator('[data-cart-service="furniture-small"]');
 assert.equal(await small.locator('.cart-quantity').innerText(),'2');
 assert.equal(await small.locator('.cart-unit-price').innerText(),'€50.00');
 assert.equal(await small.locator('.cart-line-price').innerText(),'€100.00');
 assert.equal(await cart.locator('.estimate-amount').innerText(),'€332.50+');
 assert.match(await cart.innerText(),/travel pending/);
 assert.equal(await cart.locator('[data-cart-service="vent-core"] .cart-line-price').innerText(),'Quote');
 assert.equal(await cart.locator('input,select,textarea,fieldset').count(),0);
 assert.equal(await page.locator('.selection-workspace #selected-services').count(),1);
 const editorBox=await page.locator('#selected-services').boundingBox(), cartBox=await cart.boundingBox();
 assert.ok(editorBox.x+editorBox.width<cartBox.x,'editors must be in the left column');
 for(const id of ['furniture-small','furniture-drawers','smart-speaker']) {
  const box=await cart.locator(`[data-cart-service="${id}"]`).boundingBox();
  assert.ok(box.height>=45 && box.height<=55,`${id} row height ${box.height}`);
 }
 await page.locator('[data-quantity="furniture-small"]').fill('3');
 assert.equal(await small.locator('.cart-line-price').innerText(),'€150.00');
 await page.locator('[data-quantity="furniture-small"]').fill('2');
 const options=page.locator('#selected-furniture-small .selection-options');
 await options.locator('summary').click();
 await options.getByRole('combobox',{name:'Work required',exact:true}).selectOption('installation');
 assert.equal(await small.locator('.cart-line-price').innerText(),'Quote');
 await options.getByRole('combobox',{name:'Work required',exact:true}).selectOption('assembly');
 // Sticky position remains below both normal and scrolled header sizes.
 await page.evaluate(()=>scrollTo({top:700,behavior:'instant'}));
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 const sticky=await cart.boundingBox();
 const header=await page.locator('header').boundingBox();
 assert.ok(sticky.y>=header.y+header.height+8,'cart overlaps fixed navigation');
 assert.ok(sticky.height<=900-sticky.y,'cart must fit the viewport');
 await page.screenshot({path:'work/cart-desktop.png'});
 await page.getByRole('button',{name:'Continue to estimate',exact:true}).click();
 await page.locator('select[name=area]').selectOption('Westport');
 const estimate=page.locator('#estimate-summary');
 assert.equal(await estimate.locator('.estimate-amount').innerText(),'€342.50+');
 assert.equal(await estimate.locator('.cart-table tbody tr').count(),5);
 await page.locator('select[name=area]').selectOption('Other');
 assert.equal(await estimate.locator('.estimate-amount').innerText(),'€332.50+');
 assert.match(await estimate.innerText(),/Custom Quote — excluded/);
 await page.locator('select[name=area]').selectOption('Westport');
 for(const width of [360,390,768,1280]) {
  await page.setViewportSize({width,height:900});
  const disclosure=estimate.locator('.cart-disclosure');
  if(width<=900) {
   // Within the same mobile breakpoint, a customer's expansion is retained.
   if (await disclosure.getAttribute('open') !== null) await estimate.locator('summary').click();
   await estimate.locator('.cart-disclosure:not([open])').waitFor({state:'attached'});
   const closedBox=await estimate.boundingBox();assert.ok(closedBox.height<=90,`collapsed height ${closedBox.height} at ${width}`);
   await estimate.locator('summary').focus();await page.keyboard.press('Enter');
   assert.equal(await disclosure.getAttribute('open'),'');
   await page.locator('[data-materials="furniture-small"]').selectOption('yes');
   assert.equal(await disclosure.getAttribute('open'),'','refresh must preserve expansion');
  } else await estimate.locator('.cart-disclosure[open]').waitFor({state:'attached'});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`horizontal overflow at ${width}`);
  for(const cell of await estimate.locator('.cart-table tbody th').all()) assert.ok(await cell.evaluate(node=>node.scrollHeight<=node.clientHeight+1),'long name clipped');
  const box=await estimate.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width+1);
  const primary=page.locator('.wizard-step[data-step="2"] .wizard-actions .btn-primary');
  await primary.scrollIntoViewIfNeeded();
  assert.ok(await primary.evaluate(button=>{const r=button.getBoundingClientRect();return [0.1,0.5,0.9].every(f=>button.contains(document.elementFromPoint(r.x+r.width*f,r.y+r.height/2)));}),`continue action obscured at ${width}`);
  if(width===390) {await estimate.scrollIntoViewIfNeeded();await page.screenshot({path:'work/cart-mobile-expanded.png'});await estimate.locator('summary').click();await page.screenshot({path:'work/cart-mobile-collapsed.png'});}
 }
 await page.getByRole('button',{name:'Continue to quote',exact:true}).click();
 assert.equal(await page.locator('#final-summary .cart-table tbody tr').count(),5);
 assert.equal(await page.locator('#final-summary .estimate-amount').innerText(),'€342.50+');
 await page.locator('.wizard-progress [data-go="1"]').click();
 await page.getByRole('button',{name:'Remove Chest of drawers',exact:true}).click();
 assert.equal(await cart.locator('.cart-table tbody tr').count(),4);
 assert.equal(await cart.locator('[data-cart-service="furniture-drawers"]').count(),0);
 assert.deepEqual(errors,[]);
 console.log('PASS: compact rows 45–55px; quantity/unit/line prices; Custom Quote; options/editors left; sticky header clearance; expandable cart at 360/390/768; desktop 1280; expansion preserved; all three steps and removal.');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
