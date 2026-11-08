import test from "node:test";
import assert from "node:assert/strict";
import { fixture, valid, submit, png, moderation } from "./reviews-fixture.mjs";
import worker, { maintenance } from "../server/reviews/worker.mjs";
import { auditCutoff, cleanReviewData } from "../server/reviews/retention.mjs";
const DAY = 86400000;
const row = (f) => f.sql.prepare("SELECT * FROM reviews").get();
test("incomplete uploads expire at 24h from creation, not upload-token expiry plus a grace day", async () => {
  const f = await fixture(),
    s = await submit(f),
    created = row(f).created_at;
  f.env.REVIEWS_RETENTION_ENABLED = "true";
  await maintenance(f.env, f.fetcher, created + DAY - 1);
  assert.ok(row(f));
  await maintenance(f.env, f.fetcher, created + DAY);
  assert.equal(row(f), undefined);
});
test("rejected reviews remain for 90 days; audit survives review deletion for its separate 12-month term", async () => {
  const f = await fixture(),
    s = await submit(f);
  await s.finish();
  await f.mutate(s.id, moderation({ status: "rejected" }));
  const rejected = row(f).rejected_at;
  f.env.REVIEWS_RETENTION_ENABLED = "true";
  await maintenance(f.env, f.fetcher, rejected + 90 * DAY - 1);
  assert.ok(row(f));
  await maintenance(f.env, f.fetcher, rejected + 90 * DAY);
  assert.equal(row(f), undefined);
  assert.equal(
    f.sql.prepare("SELECT COUNT(*) n FROM review_moderation_archive").get().n,
    1,
  );
});
test("active dispute/investigation holds require a reason and prevent review and original deletion", async () => {
  const f = await fixture(),
    s = await submit(f, valid({ photoCount: 1, photoConsent: true })),
    id = (await s.upload(await png())).data.id;
  await s.finish();
  assert.equal(
    (
      await f.mutate(
        s.id,
        moderation({
          retentionHold: true,
          retentionHoldReason: "",
          images: [{ id, status: "approved", caption: "" }],
        }),
      )
    ).status,
    400,
  );
  await f.mutate(
    s.id,
    moderation({
      status: "rejected",
      retentionHold: true,
      retentionHoldReason: "Active dispute being investigated",
      images: [{ id, status: "pending", caption: "" }],
    }),
  );
  f.env.REVIEWS_RETENTION_ENABLED = "true";
  await maintenance(f.env, f.fetcher, Date.now() + 100 * DAY);
  assert.ok(row(f));
  assert.equal(f.objects.size, 4);
  assert.equal(
    (
      await f.mutate(
        s.id,
        moderation({
          version: 1,
          status: "rejected",
          retentionHold: false,
          images: [{ id, status: "pending", caption: "" }],
        }),
      )
    ).status,
    200,
  );
  await maintenance(f.env, f.fetcher, Date.now() + 100 * DAY);
  assert.equal(row(f), undefined);
});
test("30-day original retention begins only after parent AND image publication, including late owner images", async () => {
  const f = await fixture(),
    s = await submit(f, valid({ photoCount: 1, photoConsent: true })),
    id = (await s.upload(await png())).data.id;
  await s.finish();
  f.env.REVIEWS_RETENTION_ENABLED = "true";
  f.sql
    .prepare("UPDATE review_images SET created_at=?")
    .run(Date.now() - 100 * DAY);
  await maintenance(f.env, f.fetcher);
  assert.equal(f.objects.size, 4);
  assert.equal(
    f.sql.prepare("SELECT published_at FROM review_images").get().published_at,
    null,
  );
  await f.mutate(
    s.id,
    moderation({ images: [{ id, status: "pending", caption: "" }] }),
  );
  await maintenance(f.env, f.fetcher, Date.now() + 31 * DAY);
  assert.equal(f.objects.size, 4);
  await f.mutate(
    s.id,
    moderation({
      version: 1,
      images: [{ id, status: "approved", caption: "" }],
    }),
  );
  const published = f.sql
    .prepare("SELECT published_at FROM review_images")
    .get().published_at;
  assert.ok(published);
  await maintenance(f.env, f.fetcher, published + 30 * DAY - 1);
  assert.equal(f.objects.size, 4);
  await maintenance(f.env, f.fetcher, published + 30 * DAY);
  assert.equal(f.objects.size, 3);
  assert.equal(
    f.sql.prepare("SELECT storage_key FROM review_images").get().storage_key,
    null,
  );
  assert.equal((await f.call(`/images/${id}/480`)).status, 200);
});
test("investigation hold protects a published original, then expires from original publication after release", async () => {
  const f = await fixture(),
    s = await submit(f, valid({ photoCount: 1, photoConsent: true })),
    id = (await s.upload(await png())).data.id;
  await s.finish();
  await f.mutate(
    s.id,
    moderation({
      retentionHold: true,
      retentionHoldReason: "Investigating publication permission",
      images: [{ id, status: "approved", caption: "" }],
    }),
  );
  f.env.REVIEWS_RETENTION_ENABLED = "true";
  await maintenance(f.env, f.fetcher, Date.now() + 31 * DAY);
  assert.equal(f.objects.size, 4);
  await f.mutate(
    s.id,
    moderation({
      version: 1,
      retentionHold: false,
      images: [{ id, status: "approved", caption: "" }],
    }),
  );
  await maintenance(f.env, f.fetcher, Date.now() + 31 * DAY);
  assert.equal(f.objects.size, 3);
});
test("audit cutoff uses 12 calendar months including leap-day boundaries; published content does not auto-expire", async () => {
  assert.equal(
    new Date(auditCutoff(Date.parse("2028-02-29T12:00:00Z"))).toISOString(),
    "2027-02-28T12:00:00.000Z",
  );
  const f = await fixture(),
    s = await submit(f);
  await s.finish();
  await f.mutate(s.id, moderation());
  f.env.REVIEWS_RETENTION_ENABLED = "true";
  const now = Date.parse("2028-03-01T12:00:00Z"),
    cutoff = auditCutoff(now);
  f.sql
    .prepare("UPDATE review_moderation_events SET created_at=?")
    .run(cutoff - 1);
  await maintenance(f.env, f.fetcher, now);
  assert.equal(
    f.sql.prepare("SELECT COUNT(*) n FROM review_moderation_events").get().n,
    0,
  );
  assert.equal(row(f).status, "approved");
  assert.ok(row(f).publication_review_due_at);
});
test("cleanup claims prevent accepting a hold or photo changes while deletion is in progress", async () => {
  const f = await fixture(),
    s = await submit(f);
  await s.finish();
  f.sql
    .prepare("UPDATE reviews SET retention_deleting=1,retention_deleting_at=?")
    .run(Date.now());
  assert.equal(
    (
      await f.mutate(
        s.id,
        moderation({ retentionHold: true, retentionHoldReason: "Dispute" }),
      )
    ).status,
    409,
  );
  assert.equal(row(f).retention_hold, 0);
});
test("disabled email switch prevents every scheduled/finalization Brevo call even with configured secrets", async () => {
  const f = await fixture();
  f.env.REVIEWS_NOTIFICATIONS_ENABLED = "false";
  const s = await submit(f);
  await s.finish();
  await maintenance(f.env, f.fetcher);
  assert.equal(f.calls.mail.length, 0);
  assert.equal(
    f.sql.prepare("SELECT state FROM review_notification_outbox").get().state,
    "pending",
  );
});
test("authenticated admin remains available while customer submissions are disabled", async () => {
  const f = await fixture();
  f.env.REVIEWS_ENABLED = "false";
  assert.equal((await f.call("/config")).data.enabled, false);
  assert.equal((await f.call("/admin/session", { admin: true })).status, 200);
  assert.equal(
    (await f.call("/submissions", { method: "POST", body: valid() })).status,
    503,
  );
  assert.equal((await f.call("/admin/session")).status, 403);
});

