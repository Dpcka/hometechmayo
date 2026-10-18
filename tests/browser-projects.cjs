// Local fixtures only; never submits quotes, sends email or contacts analytics.
const assert = require("node:assert/strict"),
  fs = require("node:fs");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 915 },
      hasTouch: true,
    });
    await context.addInitScript(() => {
      localStorage.setItem(
        "htss_cookie_consent",
        JSON.stringify({ version: 1, analytics: false, savedAt: Date.now() }),
      );
      localStorage.setItem("whatsappClosed", "true");
    });
    const page = await context.newPage(),
      errors = [],
      photos = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("request", (r) => {
      if (r.url().includes("/console-table-")) photos.push(r.url());
    });
    await page.goto("http://127.0.0.1:8788/", { waitUntil: "networkidle" });
    await page.locator("#projects").scrollIntoViewIfNeeded();
    const consoleCard = page.locator(
        '[data-project-id="wayfair-console-table"]',
      ),
      bath = page.locator('[data-project-id="bathroom-ventilation"]'),
      single = page.locator('[data-project-id="furniture-assembly"]'),
      viewer = page.locator(".project-viewer");
    await consoleCard.locator("img").evaluate((n) => n.decode());
    assert.equal(await page.locator(".project-card").count(), 3);
    assert.equal(
      await single
        .locator(".project-photo button,.project-photo-counter")
        .count(),
      0,
    );
    assert.equal(
      await consoleCard.locator(".project-photo-counter").innerText(),
      "1 / 4",
    );
    assert.ok(
      !photos.some((url) => /console-table-[234]-/.test(url)),
      "only selected image is loaded initially",
    );
    await consoleCard.locator(".project-photo-next").click();
    assert.equal(
      await consoleCard.locator(".project-photo-counter").innerText(),
      "2 / 4",
    );
    assert.match(
      await consoleCard.locator("img").getAttribute("src"),
      /console-table-3-/,
    );
    assert.equal(
      await bath.locator(".project-photo-counter").innerText(),
      "1 / 2",
    );
    await bath.locator(".project-photo-next").click();
    assert.equal(
      await bath.locator(".project-photo-counter").innerText(),
      "2 / 2",
    );
    assert.equal(
      await consoleCard.locator(".project-photo-counter").innerText(),
      "2 / 4",
    );
    await consoleCard.locator(".project-photo-prev").click();
    assert.equal(
      await consoleCard.locator(".project-photo-counter").innerText(),
      "1 / 4",
    );
    await consoleCard.locator(".project-photo-prev").focus();
    await page.keyboard.press("Enter");
    assert.equal(
      await consoleCard.locator(".project-photo-counter").innerText(),
      "4 / 4",
    );
    await consoleCard.locator(".project-photo-open").click();
    await viewer.waitFor({ state: "visible" });
    assert.equal(
      await viewer.locator("h2").innerText(),
      "Wayfair Console Table Assembly",
    );
    assert.equal(
      await viewer.locator("h2").evaluate((n) => getComputedStyle(n).color),
      "rgb(255, 255, 255)",
    );
    assert.equal(
      await viewer
        .locator("img")
        .evaluate((n) => getComputedStyle(n).objectFit),
      "contain",
    );
    assert.equal(
      await page.evaluate(() => document.body.style.overflow),
      "hidden",
    );
    await page.keyboard.press("ArrowRight");
    assert.match(
      await viewer.locator(".project-viewer-caption").innerText(),
      /^1 \/ 4/,
    );
    assert.match(
      await viewer.locator("img").getAttribute("src"),
      /console-table-1-/,
    );
    await page.keyboard.press("ArrowLeft");
    assert.match(
      await viewer.locator("img").getAttribute("src"),
      /console-table-4-/,
    );
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press("Tab");
      assert.equal(
        await viewer.evaluate((n) => n.contains(document.activeElement)),
        true,
      );
    }
    await page.screenshot({ path: "work/project-viewer-desktop.png" });
    await page.keyboard.press("Escape");
    assert.equal(await viewer.isVisible(), false);
    assert.equal(
      await consoleCard
        .locator(".project-photo-open")
        .evaluate((n) => n === document.activeElement),
      true,
    );
    assert.equal(await page.evaluate(() => document.body.style.overflow), "");
    await single.locator(".project-photo-open").click();
    assert.equal(
      await viewer.locator(".project-viewer-prev").isVisible(),
      false,
    );
    assert.equal(
      await viewer.locator(".project-viewer-next").isVisible(),
      false,
    );
    await page.keyboard.press("ArrowRight");
    assert.match(await viewer.locator("img").getAttribute("src"), /about-1600/);
    await viewer.locator(".project-viewer-close").click();
    await bath.locator(".project-photo-open").click();
    await viewer.locator(".project-viewer-next").click();
    assert.match(
      await viewer.locator("img").getAttribute("src"),
      /PXL_20260713_151848763/,
    );
    await page.mouse.click(2, 2);
    assert.equal(await viewer.isVisible(), false);
    const cdp = await context.newCDPSession(page);
    async function swipe(locator, dx, dy = 0) {
      await locator.scrollIntoViewIfNeeded();
      const rect = await locator.boundingBox(),
        x = rect.x + rect.width * 0.65,
        y = rect.y + Math.min(110, rect.height / 2);
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x, y }],
      });
      for (let i = 1; i <= 5; i++)
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [{ x: x + (dx * i) / 5, y: y + (dy * i) / 5 }],
        });
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
      await page.waitForTimeout(200);
    }
    for (const width of [360, 390, 768, 1280]) {
      await page.setViewportSize({ width, height: 915 });
      await consoleCard.scrollIntoViewIfNeeded();
      await page.waitForTimeout(400);
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      const columns = await page
        .locator(".projects-grid")
        .evaluate(
          (n) => getComputedStyle(n).gridTemplateColumns.split(" ").length,
        );
      assert.equal(columns, width <= 650 ? 1 : width <= 1100 ? 2 : 3);
      await page.screenshot({
        path: `work/projects-${width}.png`,
        fullPage: false,
      });
      if (width <= 390) {
        const before = await consoleCard
          .locator(".project-photo-counter")
          .innerText();
        await swipe(consoleCard.locator(".project-photo-open"), -110);
        assert.notEqual(
          await consoleCard.locator(".project-photo-counter").innerText(),
          before,
        );
        assert.equal(
          await viewer.isVisible(),
          false,
          "swipe must not open viewer",
        );
        const verticalBefore = await consoleCard
          .locator(".project-photo-counter")
          .innerText();
        await swipe(consoleCard.locator(".project-photo-open"), 5, -75);
        assert.equal(
          await consoleCard.locator(".project-photo-counter").innerText(),
          verticalBefore,
          "vertical scrolling must not change image",
        );
        await consoleCard.locator(".project-photo-open").click();
        await swipe(viewer.locator(".project-viewer-stage"), -100);
        assert.match(
          await viewer.locator("img").getAttribute("src"),
          /console-table-/,
        );
        await viewer.locator("img").evaluate((n) => n.decode());
        await page.screenshot({ path: `work/project-viewer-${width}.png` });
        await page.keyboard.press("Escape");
      }
      console.log(
        `PASS ${width}px: grid, controls, no overflow${width <= 390 ? ", real horizontal/vertical touch, no accidental opening, viewer swipe" : ""}`,
      );
    }
    assert.equal(
      await consoleCard.locator(".project-service-link").getAttribute("href"),
      "pricing.html#pricing-furniture",
    );
    // An unavailable image retains navigation and an accessible explanation.
    await page.route("**/console-table-2-*.webp", (r) => r.abort());
    await page.reload({ waitUntil: "networkidle" });
    await consoleCard.locator(".project-photo-next").click();
    await consoleCard.locator(".project-photo-next").click();
    await consoleCard
      .locator(".project-image-error")
      .waitFor({ state: "visible" });
    await consoleCard.locator(".project-photo-open").click();
    await viewer.locator(".project-image-error").waitFor({ state: "visible" });
    await viewer.locator(".project-viewer-next").click();
    await viewer.locator("img").evaluate((n) => n.decode());
    assert.equal(
      await viewer.locator(".project-image-error").isVisible(),
      false,
    );
    await viewer.locator(".project-viewer-close").click();
    await consoleCard.locator("img").evaluate((n) => n.decode());
    assert.equal(
      await consoleCard.locator(".project-image-error").isVisible(),
      false,
    );
    assert.deepEqual(errors, []);
    await context.close();
    const noJS = await browser.newContext({ javaScriptEnabled: false });
    const plain = await noJS.newPage();
    await plain.goto("http://127.0.0.1:8788/");
    assert.equal(await plain.locator(".project-card").count(), 3);
    assert.equal(
      await plain
        .locator(
          '[data-project-id="wayfair-console-table"] .project-photo-open',
        )
        .getAttribute("href"),
      "assets/projects/wayfair-console-table/console-table-1-1600.webp",
    );
    await noJS.close();
    console.log(
      "PASS: single/multiple images, independent state, wrap, keyboard, focus trap/restore, Escape/Close/backdrop, scroll lock, contained viewer, lazy loading, missing images and recovery, no-JS cards, valid related service. No live requests sent.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
