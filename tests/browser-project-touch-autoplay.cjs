// Local browser checks only. No production requests or submissions.
const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    for (const width of [360, 390, 768, 1280]) {
      const touch = width < 1280;
      const context = await browser.newContext({
        viewport: { width, height: 915 }, hasTouch: touch,
        isMobile: width <= 390, reducedMotion: "no-preference",
      });
      await context.addInitScript(() => localStorage.setItem("whatsappClosed", "true"));
      const base = process.env.PROJECT_TEST_URL || "http://127.0.0.1:8788";
      await context.route("**/*", route =>
        new URL(route.request().url()).origin === base ? route.continue() : route.abort());
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.clock.install();
      await page.goto(base);
      const card = page.locator('[data-project-id="wayfair-console-table"]');
      const photo = card.locator(".project-photo-open");
      const position = async () => Number((await photo.getAttribute("aria-label")).match(/photo (\d+) of/)[1]) - 1;
      await page.waitForFunction(() => document.querySelector('[data-project-id="wayfair-console-table"] .project-photo-open').hasAttribute("aria-keyshortcuts"));
      assert.equal(await page.locator(".project-photo-dots,.project-photo-dot").count(), 0);
      await card.scrollIntoViewIfNeeded();
      await page.waitForTimeout(150);
      await page.clock.runFor(6900);
      assert.equal(await position(), 1, "autoplay starts without interaction");
      async function swipeLeft() {
        const box = await photo.boundingBox();
        const x = box.x + box.width * 0.75, y = box.y + box.height * 0.4;
        const cdp = await context.newCDPSession(page);
        await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
        for (let i = 1; i <= 5; i++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x - 100 * i / 5, y }] });
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        await cdp.detach();
      }
      if (touch) await swipeLeft();
      else {
        await photo.focus(); await page.keyboard.press("ArrowRight");
        await page.locator(".hero-buttons a").first().evaluate(n => n.focus({ preventScroll: true }));
        await page.mouse.move(2, 2);
      }
      assert.equal(await position(), 2);
      await page.waitForTimeout(50);
      await page.clock.runFor(4500);
      assert.equal(await position(), 2, "manual selection receives a full delay");
      await page.clock.runFor(2400);
      assert.equal(await position(), 3, "autoplay resumes after manual interaction");

      // Genuine keyboard focus still suspends automatic changes.
      await photo.focus();
      await page.keyboard.press("ArrowLeft");
      assert.equal(await position(), 2);
      assert.equal(await photo.evaluate(n => n === document.activeElement && n.matches(":focus-visible")), true);
      const focused = await position();
      await page.clock.runFor(8000);
      assert.equal(await position(), focused, "keyboard focus pauses autoplay");
      await page.keyboard.press("ArrowRight");
      await page.keyboard.press("ArrowRight");
      assert.equal(await position(), 0, "keyboard navigation wraps");
      await page.clock.runFor(8000);
      assert.equal(await position(), 0);
      await page.locator(".hero-buttons a").first().evaluate(n => n.focus({ preventScroll: true }));
      await page.waitForTimeout(30);
      await page.clock.runFor(6900);
      assert.equal(await position(), 1, "keyboard focus leaving resumes autoplay");

      if (touch) await photo.tap(); else await photo.click();
      const viewer = page.locator(".project-viewer");
      assert.equal(await viewer.isVisible(), true);
      const before = await position();
      await page.clock.runFor(9000);
      assert.equal(await position(), before, "viewer stays manual");
      if (touch) await viewer.locator(".project-viewer-next").tap();
      else await viewer.locator(".project-viewer-next").click();
      assert.notEqual(await position(), before);
      if (touch) await viewer.locator(".project-viewer-close").tap();
      else { await viewer.locator(".project-viewer-close").click(); await page.mouse.move(2, 2); }
      await page.waitForTimeout(100); // Native dialog close/focus events precede the new timer.
      const closed = await position();
      await page.clock.runFor(6900);
      assert.notEqual(await position(), closed, "pointer-close resumes autoplay despite restored opener focus");

      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.waitForTimeout(100);
      const reduced = await position();
      await page.clock.runFor(12000);
      assert.equal(await position(), reduced, "reduced motion disables autoplay");
      if (touch) await swipeLeft();
      else { await photo.focus(); await page.keyboard.press("ArrowRight"); }
      assert.equal(await position(), (reduced + 1) % 4, "manual controls remain usable with reduced motion");
      assert.equal(await card.locator(".project-photo-previous").count(), 0);
      assert.equal(await page.locator('[data-project-id="furniture-assembly"] .project-photo-dot').count(), 0);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.deepEqual(errors, []);
      console.log(`PASS ${width}px: autoplay, pointer/touch resumption, keyboard focus, viewer, reduced motion and layout`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