test("readiness checks stay authenticated, read-only and do not claim real account entitlements", async () => {
  const f = await fixture();
  f.env.REVIEWS_ENABLED = "false";
  assert.equal((await f.call("/admin/readiness")).status, 403);
  const check = await f.call("/admin/readiness", { admin: true });
  assert.equal(check.status, 200);
  assert.equal(check.data.schema, true);
  assert.equal(check.data.limitsValid, true);
  assert.equal(check.data.accountEntitlementsVerified, false);
  assert.equal(check.data.resourcePermissionsVerified, false);
  assert.ok(!JSON.stringify(check.data).includes(f.env.REVIEWS_HASH_SECRET));
  assert.equal(f.sql.prepare("SELECT COUNT(*) n FROM reviews").get().n, 0);
});
test("readiness detects missing retention migration and configuration drift without changing schema", async () => {
  const f = await fixture();
  f.sql.exec("DROP TRIGGER review_moderation_retention_lock");
  f.env.REVIEWS_TRANSFORM_BUDGET = "4500";
  const check = await f.call("/admin/readiness", { admin: true });
  assert.equal(check.data.schema, false);
  assert.equal(check.data.limitsValid, false);
  assert.ok(check.data.missing.includes("review_moderation_retention_lock"));
});
test("published-review reminder queue is private and never deletes or automatically renews reviews", async () => {
  const f = await fixture(),
    s = await submit(f);
  await s.finish();
  await f.mutate(s.id, moderation());
  assert.equal(
    (await f.call("/admin?status=approved&due=true", { admin: true })).data
      .reviews.length,
    0,
  );
  f.sql.prepare("UPDATE reviews SET publication_review_due_at=0").run();
  assert.equal(
    (await f.call("/admin?status=approved&due=true", { admin: true })).data
      .reviews.length,
    1,
  );
  assert.equal((await f.call()).data.reviews.length, 1);
});
test("archive stays owner-only after a rejected review is deleted, then expires at 12 months", async () => {
  const f = await fixture(),
    s = await submit(f);
  await s.finish();
  await f.mutate(s.id, moderation({ status: "rejected" }));
  const rejected = row(f).rejected_at;
  f.env.REVIEWS_RETENTION_ENABLED = "true";
  await maintenance(f.env, f.fetcher, rejected + 90 * DAY);
  assert.equal((await f.call("/admin/audit?review=" + s.id)).status, 403);
  assert.equal(
    (await f.call("/admin/audit?review=" + s.id, { admin: true })).data.events
      .length,
    1,
  );
  await maintenance(f.env, f.fetcher, rejected + 400 * DAY);
  assert.equal(
    f.sql.prepare("SELECT COUNT(*) n FROM review_moderation_archive").get().n,
    0,
  );
});
test("cleanup failure retains the manifest and releases the lock for a safe retry", async () => {
  const f = await fixture(),
    s = await submit(f, valid({ photoCount: 1, photoConsent: true }));
  await s.upload(await png());
  await s.finish();
  await f.mutate(
    s.id,
    moderation({
      status: "rejected",
      images: [
        {
          id: f.sql.prepare("SELECT id FROM review_images").get().id,
          status: "pending",
          caption: "",
        },
      ],
    }),
  );
  f.env.REVIEWS_RETENTION_ENABLED = "true";
  const original = f.env.REVIEWS_MEDIA.delete;
  f.env.REVIEWS_MEDIA.delete = async () => {
    throw Error("Mock storage failure");
  };
  await assert.rejects(maintenance(f.env, f.fetcher, Date.now() + 91 * DAY));
  assert.equal(row(f).retention_deleting, 0);
  assert.ok(row(f));
  f.env.REVIEWS_MEDIA.delete = original;
  await maintenance(f.env, f.fetcher, Date.now() + 91 * DAY);
  assert.equal(row(f), undefined);
});

