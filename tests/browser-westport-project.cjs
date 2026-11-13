const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
(async () => {
  const images = JSON.parse(await fs.readFile("assets/projects/westport-furniture-assembly/images.json", "utf8"));
  const base = process.env.PROJECT_TEST_URL || "http://127.0.0.1:8788";
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    await fs.mkdir("work/westport-browser", { recursive: true });
    for (const width of [360, 390, 768, 1280]) {
      const context = await browser.newContext({ viewport: { width, height: 915 }, hasTouch: width < 1280, reducedMotion: "reduce" });
      await context.addInitScript(() => localStorage.setItem("whatsappClosed", "true"));
      await context.route("**/*", route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
      const page = await context.newPage(), errors = [], requests = [];
      page.on("pageerror", e => errors.push(e.message));
      page.on("request", r => requests.push(r.url()));
      await page.goto(base + "/#project-westport-furniture-assembly");
      const card = page.locator('[data-project-id="westport-furniture-assembly"]');
      await card.scrollIntoViewIfNeeded();
      await page.waitForFunction(() => document.querySelector('#project-westport-furniture-assembly .project-photo-open').hasAttribute("aria-keyshortcuts"));
      assert.equal(await page.locator(".project-card").count(), 4);
      assert.equal(await card.count(), 1);
      assert.equal(await card.locator("time").innerText(), "November 2026");
      assert.match(await card.locator(".project-testimonial").innerText(), /Finbar, Westport.*Bark review/s);
      assert.equal(await card.locator(".project-photo-dot").count(), 0);
      const photo = card.locator(".project-photo-open");
      assert.match(await photo.getAttribute("href"), /living-room-overview/);
      await card.locator(".project-work-details summary").click();
      assert.match(await card.locator(".project-work-details").innerText(), /14 furniture items from JYSK/);
      assert.match(await card.locator(".project-work-details").innerText(), /completed over two days/);
      await card.locator(".project-work-details summary").click();
      await photo.focus(); await page.keyboard.press("Enter");
      const viewer = page.locator(".project-viewer");
      await viewer.waitFor({ state: "visible" });
      for (let i = 0; i < images.length; i++) {
        await viewer.locator("img").evaluate(n => n.decode());
        assert.equal(await viewer.locator("img").getAttribute("src"), images[i].full);
        assert.equal(await viewer.locator("img").getAttribute("alt"), images[i].alt);
        assert.match(await viewer.locator(".project-viewer-caption").innerText(), new RegExp(`^${i+1} / 11`));
        if (i < images.length - 1) await page.keyboard.press("ArrowRight");
      }
      await page.keyboard.press("ArrowRight");
      assert.equal(await viewer.locator("img").getAttribute("src"), images[0].full);
      await page.screenshot({ path: `work/westport-browser/viewer-${width}.png` });
      await page.keyboard.press("Escape");
      assert.equal(await viewer.isVisible(), false);
      assert.equal(await photo.evaluate(n => n === document.activeElement), true);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.equal(requests.some(u => u.includes("/api/reviews?") && u.includes("project=westport-furniture-assembly")), false);
      assert.deepEqual(errors, []);
      await card.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `work/westport-browser/card-${width}.png` });
      console.log(`PASS ${width}px: one Westport entry, all 11 images in order, details, Bark attribution, keyboard/viewer and layout`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
