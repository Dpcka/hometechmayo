// Local fixtures only: block external services, never submit real requests.
const assert=require('node:assert/strict'),fs=require('node:fs/promises');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const slug='large-mirror-installation-staircase-castlebar';
const origin=process.env.PROJECT_TEST_URL||'http://127.0.0.1:8788';
(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try {
    await fs.mkdir('work/mirror-browser',{recursive:true});
    const images=JSON.parse(await fs.readFile(`assets/projects/${slug}/images.json`,'utf8'));
    for(const width of [360,390,768,1280]){
      const context=await browser.newContext({viewport:{width,height:915},hasTouch:width<1280,reducedMotion:'reduce'});
      await context.addInitScript(()=>{localStorage.setItem('whatsappClosed','true');localStorage.setItem('htss_cookie_consent',JSON.stringify({version:1,analytics:false,savedAt:Date.now()}));});
      await context.route('**/*',route=>{
        const u=new URL(route.request().url());if(u.origin!==origin)return route.abort();
        if(u.pathname.startsWith('/api/'))return route.fulfill({json:{reviews:[],enabled:false}});
        return route.continue();
      });
      const page=await context.newPage(),errors=[],failed=[];
      page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.url().startsWith(origin)&&r.status()>=400)failed.push(r.url());});
      await page.goto(`${origin}/projects/${slug}`);
      await page.waitForFunction(()=>document.querySelector('.project-photo-open')?.hasAttribute('aria-keyshortcuts'));
      assert.equal(await page.locator('h1').count(),1);
      const photo=page.locator('.project-photo-open');await photo.scrollIntoViewIfNeeded();
      await page.evaluate(()=>scrollTo(0,0));
      await page.screenshot({path:`work/mirror-browser/project-${width}.png`,fullPage:true});
      await photo.focus();await page.keyboard.press('ArrowRight');
      assert.equal(await photo.getAttribute('href'),'/'+images[1].full);
      await page.keyboard.press('Enter');const viewer=page.locator('.project-viewer');await viewer.waitFor({state:'visible'});
      for(let n=1;n<=4;n++){
        const image=images[n%4];await viewer.locator('img').evaluate(img=>img.decode());
        assert.equal(await viewer.locator('img').getAttribute('src'),'/'+image.full);
        assert.equal(await viewer.locator('img').getAttribute('alt'),image.alt);
        await page.keyboard.press('ArrowRight');
      }
      await page.screenshot({path:`work/mirror-browser/viewer-${width}.png`});
      await page.keyboard.press('Escape');assert.equal(await viewer.isVisible(),false);
      assert.equal(await photo.evaluate(el=>el===document.activeElement),true);
      assert.equal(await page.locator('.project-photo-dot').count(),0);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      assert.equal(await page.locator('[href="/quote?category=handyman"]').count()>0,true);
      await page.goto(`${origin}/#project-${slug}`);
      const card=page.locator(`[data-project-id="${slug}"]`);await card.scrollIntoViewIfNeeded();
      assert.equal(await page.locator('.project-card').count(),5);
      assert.equal(await card.count(),1);assert.equal(await card.locator('time').innerText(),'21 November 2026');
      assert.match(await card.locator('.project-testimonial').innerText(),/Customer, Castlebar.*Customer feedback/s);
      assert.equal(await card.locator('.project-photo img').first().evaluate(el=>getComputedStyle(el).objectFit),'contain');
      await page.screenshot({path:`work/mirror-browser/card-${width}.png`});
      assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
      console.log(`PASS ${width}px: detail/card, four images, nested routes, keyboard, lightbox, no overflow or script errors`);
      await context.close();
    }
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
