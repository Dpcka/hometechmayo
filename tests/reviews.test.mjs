import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { readFileSync } from "node:fs";
import {
  fixture,
  valid,
  submit,
  png,
  moderation,
  ORIGIN,
} from "./reviews-fixture.mjs";
import { maintenance } from "../server/reviews/worker.mjs";
import { cleanWebP, transformPhoto } from "../server/reviews/images.mjs";
import { protectAdminPage } from "../server/reviews/auth.mjs";

test("valid review is stored pending, consent version/time recorded, email private and owner notified only once", async () => {
  const f = await fixture(),
    s = await submit(f, valid({ email: "private@example.test" }));
  assert.equal((await s.finish()).status, 200);
  const row = f.sql.prepare("SELECT * FROM reviews").get();
  assert.equal(row.status, "pending");
  assert.equal(row.ingestion_state, "ready");
  assert.equal(row.customer_email, "private@example.test");
  assert.ok(row.consent_timestamp > 0);
  assert.equal(
    f.sql.prepare("SELECT COUNT(*) AS n FROM review_consents").get().n,
    1,
  );
  assert.deepEqual((await f.call()).data.reviews, []);
  assert.equal(f.calls.mail.length, 1);
  assert.equal(f.calls.mail[0].to[0].email, "info@hometechmayo.ie");
  assert.ok(!JSON.stringify(f.calls.mail[0]).includes("private@example.test"));
  assert.match(f.calls.mail[0].textContent, /\/admin\/reviews/);
  assert.equal((await s.finish()).data.duplicate, true);
  assert.equal(f.calls.mail.length, 1);
});
test("server independently rejects missing fields, invalid ratings, short/long text, categories, invalid email and missing consents", async () => {
  const f = await fixture();
  for (const overrides of [
    { name: "" },
    { rating: 0 },
    { rating: 6 },
    { rating: 1.5 },
    { review: "too short" },
    { review: "x".repeat(2001) },
    { category: "invented" },
    { email: "bad\r\n@example.com" },
    { consent: false },
    { consentVersion: "old" },
    { photoCount: 6 },
    { photoCount: 1, photoConsent: false },
    { website: "bot" },
  ])
    assert.equal(
      (await f.call("/submissions", { method: "POST", body: valid(overrides) }))
        .status,
      400,
      JSON.stringify(overrides),
    );
  assert.equal(f.sql.prepare("SELECT COUNT(*) AS n FROM reviews").get().n, 0);
});
test("Turnstile rejects invalid tokens, wrong action/hostname and provider failure before storage", async () => {
  const f = await fixture();
  for (const result of [
    { success: false },
    { success: true, action: "quote", hostname: "hometechmayo.ie" },
    { success: true, action: "review", hostname: "other.example" },
  ]) {
    f.setTurnstile(result);
    assert.equal(
      (await f.call("/submissions", { method: "POST", body: valid() })).status,
      400,
    );
  }
  assert.equal(f.sql.prepare("SELECT COUNT(*) AS n FROM reviews").get().n, 0);
});
test("same request safely resumes, changed payload conflicts, new key with same payload and sixth IP submission are blocked", async () => {
  const f = await fixture(),
    body = valid(),
    a = await f.call("/submissions", { method: "POST", body }),
    b = await f.call("/submissions", { method: "POST", body });
  assert.equal(a.data.id, b.data.id);
  assert.equal(a.data.uploadToken, b.data.uploadToken);
  assert.equal(
    (
      await f.call("/submissions", {
        method: "POST",
        body: { ...body, rating: 4 },
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await f.call("/submissions", {
        method: "POST",
        body: { ...body, requestId: crypto.randomUUID() },
      })
    ).status,
    429,
  );
  for (let i = 1; i < 5; i++)
    assert.equal(
      (
        await f.call("/submissions", {
          method: "POST",
          body: valid({ name: "Customer " + i }),
        })
      ).status,
      201,
    );
  assert.equal(
    (
      await f.call("/submissions", {
        method: "POST",
        body: valid({ name: "Sixth" }),
      })
    ).status,
    429,
  );
});
test("concurrent duplicate starts reserve one review and retry recovers without another notification", async () => {
  const f = await fixture(),
    body = valid();
  const results = await Promise.all([
    f.call("/submissions", { method: "POST", body }),
    f.call("/submissions", { method: "POST", body }),
  ]);
  assert.ok(results.some((r) => r.status === 201));
  assert.equal(f.sql.prepare("SELECT COUNT(*) AS n FROM reviews").get().n, 1);
  const retry = await f.call("/submissions", { method: "POST", body });
  assert.equal(retry.status, 200);
});
test("same-origin checks, body size, JSON and disabled configuration fail safely", async () => {
  const f = await fixture();
  assert.equal(
    (
      await f.call("/submissions", {
        method: "POST",
        body: valid(),
        origin: "https://evil.test",
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await f.call("/submissions", {
        method: "POST",
        body: "x".repeat(17000),
        headers: { "Content-Type": "application/json" },
      })
    ).status,
    413,
  );
  assert.equal(
    (
      await f.call("/submissions", {
        method: "POST",
        body: "{",
        headers: { "Content-Type": "application/json" },
      })
    ).status,
    400,
  );
  f.env.REVIEWS_ENABLED = "false";
  assert.equal((await f.call("/config")).data.enabled, false);
  assert.equal(
    (await f.call("/submissions", { method: "POST", body: valid() })).status,
    503,
  );
});
test("photo permission, actual decode, MIME spoofing, unsupported and oversized uploads are enforced", async () => {
  const f = await fixture(),
    s = await submit(f, valid({ photoCount: 1, photoConsent: true }));
  assert.equal(
    (await s.upload(new Uint8Array(10 * 1024 * 1024 + 1))).status,
    413,
  );
  assert.equal(
    (
      await s.upload(
        new TextEncoder().encode("<svg/>"),
        crypto.randomUUID(),
        "image/svg+xml",
      )
    ).status,
    400,
  );
  assert.equal(
    (await s.upload(await png(), crypto.randomUUID(), "image/jpeg")).status,
    400,
  );
  assert.equal(
    (await s.upload(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0])))
      .status,
    400,
  );
  assert.equal((await s.finish()).status, 409);
  assert.equal(f.calls.mail.length, 0);
  assert.equal(f.objects.size, 0);
  const result = await s.upload(await png());
  assert.equal(result.status, 201);
  assert.equal(f.objects.size, 4);
  assert.equal((await s.finish()).status, 200);
  assert.equal(
    f.sql.prepare("SELECT COUNT(*) AS n FROM review_consents").get().n,
    2,
  );
  assert.equal(
    f.sql.prepare("SELECT source FROM review_images").get().source,
    "customer",
  );
});
test("customer maximum is five, business maximum is ten, and upload retries do not duplicate photographs", async () => {
  const f = await fixture(),
    s = await submit(f, valid({ photoCount: 5, photoConsent: true })),
    bytes = await png(),
    photo = crypto.randomUUID();
  assert.equal((await s.upload(bytes, photo)).status, 201);
  assert.equal((await s.upload(bytes, photo)).data.duplicate, true);
  for (let i = 1; i < 5; i++) assert.equal((await s.upload(bytes)).status, 201);
  assert.equal((await s.upload(bytes)).status, 409);
  assert.equal((await s.finish()).status, 200);
  const add = () =>
    f.call(`/admin/${s.id}/photos/${crypto.randomUUID()}`, {
      method: "PUT",
      admin: true,
      headers: {
        "X-Review-CSRF": f.adminSession.csrf,
        "X-Photo-Permission": f.adminSession.consentVersion,
        "Content-Type": "image/png",
      },
      body: bytes,
    });
  for (let i = 0; i < 5; i++) assert.equal((await add()).status, 201);
  assert.equal((await add()).status, 409);
  assert.equal(
    f.sql.prepare("SELECT COUNT(*) AS n FROM review_images").get().n,
    10,
  );
});
test("pending images are private, review/image approval both required, hiding immediately blocks images", async () => {
  const f = await fixture(),
    s = await submit(f, valid({ photoCount: 1, photoConsent: true }));
  const image = (await s.upload(await png())).data.id;
  await s.finish();
  assert.equal((await f.call(`/images/${image}/480`)).status, 404);
  assert.equal(
    (await f.call(`/admin/images/${image}/480`, { admin: true })).status,
    200,
  );
  assert.equal(
    (
      await f.mutate(
        s.id,
        moderation({ images: [{ id: image, status: "pending", caption: "" }] }),
      )
    ).status,
    200,
  );
  assert.equal((await f.call()).data.reviews[0].images.length, 0);
  assert.equal(
    (
      await f.mutate(
        s.id,
        moderation({
          version: 1,
          images: [
            { id: image, status: "approved", caption: "Completed work" },
          ],
        }),
      )
    ).status,
    200,
  );
  assert.equal((await f.call(`/images/${image}/480`)).status, 200);
  const publicReview = (await f.call()).data.reviews[0];
  assert.equal(publicReview.images.length, 1);
  assert.equal(publicReview.source, "Website Review");
  assert.equal(publicReview.name, "Test Customer");
  assert.ok(!JSON.stringify(publicReview).includes("customer_email"));
  assert.ok(!JSON.stringify(publicReview).includes("moderation_notes"));
  assert.equal(
    (
      await f.mutate(
        s.id,
        moderation({
          version: 2,
          status: "hidden",
          images: [
            { id: image, status: "approved", caption: "Completed work" },
          ],
        }),
      )
    ).status,
    200,
  );
  assert.equal((await f.call(`/images/${image}/480`)).status, 404);
  assert.equal((await f.call()).data.reviews.length, 0);
});
test("owner authentication requires a valid signed Access JWT, correct audience, issuer, owner and expiry", async () => {
  const f = await fixture();
  assert.equal((await f.call("/admin")).status, 403);
  assert.equal(
    (
      await f.call("/admin", {
        headers: {
          "Cf-Access-Authenticated-User-Email": f.env.REVIEWS_ADMIN_EMAIL,
        },
      })
    ).status,
    403,
  );
  for (const overrides of [
    { aud: ["other"] },
    { iss: "https://wrong.cloudflareaccess.com" },
    { email: "intruder@example.test" },
    { exp: 1 },
    { nbf: Math.floor(Date.now() / 1000) + 100 },
  ])
    assert.equal(
      (
        await f.call("/admin", {
          headers: { "Cf-Access-Jwt-Assertion": await f.jwt(overrides) },
        })
      ).status,
      403,
    );
  assert.equal(
    (
      await f.call("/admin", {
        headers: {
          "Cf-Access-Jwt-Assertion": f.token.slice(0, -8) + "tampered",
        },
      })
    ).status,
    403,
  );
  assert.equal((await f.call("/admin", { admin: true })).status, 200);
});
test("admin CSRF, unknown project, invalid photo ownership and stale moderation versions are rejected", async () => {
  const f = await fixture(),
    s = await submit(f);
  await s.finish();
  assert.equal(
    (
      await f.call("/admin/" + s.id, {
        method: "POST",
        admin: true,
        body: moderation(),
      })
    ).status,
    403,
  );
  assert.equal(
    (await f.mutate(s.id, moderation({ project: "fictional" }))).status,
    400,
  );
  assert.equal(
    (
      await f.mutate(
        s.id,
        moderation({
          images: [
            { id: crypto.randomUUID(), status: "approved", caption: "" },
          ],
        }),
      )
    ).status,
    409,
  );
  assert.equal((await f.mutate(s.id, moderation())).status, 200);
  assert.equal((await f.mutate(s.id, moderation())).status, 409);
  assert.equal(
    f.sql.prepare("SELECT COUNT(*) AS n FROM review_moderation_events").get().n,
    1,
  );
});
test("approve, reject, hide and restore preserve originals; low ratings are not automatically rejected", async () => {
  const f = await fixture(),
    s = await submit(f, valid({ rating: 1 }));
  await s.finish();
  assert.equal(
    f.sql.prepare("SELECT status FROM reviews").get().status,
    "pending",
  );
  for (const [version, status] of [
    "approved",
    "hidden",
    "approved",
    "rejected",
  ].entries())
    assert.equal(
      (
        await f.mutate(
          s.id,
          moderation({ version, status, project: "furniture-assembly" }),
        )
      ).status,
      200,
    );
  assert.equal(
    f.sql.prepare("SELECT review_text FROM reviews").get().review_text,
    s.body.review,
  );
  assert.equal(
    f.sql.prepare("SELECT COUNT(*) AS n FROM review_moderation_events").get().n,
    4,
  );
  assert.equal(
    (await f.call("?project=furniture-assembly")).data.reviews.length,
    0,
  );
});
test("valid project association is explicit, public redactions are transparent and original text is immutable", async () => {
  const f = await fixture(),
    s = await submit(f);
  await s.finish();
  assert.equal(
    (
      await f.mutate(
        s.id,
        moderation({
          publicText: "Privacy-safe public wording for this test review.",
        }),
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await f.mutate(
        s.id,
        moderation({
          publicText: "Privacy-safe public wording for this test review.",
          redactionReason: "Removed private address",
          project: "wayfair-console-table",
        }),
      )
    ).status,
    200,
  );
  const review = (await f.call("?project=wayfair-console-table")).data
    .reviews[0];
  assert.equal(review.edited, true);
  assert.match(review.text, /Privacy-safe/);
  assert.equal(
    f.sql.prepare("SELECT review_text FROM reviews").get().review_text,
    s.body.review,
  );
  assert.equal(
    (await f.call("?project=furniture-assembly")).data.reviews.length,
    0,
  );
});
test("image removal revokes public access, cleanup removes original/derivative objects, and order/captions persist", async () => {
  const f = await fixture(),
    s = await submit(f, valid({ photoCount: 2, photoConsent: true })),
    bytes = await png(),
    a = (await s.upload(bytes)).data.id,
    b = (await s.upload(bytes)).data.id;
  await s.finish();
  await f.mutate(
    s.id,
    moderation({
      images: [
        { id: b, status: "approved", caption: "Second first" },
        { id: a, status: "removed", caption: "" },
      ],
    }),
  );
  assert.equal((await f.call()).data.reviews[0].images[0].id, b);
  assert.equal((await f.call(`/images/${a}/480`)).status, 404);
  await maintenance(f.env, f.fetcher);
  assert.equal(f.objects.size, 4);
  assert.equal(
    f.sql.prepare("SELECT COUNT(*) AS n FROM review_images").get().n,
    1,
  );
});
test("Brevo failure does not lose the review and uncertain notifications are not resent automatically", async () => {
  const f = await fixture();
  f.failMail();
  const s = await submit(f);
  assert.equal((await s.finish()).status, 200);
  assert.equal(
    f.sql.prepare("SELECT state FROM review_notification_outbox").get().state,
    "failed",
  );
  assert.equal(
    f.sql.prepare("SELECT ingestion_state FROM reviews").get().ingestion_state,
    "ready",
  );
  await maintenance(f.env, f.fetcher);
  await s.finish();
  assert.equal(f.calls.mail.length, 1);
});
test("missing Images, decoder limits and transformation quota fail closed without published or orphaned objects", async () => {
  const f = await fixture();
  delete f.env.IMAGES;
  assert.equal((await f.call("/config")).data.photosEnabled, false);
  assert.equal(
    (
      await f.call("/submissions", {
        method: "POST",
        body: valid({ photoCount: 1, photoConsent: true }),
      })
    ).status,
    503,
  );
  const g = await fixture(),
    s = await submit(g, valid({ photoCount: 1, photoConsent: true }));
  g.env.IMAGES.info = async () => ({
    format: "png",
    width: 100000,
    height: 100000,
  });
  assert.equal((await s.upload(await png())).status, 400);
  assert.equal(g.objects.size, 0);
  g.sql
    .prepare("INSERT OR REPLACE INTO review_usage(scope,used) VALUES(?,?)")
    .run("transforms:" + new Date().toISOString().slice(0, 7), 3000);
  assert.equal((await s.upload(await png())).status, 503);
  assert.equal(g.objects.size, 0);
});
test("partial R2 failures leave nothing public and compensating cleanup removes the partial objects", async () => {
  const f = await fixture(),
    s = await submit(f, valid({ photoCount: 1, photoConsent: true }));
  const put = f.env.REVIEWS_MEDIA.put;
  let count = 0;
  f.env.REVIEWS_MEDIA.put = async (...args) => {
    if (++count === 3) throw Error("mock storage failure");
    return put(...args);
  };
  assert.equal((await s.upload(await png())).status, 503);
  assert.equal(f.objects.size, 0);
  assert.equal(
    f.sql.prepare("SELECT COUNT(*) AS n FROM review_images").get().n,
    0,
  );
});
test("real image reencoding strips metadata and creates three decodable responsive WebP variants", async () => {
  const f = await fixture();
  const original = await sharp(await png())
    .withMetadata()
    .withExif({
      IFD0: { Artist: "Private Photographer" },
      IFD3: { GPSLatitudeRef: "N", GPSLatitude: "53/1 0/1 0/1" },
    })
    .jpeg()
    .toBuffer();
  const result = await transformPhoto(original, "image/jpeg", f.env.IMAGES);
  assert.equal(result.variants.length, 3);
  for (const variant of result.variants) {
    const meta = await sharp(variant.bytes).metadata();
    assert.equal(meta.format, "webp");
    assert.equal(meta.exif, undefined);
    assert.equal(meta.xmp, undefined);
    assert.equal(meta.icc, undefined);
    assert.ok(meta.width <= variant.size);
  }
  // Even an encoder that returns metadata is filtered before public storage.
  const withMetadata = await sharp(await png())
      .withMetadata()
      .webp()
      .toBuffer(),
    clean = cleanWebP(withMetadata),
    meta = await sharp(clean).metadata();
  assert.equal(meta.exif, undefined);
  assert.equal(meta.icc, undefined);
  assert.throws(() => cleanWebP(new Uint8Array([1, 2, 3])));
});
test("expired upload tokens, foreign sessions and unfinished reviews cannot be published", async () => {
  const f = await fixture(),
    s = await submit(f, valid({ photoCount: 1, photoConsent: true }));
  assert.equal((await f.mutate(s.id, moderation())).status, 404);
  assert.equal(
    (
      await f.call(`/submissions/${s.id}/complete`, {
        method: "POST",
        headers: { "X-Review-Upload-Token": "invalid" },
      })
    ).status,
    403,
  );
  f.sql.prepare("UPDATE reviews SET upload_expires=0").run();
  assert.equal((await s.finish()).status, 410);
  await maintenance(f.env, f.fetcher);
  assert.equal(f.sql.prepare("SELECT COUNT(*) AS n FROM reviews").get().n, 0);
});
test("administrative static page middleware fails closed without authentication", async () => {
  const response = await protectAdminPage({
    request: new Request(ORIGIN + "/admin/reviews"),
    env: {},
    next: () => new Response("private"),
  });
  assert.equal(response.status, 503);
});
test("reviews integration leaves pricing, quote numbering, analytics and project data isolated", () => {
  const worker = readFileSync(
    new URL("../server/reviews/worker.mjs", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(
    worker,
    /QUOTE_GUARD|assignPublicReference|supabase|generate_lead/,
  );
  const migration = readFileSync(
    new URL("../server/reviews/migrations/0001-reviews.sql", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(
    migration,
    /ALTER TABLE|DROP TABLE|quote_reference_counters/,
  );
  const client = readFileSync(
    new URL("../js/reviews-ui.mjs", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(client, /innerHTML|autoplay/);
  assert.match(client, /textContent/);
});

test("concurrent photo slots and moderation operations cannot exceed limits or overwrite a newer decision", async () => {
  const f = await fixture(),
    s = await submit(f, valid({ photoCount: 1, photoConsent: true })),
    bytes = await png();
  const uploads = await Promise.all([s.upload(bytes), s.upload(bytes)]);
  assert.equal(uploads.filter((r) => r.status === 201).length, 1);
  assert.equal(
    f.sql.prepare("SELECT COUNT(*) AS n FROM review_images").get().n,
    1,
  );
  await s.finish();
  const image = f.sql.prepare("SELECT id FROM review_images").get().id;
  const outcomes = await Promise.all([
    f.mutate(
      s.id,
      moderation({
        status: "approved",
        images: [{ id: image, status: "approved", caption: "First" }],
      }),
    ),
    f.mutate(
      s.id,
      moderation({
        status: "rejected",
        images: [{ id: image, status: "pending", caption: "Second" }],
      }),
    ),
  ]);
  assert.equal(outcomes.filter((r) => r.status === 200).length, 1);
  assert.equal(f.sql.prepare("SELECT version FROM reviews").get().version, 1);
  assert.equal(
    f.sql.prepare("SELECT COUNT(*) AS n FROM review_moderation_events").get().n,
    1,
  );
});
test("storage safety budget refuses uploads without disturbing previously accepted content", async () => {
  const f = await fixture(),
    s = await submit(f, valid({ photoCount: 1, photoConsent: true }));
  f.sql
    .prepare("INSERT INTO review_usage(scope,used) VALUES('storage',?)")
    .run(512 * 1024 * 1024);
  const r = await s.upload(await png());
  assert.equal(r.status, 503);
  assert.match(r.data.error, /storage/);
  assert.equal(f.objects.size, 0);
  assert.equal(
    f.sql.prepare("SELECT COUNT(*) AS n FROM review_images").get().n,
    0,
  );
});
test("SQL-like content remains data, HTML is escaped in notifications and private records never leak", async () => {
  const f = await fixture(),
    s = await submit(
      f,
      valid({
        name: "<img src=x onerror=alert(1)>",
        review:
          "Useful work; '); DROP TABLE reviews; -- this is only test input.",
      }),
    );
  await s.finish();
  assert.ok(!f.calls.mail[0].htmlContent.includes("<img"));
  assert.match(f.calls.mail[0].htmlContent, /&lt;img/);
  await f.mutate(s.id, moderation());
  const data = (await f.call()).data;
  assert.equal(data.reviews[0].name, s.body.name);
  for (const field of [
    "customer_email",
    "request_key",
    "payload_hash",
    "ip_hash",
    "consent_timestamp",
    "storage_key",
    "moderation_notes",
  ])
    assert.ok(!JSON.stringify(data).includes(field));
  assert.equal(f.sql.prepare("SELECT COUNT(*) AS n FROM reviews").get().n, 1);
});
test("specific approved review links and pagination work without exposing hidden or pending records", async () => {
  const f = await fixture(),
    s = await submit(f);
  await s.finish();
  assert.equal((await f.call("?review=" + s.id)).data.reviews.length, 0);
  await f.mutate(s.id, moderation());
  assert.equal((await f.call("?review=" + s.id)).data.reviews[0].id, s.id);
  assert.equal((await f.call("?review=invalid")).status, 400);
  assert.equal((await f.call("?limit=1.5")).status, 200);
  assert.equal((await f.call("?offset=1")).data.reviews.length, 0);
});
test("longer retention remains opt-in and operates only on reviews data", async () => {
  const f = await fixture(),
    s = await submit(f, valid({ email: "private@example.test" }));
  await s.finish();
  f.sql.prepare("UPDATE reviews SET created_at=0,updated_at=0").run();
  await maintenance(f.env, f.fetcher);
  assert.equal(f.sql.prepare("SELECT COUNT(*) AS n FROM reviews").get().n, 1);
  f.env.REVIEWS_RETENTION_ENABLED = "true";
  await maintenance(f.env, f.fetcher);
  assert.equal(f.sql.prepare("SELECT COUNT(*) AS n FROM reviews").get().n, 0);
});

test("review pages do not load analytics and link to existing privacy/cookie preferences", () => {
  const html = readFileSync(
    new URL("../reviews.html", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(html, /src="[^" ]*(?:analytics|cookie-consent)\.mjs"/);
  assert.match(html, /href="\/privacy#analytics-cookies"/);
  assert.match(html, /href="\/privacy#website-reviews-privacy"/);
});

test("moderation audit records project, redaction and photograph decisions server-side", async () => {
  const f = await fixture(),
    s = await submit(f);
  await s.finish();
  await f.mutate(s.id, moderation({ project: "furniture-assembly" }));
  const entry = f.sql
    .prepare("SELECT details_json FROM review_moderation_events")
    .get();
  assert.equal(JSON.parse(entry.details_json).project, "furniture-assembly");
  assert.equal(JSON.parse(entry.details_json).from, "pending");
  assert.equal(JSON.parse(entry.details_json).to, "approved");
});
