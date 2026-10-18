// Local-only end-to-end harness: real SQLite/image decoding, mocked Access keys,
// Turnstile and Brevo. No requests or emails are sent to production.
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { resolve, extname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import {
  fixture,
  submit,
  valid,
  moderation,
  png,
} from "../tests/reviews-fixture.mjs";
import { handleReviews } from "../server/reviews/worker.mjs";
import { authenticate } from "../server/reviews/auth.mjs";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
const root = resolve(fileURLToPath(new URL("..", import.meta.url))),
  output = resolve(
    process.env.REVIEWS_SCREENSHOTS || "work/reviews-screenshots",
  );
await mkdir(output, { recursive: true });
const f = await fixture();
const sample = await submit(f, valid({ photoCount: 2, photoConsent: true })),
  photo = (await sample.upload(await png())).data.id;
const secondPhoto = (await sample.upload(await png())).data.id;
await sample.finish();
await f.mutate(
  sample.id,
  moderation({
    images: [
      {
        id: photo,
        status: "approved",
        caption: "Test-only completed work photograph",
      },
      {
        id: secondPhoto,
        status: "approved",
        caption: "Second test-only work photograph",
      },
    ],
    project: "furniture-assembly",
  }),
);
const types = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
};
const server = createServer(async (req, res) => {
  try {
    const origin = "http://127.0.0.1:" + server.address().port,
      url = new URL(req.url, origin),
      headers = new Headers();
    for (const [key, value] of Object.entries(req.headers))
      if (value)
        headers.set(key, Array.isArray(value) ? value.join(",") : value);
    let response;
    if (url.pathname.startsWith("/api/reviews")) {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      response = await handleReviews(
        new Request(url, {
          method: req.method,
          headers,
          body: ["GET", "HEAD"].includes(req.method)
            ? undefined
            : Buffer.concat(chunks),
        }),
        f.env,
        f.fetcher,
      );
    } else if (url.pathname.startsWith("/api/"))
      response = Response.json({ enabled: false }, { status: 503 });
    else {
      if (url.pathname.startsWith("/admin/")) {
        try {
          await authenticate(new Request(url, { headers }), f.env, f.fetcher);
        } catch {
          res.writeHead(403);
          res.end("Owner sign-in required");
          return;
        }
      }
      const pathname = decodeURIComponent(url.pathname),
        file = resolve(
          root,
          "." +
            (pathname === "/"
              ? "/index.html"
              : pathname.includes(".")
                ? pathname
                : pathname + ".html"),
        );
      if (relative(root, file).startsWith("..")) throw Error();
      response = new Response(await readFile(file), {
        headers: {
          "Content-Type": types[extname(file)] || "application/octet-stream",
        },
      });
    }
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = "http://127.0.0.1:" + server.address().port;
f.env.SITE_ORIGIN = base;
f.setTurnstile({ success: true, action: "review", hostname: "127.0.0.1" });
const browser = await chromium.launch({
  channel: process.env.BROWSER_CHANNEL || "msedge",
  headless: true,
});
const errors = [];
const turnstile = `window.turnstile={render:(target,options)=>{document.querySelector(target).textContent='Spam protection (local test)';queueMicrotask(()=>options.callback('mock-only'));return 'mock-widget';},remove:()=>document.querySelector('#review-turnstile').replaceChildren(),reset:()=>{}};`;
async function context(options = {}) {
  const ctx = await browser.newContext(options);
  await ctx.route("**/*", async (route) => {
    const url = route.request().url();
    if (url.startsWith(base)) return route.continue();
    if (url.startsWith("https://challenges.cloudflare.com/turnstile/"))
      return route.fulfill({
        contentType: "application/javascript",
        body: turnstile,
      });
    return route.abort();
  });
  ctx.on("page", (page) =>
    page.on("pageerror", (error) => errors.push(error.message)),
  );
  return ctx;
}
try {
  for (const width of [360, 390, 768, 1280]) {
    const ctx = await context({
      viewport: { width, height: 900 },
      isMobile: width < 600,
      hasTouch: width < 600,
    });
    const page = await ctx.newPage();
    await page.goto(base + "/reviews");
    await page.locator(".website-review-card").waitFor();
    await page.locator("#review-submit:not([disabled])").waitFor();
    const reject = page.getByRole("button", {
      name: "Reject analytics",
      exact: true,
    });
    if (await reject.isVisible()) await reject.click();
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      "reviews overflow " + width,
    );
    assert.equal(
      await page.locator('script[src*="googletagmanager.com"]').count(),
      0,
    );
    const firstRating = page.locator('input[name=rating][value="1"]');
    await firstRating.focus();
    await page.keyboard.press("ArrowRight");
    assert.equal(
      await page.locator('input[name=rating][value="2"]').isChecked(),
      true,
    );
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.screenshot({
      path: resolve(output, `reviews-${width}.png`),
      fullPage: true,
    });
    await page.locator(".review-thumbnails button").first().focus();
    await page.keyboard.press("Enter");
    assert.equal(await page.locator("dialog[open]").count(), 1);
    await page.keyboard.press("ArrowRight");
    assert.match(
      await page
        .locator(".review-viewer .project-viewer-caption")
        .textContent(),
      /2 of 2/,
    );
    await page.keyboard.press("Tab");
    assert.equal(
      await page.evaluate(() =>
        Boolean(document.activeElement.closest("dialog[open]")),
      ),
      true,
    );
    if (width === 390) {
      await page.evaluate(() => {
        const stage = document.querySelector(
          ".review-viewer .project-viewer-stage",
        );
        stage.dispatchEvent(
          new TouchEvent("touchstart", {
            touches: [
              new Touch({
                identifier: 1,
                target: stage,
                clientX: 80,
                clientY: 100,
              }),
            ],
          }),
        );
        stage.dispatchEvent(
          new TouchEvent("touchend", {
            changedTouches: [
              new Touch({
                identifier: 1,
                target: stage,
                clientX: 200,
                clientY: 105,
              }),
            ],
          }),
        );
      });
      assert.match(
        await page
          .locator(".review-viewer .project-viewer-caption")
          .textContent(),
        /1 of 2/,
      );
    }

    await page.keyboard.press("Escape");
    assert.equal(await page.locator("dialog[open]").count(), 0);
    assert.equal(
      await page
        .locator(".review-thumbnails button")
        .first()
        .evaluate((el) => el === document.activeElement),
      true,
    );
    if (width === 390) {
      await page.locator("#review-name").fill("Browser Test Only");
      await page.locator('input[name=rating][value="4"]').check();
      await page
        .locator("#review-text")
        .fill(
          "A local browser test review that must never be published to production.",
        );
      await page
        .locator("#review-photos")
        .setInputFiles([
          { name: "test.png", mimeType: "image/png", buffer: await png() },
        ]);
      assert.equal(await page.locator("#review-photo-previews li").count(), 1);
      await page.locator("#review-photo-previews button").click();
      assert.equal(await page.locator("#review-photo-previews li").count(), 0);
      await page
        .locator("#review-photos")
        .setInputFiles([
          { name: "test.png", mimeType: "image/png", buffer: await png() },
        ]);
      await page.locator("#review-photo-consent").check();
      await page.locator("input[name=consent]").check();
      await page.locator("#review-submit").click();
      await page.locator("#review-success:not([hidden])").waitFor();
      assert.equal(await page.locator("#review-turnstile").textContent(), "");
      assert.equal(await page.locator("#review-form").isVisible(), false);
      await page.evaluate(() =>
        window.scrollTo({ top: 0, behavior: "instant" }),
      );
      await page.screenshot({
        path: resolve(output, "reviews-success-390.png"),
        fullPage: true,
      });
    }
    await page.goto(base + "/");
    await page.locator("#website-customer-reviews:not([hidden])").waitFor();
    assert.equal(
      await page
        .locator("#website-customer-reviews .website-review-card")
        .count(),
      1,
    );
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      "homepage overflow " + width,
    );
    await ctx.close();
  }
  // Test absence of Access independently from the authenticated owner context.
  const denied = await fetch(base + "/admin/reviews");
  assert.equal(denied.status, 403);
  for (const width of [390, 1280]) {
    const ctx = await context({
        viewport: { width, height: 900 },
        extraHTTPHeaders: { "Cf-Access-Jwt-Assertion": f.token },
      }),
      page = await ctx.newPage();
    await page.goto(base + "/admin/reviews");
    await page
      .locator("#admin-status")
      .filter({ hasText: "Owner access verified" })
      .waitFor();
    await page.locator("#admin-filter").selectOption("approved");
    await page.locator(".admin-review-item").first().click();
    await page.locator("#admin-editor").waitFor();
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      "admin overflow " + width,
    );
    await page
      .getByRole("button", { name: "Preview public appearance" })
      .click();
    await page.locator(".review-preview-dialog[open]").waitFor();
    await page.keyboard.press("Escape");
    if (width === 390) {
      await page
        .getByLabel("Internal moderation notes")
        .fill("Checked on a local mobile test.");
      await page.getByRole("button", { name: "Save moderation" }).click();
      await page
        .locator("#admin-status")
        .filter({ hasText: "Moderation saved" })
        .waitFor();
      await page.locator("#business-photo-permission").check();
      await page
        .getByLabel("Add business photographs")
        .setInputFiles([
          { name: "owner.png", mimeType: "image/png", buffer: await png() },
        ]);
      await page
        .locator("#admin-status")
        .filter({ hasText: "Photographs added privately" })
        .waitFor();
      assert.equal(await page.locator(".admin-image").count(), 3);
      await page.getByRole("button", { name: "Move up" }).last().click();
      await page
        .locator("select[name^=photo-]")
        .first()
        .selectOption("approved");
      await page.getByRole("button", { name: "Save moderation" }).click();
      await page
        .locator("#admin-status")
        .filter({ hasText: "Moderation saved" })
        .waitFor();
    }
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.screenshot({
      path: resolve(output, `reviews-admin-${width}.png`),
      fullPage: true,
    });
    await ctx.close();
  }
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify(
      {
        passed: true,
        widths: [360, 390, 768, 1280],
        adminWidths: [390, 1280],
        pageErrors: errors,
        localOnly: true,
        screenshots: output,
        brevoRequestsMocked: f.calls.mail.length,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
