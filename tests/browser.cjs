// Optional browser regression check. Uses an externally supplied Playwright module
// and installed Edge; no browser package is added to the website dependencies.
const assert = require('node:assert/strict');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async () => {
 const browser = await chromium.launch({channel: 'msedge', headless: true});
 const page = await browser.newPage({viewport: {width: 390, height: 844}});
 const errors = []; page.on('pageerror', e => errors.push(e.message));
 await page.route('https://fonts.googleapis.com/**', r => r.abort());
 await page.goto('http://127.0.0.1:8788/pricing.html', {waitUntil: 'networkidle'});
 await page.locator('#quote-status').filter({hasText: 'not configured'}).waitFor();
 assert.equal(await page.locator('#service-categories details').count(), 17);
 await page.locator('#service-search').fill('Printer');
 await page.getByRole('button', {name: 'Add Printer / device setup', exact: true}).click();
 await page.locator('select[name=area]').selectOption('Castlebar');
 assert.match(await page.locator('#estimate-summary').innerText(), /€50.00/);
 assert.equal(await page.locator('#quote-submit').isDisabled(), true);
 await page.locator('select[name=area]').selectOption('Westport');
 assert.match(await page.locator('#estimate-summary').innerText(), /€60.00/);
 const quantity = page.getByLabel('Quantity', {exact: true});
 for (const [qty, discount] of [['5', '0%'], ['6', '5%'], ['11', '10%']]) {await quantity.fill(qty); assert.match(await page.locator('#estimate-summary').innerText(), new RegExp(discount));}
 await page.locator('#service-search').fill('Custom shelving');
 await page.getByRole('button', {name: 'Add Custom shelving / storage installation', exact: true}).click();
 assert.match(await page.locator('#estimate-summary').innerText(), /not included/);
 await page.locator('select[name=area]').selectOption('Other');
 assert.match(await page.locator('#estimate-summary').innerText(), /Custom Quote — not included/);
 // Native details and controls remain keyboard reachable.
 await page.locator('#service-search').fill('');
 const furniture = page.locator('#service-categories details').first().locator('summary');
 await furniture.focus(); await page.keyboard.press('Enter');
 assert.equal(await page.locator('#service-categories details').first().getAttribute('open'), '');
 for (const width of [360, 390, 768, 1280]) {
  await page.setViewportSize({width, height: 900});
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `horizontal overflow at ${width}`);
  for (const selector of ['#estimate-summary', '#selected-services', '#quote-customer']) {
   const box = await page.locator(selector).boundingBox(); assert.ok(box.x >= 0 && box.x + box.width <= width + 1, `${selector} outside viewport ${width}`);
  }
 }
 await page.setViewportSize({width: 390, height: 844});
 await page.locator('#quote-calculator').screenshot({path: 'work/calculator-mobile.png'});
 await page.setViewportSize({width: 1280, height: 900});
 await page.locator('#quote-calculator').screenshot({path: 'work/calculator-desktop.png'});
 await page.getByRole('button', {name: 'Remove Printer / device setup', exact: true}).click();
 assert.equal(await page.locator('#selected-services fieldset').count(), 1);
 // Explicitly mocked widget and API exercise browser states, not live delivery.
 await page.route('**/api/quote-config', r => r.fulfill({json: {enabled: true, siteKey: 'mock-public-key', version: '2026-10-16.1'}}));
 await page.route('https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit', r => r.fulfill({contentType: 'text/javascript', body: `window.turnstile={render:(el,c)=>{window.mockOptions=c; setTimeout(()=>c.callback('mock-token'),10);return 'widget';},reset:()=>{setTimeout(()=>window.mockOptions.callback('mock-token'),10);}};`}));
 let calls = 0, mode = 'failure', sent;
 await page.route('**/api/quote', r => {calls++; sent = r.request().postDataJSON(); return r.fulfill(mode === 'failure' ? {status: 503, json: {error: 'Test service unavailable'}} : {json: {ok: true, reference: 'HT-TEST-ONLY', acknowledgement: false}});});
 await page.reload({waitUntil: 'networkidle'});
 await page.locator('#service-search').fill('TV wall');
 await page.getByRole('button', {name: 'Add TV wall mounting', exact: true}).click();
 await page.getByLabel('Service area (required)').selectOption('Castlebar');
 await page.getByRole('combobox', {name: 'TV size', exact: true}).selectOption('medium');
 assert.match(await page.locator('#estimate-summary').innerText(), /€90.00/);
 await page.getByRole('combobox', {name: 'Installation package', exact: true}).selectOption('inclusive');
 assert.equal(await page.getByRole('combobox', {name: 'Cable management / trunking', exact: true}).count(), 0);
 await page.getByRole('combobox', {name: 'Installation package', exact: true}).selectOption('standard');
 assert.equal(await page.getByRole('combobox', {name: 'Cable management / trunking', exact: true}).count(), 1);
 await page.locator('input[name=name]').fill('Browser Test');
 await page.locator('input[name=phone]').fill('0831234567');
 await page.locator('#quote-submit').click(); assert.equal(calls, 0, 'privacy agreement is required');
 await page.locator('input[name=consent]').check();
 await page.locator('#quote-submit').click();
 await page.locator('#quote-status').filter({hasText: 'Test service unavailable'}).waitFor();
 assert.equal(calls, 1); const id = sent.requestId;
 mode = 'success';
 await page.locator('#quote-submit:not(:disabled)').waitFor();
 await page.locator('#quote-submit').click();
 await page.locator('#quote-status').filter({hasText: 'HT-TEST-ONLY'}).waitFor();
 assert.equal(calls, 2); assert.equal(sent.requestId, id); assert.equal(sent.items[0].options.size, 'medium');
 assert.equal(sent.consent, true); assert.equal(await page.locator('#quote-submit').isDisabled(), true);
 assert.deepEqual(errors, []);
 console.log('PASS: mobile/tablet/desktop (360/390/768/1280), keyboard, search, quantity tiers, custom costs, removal, disabled configuration, privacy validation, failure/retry/success UI. Email responses were mocked.');
 await browser.close();
})().catch(e => {console.error(e);process.exit(1);});
