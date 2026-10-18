// Controlled browser time exercises scheduling without live services or long waits.
const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 915 },
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
      loaded = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("request", (r) => {
      if (r.url().includes("console-table-")) loaded.push(r.url());
    });
    async function visibleConsole() {
      await consoleCard.scrollIntoViewIfNeeded();
      await page.evaluate(
        () =>
          new Promise((resolve) => {
            const o = new IntersectionObserver(
              (entries) => {
                if (
                  entries.some(
                    (e) => e.isIntersecting && e.intersectionRatio >= 0.1,
                  )
                ) {
                  o.disconnect();
                  resolve();
                }
              },
              { threshold: 0.1 },
            );
            o.observe(
              document.querySelector(
                '[data-project-id="wayfair-console-table"]',
              ),
            );
          }),
      );
    }
    await page.clock.install();
    await page.goto("http://127.0.0.1:8788/", { waitUntil: "networkidle" });
    const bath = page.locator('[data-project-id="bathroom-ventilation"]'),
      consoleCard = page.locator('[data-project-id="wayfair-console-table"]'),
      single = page.locator('[data-project-id="furniture-assembly"]');
    const image = (card) =>
      card.locator(".project-photo-open > img:not(.project-photo-previous)");
    const position = (card) =>
      card
        .locator(".project-photo-dot")
        .evaluateAll((nodes) =>
          nodes.findIndex((n) => n.hasAttribute("aria-current")),
        );
    await page.clock.runFor(20000);
    assert.equal(await position(consoleCard), 0);
    assert.ok(
      !loaded.some((url) => /console-table-[234]-/.test(url)),
      "offscreen cards do not preload their galleries",
    );
    await page.locator("#projects").scrollIntoViewIfNeeded();
    await page.evaluate(
      () =>
        new Promise((resolve) => {
          const o = new IntersectionObserver((entries) => {
            if (entries.some((e) => e.isIntersecting)) {
              o.disconnect();
              resolve();
            }
          });
          o.observe(
            document.querySelector('[data-project-id="bathroom-ventilation"]'),
          );
        }),
    );
    await page.clock.runFor(4500);
    assert.equal(await position(bath), 0);
    assert.equal(await position(consoleCard), 0);
    await page.clock.runFor(600);
    assert.equal(await position(bath), 1);
    assert.equal(
      await position(consoleCard),
      0,
      "first changes must be staggered",
    );
    await page.clock.runFor(1700);
    assert.equal(await position(consoleCard), 1);
    await image(consoleCard).evaluate((n) => n.decode());
    // The previous photograph overlays the new one, fading for exactly 500ms.
    await page.waitForFunction(() => {
      const n = document.querySelector(
        '[data-project-id="wayfair-console-table"] .project-photo-previous',
      );
      return (
        n &&
        n.getAnimations().some((a) => a.effect.getTiming().duration === 500)
      );
    });
    assert.equal(await single.locator(".project-photo-dots").count(), 0);
    assert.equal(
      await single.locator("img").getAttribute("src"),
      "assets/projects/about-800.webp",
    );
    await consoleCard.hover();
    let current = await position(consoleCard);
    await page.clock.runFor(11000);
    assert.equal(await position(consoleCard), current, "hover pauses autoplay");
    await page.mouse.move(2, 2);
    await consoleCard.locator(".project-photo-dot").first().focus();
    current = await position(consoleCard);
    await page.clock.runFor(11000);
    assert.equal(await position(consoleCard), current, "focus pauses autoplay");
    await page.locator(".hero-buttons a").first().focus();
    await visibleConsole();
    await page.clock.runFor(100);
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", {
        configurable: true,
        value: true,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    current = await position(consoleCard);
    await page.clock.runFor(20000);
    assert.equal(
      await position(consoleCard),
      current,
      "hidden tab event pauses autoplay",
    );
    await page.evaluate(() => {
      delete document.hidden;
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.clock.runFor(6800);
    assert.notEqual(
      await position(consoleCard),
      current,
      "visibility restoration resumes autoplay",
    );
    await consoleCard.dispatchEvent("pointerdown", {
      isPrimary: true,
      pointerId: 7,
      pointerType: "touch",
      clientX: 20,
      clientY: 20,
    });
    current = await position(consoleCard);
    await page.clock.runFor(11000);
    assert.equal(
      await position(consoleCard),
      current,
      "active interaction pauses autoplay",
    );
    await page.dispatchEvent("body", "pointerup", {
      isPrimary: true,
      pointerId: 7,
      pointerType: "touch",
    });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.waitForTimeout(100); // Let native matchMedia change events flush.
    await page.clock.runFor(100);
    current = await position(consoleCard);
    await page.clock.runFor(20000);
    assert.equal(await position(consoleCard), current);
    assert.equal(
      await consoleCard.locator(".project-photo-previous").count(),
      0,
    );
    const next = (current + 1) % 4;
    await consoleCard.locator(".project-photo-dot").nth(next).click();
    await image(consoleCard).evaluate((n) => n.decode());
    assert.equal(
      await position(consoleCard),
      next,
      "manual navigation remains available with reduced motion",
    );
    assert.equal(
      await consoleCard.locator(".project-photo-previous").count(),
      0,
    );
    assert.equal(
      await image(consoleCard).evaluate((n) => n.getAnimations().length),
      0,
    );
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.waitForTimeout(100);
    await page.locator(".hero-buttons a").first().focus();
    await visibleConsole();
    await page.mouse.move(2, 2);
    await page.clock.runFor(100);
    current = await position(consoleCard);
    await page.clock.runFor(6800);
    assert.notEqual(await position(consoleCard), current);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.waitForTimeout(100); // Let native matchMedia change events flush.
    await consoleCard.locator(".project-photo-open").click();
    const viewer = page.locator(".project-viewer");
    const before = await viewer.locator("img").getAttribute("src");
    await page.clock.runFor(20000);
    assert.equal(
      await viewer.locator("img").getAttribute("src"),
      before,
      "viewer stays manual",
    );
    await viewer.locator(".project-viewer-next").click();
    assert.notEqual(await viewer.locator("img").getAttribute("src"), before);
    await page.keyboard.press("Escape");
    assert.deepEqual(errors, []);
    console.log(
      "PASS: 5-second cadence, staggered starts, real crossfade timing, hover/focus/interaction/hidden events, resumption, reduced-motion live changes, static single images, offscreen loading and manual viewer. No production requests.",
    );
    await context.close();
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
