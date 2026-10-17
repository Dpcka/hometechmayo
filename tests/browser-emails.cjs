// Local email layout checks; never sends mail or loads production assets.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE);
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const root=process.cwd(),out=process.argv[2] || path.join(root,'work/email-previews');
 const browser=await chromium.launch({channel:'msedge',headless:true});
 for(const name of ['customer','business']) for(const [size,width] of [['desktop',720],['mobile',390],['narrow',360]]) {
  const page=await browser.newPage({viewport:{width,height:960},deviceScaleFactor:1});
  const html=fs.readFileSync(path.join(out,`${name}.html`),'utf8');
  await page.route('**/*',route=>route.request().url()==='https://hometechmayo.ie/assets/logo/logo-email.png' ? route.fulfill({path:path.join(root,'assets/logo/logo-email.png'),contentType:'image/png'}) : route.abort());
  await page.setContent(html,{waitUntil:'networkidle'});
  assert.equal(await page.locator('img').evaluate(img=>img.complete&&img.naturalWidth===720),true);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${name} overflow at ${width}`);
  assert.match(await page.locator('body').innerText(),/€170\.00/);
  await page.screenshot({path:path.join(out,`${name}-${size}.png`),fullPage:true});
  if(size==='mobile') {
   const hostile=html.replace('Alex Example', 'Example'.repeat(45)).replace('Please assemble the furniture in the guest room.', 'Customer description '.repeat(120));
   await page.setContent(hostile,{waitUntil:'networkidle'});
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${name} long text overflow`);
   const blocked=await browser.newPage({viewport:{width,height:960}});
   await blocked.route('**/*',r=>r.abort());
   await blocked.setContent(html,{waitUntil:'networkidle'});
   assert.match(await blocked.locator('body').innerText(),/Home Tech Solutions & Services/);
   assert.equal(await blocked.locator('img').evaluate(img=>img.naturalWidth),0,'blocked image must genuinely fail to load');
   assert.ok(await blocked.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'blocked image fallback must fit');
   await blocked.screenshot({path:path.join(out,`${name}-images-blocked.png`),fullPage:true});
   await blocked.close();
  }
  await page.close();
 }
 await browser.close();console.log('PASS: exact Brevo HTML at desktop/mobile; local SVG-derived logo; €170 sample; no overflow with long names/descriptions; image-blocked fallback.');
})().catch(e=>{console.error(e);process.exit(1)});