test("disabled retention performs no cleanup database or storage operations even if invoked directly", async () => {
  for (const value of [undefined, "false", "TRUE", true]) {
    const env = {
      REVIEWS_RETENTION_ENABLED: value,
      REVIEWS_NOTIFICATIONS_ENABLED: "false",
      REVIEWS_DB: {
        prepare() {
          throw Error("Database must not be touched");
        },
      },
      REVIEWS_MEDIA: {
        list() {
          throw Error("Storage must not be touched");
        },
      },
    };
    await cleanReviewData(env);
    await maintenance(env, () => {
      throw Error("No network allowed");
    });
    let scheduled = false;
    worker.scheduled({}, env, {
      waitUntil() {
        scheduled = true;
      },
    });
    assert.equal(scheduled, false);
  }
});

test("disabled cleanup preserves overdue uploads, removed photos, IP hashes and stale notification state", async () => {
  const f = await fixture();
  f.env.REVIEWS_NOTIFICATIONS_ENABLED = "false";
  f.env.REVIEWS_RETENTION_ENABLED = "false";
  const s = await submit(f, valid({ photoCount: 1, photoConsent: true }));
  await s.upload(await png());
  f.sql
    .prepare(
      "UPDATE reviews SET created_at=0,retention_deleting=1,retention_deleting_at=0",
    )
    .run();
  f.sql
    .prepare("UPDATE review_images SET approval_status='removed',created_at=0")
    .run();
  const before = [...f.sql.prepare("SELECT * FROM reviews").all()];
  const imagesBefore = [...f.sql.prepare("SELECT * FROM review_images").all()];
  const keys = [...f.objects.keys()];
  await maintenance(f.env, f.fetcher, Date.now() + 400 * DAY);
  assert.deepEqual(f.sql.prepare("SELECT * FROM reviews").all(), before);
  assert.deepEqual(
    f.sql.prepare("SELECT * FROM review_images").all(),
    imagesBefore,
  );
  assert.deepEqual([...f.objects.keys()], keys);
  assert.equal(f.calls.mail.length, 0);
});
