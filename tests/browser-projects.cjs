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
    await page.emulateMedia({ reducedMotion: "reduce" });
    const consoleCard = page.locator(
        '[data-project-id="wayfair-console-table"]',
      ),
      bath = page.locator('[data-project-id="bathroom-ventilation"]'),
      single = page.locator('[data-project-id="furniture-assembly"]'),
      viewer = page.locator(".project-viewer");
    await page.waitForFunction(() => document.querySelector('[data-project-id="wayfair-console-table"] .project-photo-open').hasAttribute("aria-keyshortcuts"));
    async function activePosition(card) {
      const match = (await card.locator(".project-photo-open").getAttribute("aria-label")).match(/photo (\d+) of (\d+)/);
      return `${match[1]} / ${match[2]}`;
    }
    async function nextPhoto(card) {
      await card.locator(".project-photo-open").focus();
      await page.keyboard.press("ArrowRight");
    }
    async function previousPhoto(card) {
      await card.locator(".project-photo-open").focus();
      await page.keyboard.press("ArrowLeft");
    }
    assert.equal(
      await page
        .locator(
          ".project-photo-prev,.project-photo-next,.project-photo-counter,.project-photo-dots,.project-photo-dot",
        )
        .count(),
      0,
    );
    await consoleCard
      .locator(".project-photo-open > img:not(.project-photo-previous)")
      .evaluate((n) => n.decode());
    assert.equal(await page.locator(".project-card").count(), 3);
    assert.equal(
      await single
        .locator(
          ".project-photo button,.project-photo-counter,.project-photo-dots",
        )
        .count(),
      0,
    );
    assert.equal(await activePosition(consoleCard), "1 / 4");
    assert.ok(
      !photos.some((url) => /console-table-[234]-/.test(url)),
      "only selected image is loaded initially",
    );
    await nextPhoto(consoleCard);
    assert.equal(await activePosition(consoleCard), "2 / 4");
    assert.match(
      await consoleCard
        .locator(".project-photo-open > img:not(.project-photo-previous)")
        .getAttribute("src"),
      /console-table-3-/,
    );
    assert.equal(await activePosition(bath), "1 / 2");
    await nextPhoto(bath);
    assert.equal(await activePosition(bath), "2 / 2");
    assert.equal(await activePosition(consoleCard), "2 / 4");
    await previousPhoto(consoleCard);
    assert.equal(await activePosition(consoleCard), "1 / 4");
    await previousPhoto(consoleCard);
    assert.equal(await activePosition(consoleCard), "4 / 4");
    await page.keyboard.press("Enter");
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
      await page.mouse.move(2, 2);
      await page.waitForTimeout(400);
      const layout = await page.locator(".project-card").evaluateAll((cards) =>
        cards.map((card) => {
          const box = card.getBoundingClientRect(),
            link = card
              .querySelector(".project-service-link")
              .getBoundingClientRect(),
            description = card
              .querySelector(".project-content > p:not(.project-meta)")
              .getBoundingClientRect(),
            actions = card
              .querySelector(".project-actions")
              .getBoundingClientRect();
          return {
            top: box.top,
            bottom: box.bottom,
            linkBottom: link.bottom,
            gap: actions.top - description.bottom,
          };
        }),
      );
      for (const card of layout)
        assert.ok(
          Math.abs(card.bottom - card.linkBottom - 24) < 2,
          "shared action area has consistent bottom padding",
        );
      for (let i = 0; i < layout.length; i++)
        for (let j = i + 1; j < layout.length; j++)
          if (Math.abs(layout[i].top - layout[j].top) < 2)
            assert.ok(
              Math.abs(layout[i].linkBottom - layout[j].linkBottom) < 2,
              "same-row service links align",
            );
      if (width <= 650)
        for (const card of layout)
          assert.ok(
            card.gap <= 17,
            "mobile cards should not reserve empty details space",
          );
      assert.equal(await bath.locator(".project-work-details").count(), 0);
      assert.equal(await single.locator(".project-work-details").count(), 0);
      assert.equal(
        await consoleCard.locator(".project-work-details").count(),
        1,
      );
      await page.screenshot({
        path: `work/projects-${width}.png`,
        fullPage: false,
      });
      if (width <= 390) {
        const before = await activePosition(consoleCard);
        await swipe(consoleCard.locator(".project-photo-open"), -110);
        assert.notEqual(await activePosition(consoleCard), before);
        assert.equal(
          await viewer.isVisible(),
          false,
          "swipe must not open viewer",
        );
        const verticalBefore = await activePosition(consoleCard);
        await swipe(consoleCard.locator(".project-photo-open"), 5, -75);
        assert.equal(
          await activePosition(consoleCard),
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
    await consoleCard.locator(".project-work-details summary").focus();
    await page.keyboard.press("Enter");
    assert.equal(
      await consoleCard
        .locator(".project-work-details")
        .evaluate((n) => n.open),
      true,
    );
    assert.equal(
      await consoleCard.locator(".project-work-details p").first().isVisible(),
      true,
    );
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    await page.keyboard.press("Enter");
    assert.equal(
      await consoleCard
        .locator(".project-work-details")
        .evaluate((n) => n.open),
      false,
    );
    assert.equal(
      await consoleCard.locator(".project-service-link").getAttribute("href"),
      "pricing.html#pricing-furniture",
    );
    // An unavailable image retains navigation and an accessible explanation.
    await page.route("**/console-table-2-*.webp", (r) => r.abort());
    await page.reload({ waitUntil: "networkidle" });
    await nextPhoto(consoleCard);
    await nextPhoto(consoleCard);
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
    await consoleCard
      .locator(".project-photo-open > img:not(.project-photo-previous)")
      .evaluate((n) => n.decode());
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
