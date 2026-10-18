import {
  CONSENT_VERSION,
  CATEGORIES,
  PROJECT_OPTIONS,
  ReviewError,
  validateReview,
  text,
  uuid,
  hmac,
  readJSON,
  readBytes,
  MAX_BYTES,
  escapeHTML,
} from "./policy.mjs";
import { authenticate } from "./auth.mjs";
import { transformPhoto } from "./images.mjs";
const headers = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};
const json = (value, status = 200) => Response.json(value, { status, headers });
const query = (env, sql, ...args) => env.REVIEWS_DB.prepare(sql).bind(...args);
const all = async (statement) => (await statement.all()).results;
const changed = (result) => Number(result.meta?.changes || 0) > 0;
const ready = (env) =>
  env.REVIEWS_ENABLED === "true" &&
  env.REVIEWS_DB &&
  env.REVIEWS_HASH_SECRET?.length >= 32 &&
  env.TURNSTILE_SECRET_KEY &&
  env.TURNSTILE_SITE_KEY &&
  env.SITE_ORIGIN;
const photos = (env) =>
  env.REVIEWS_PHOTOS_ENABLED === "true" && env.IMAGES && env.REVIEWS_MEDIA;
const allowedOrigin = (request, env) =>
  request.headers.get("origin") === env.SITE_ORIGIN &&
  new URL(request.url).origin === env.SITE_ORIGIN;
const tokenFor = (env, row) =>
  hmac(env.REVIEWS_HASH_SECRET, "upload:" + row.request_key);
async function uploadSession(request, env, id) {
  const row = await query(env, "SELECT * FROM reviews WHERE id=?", id).first();
  if (
    !row ||
    request.headers.get("X-Review-Upload-Token") !== (await tokenFor(env, row))
  )
    throw new ReviewError("Upload session is invalid.", 403);
  if (row.ingestion_state !== "ready" && row.upload_expires < Date.now())
    throw new ReviewError("Upload session expired. Please start again.", 410);
  return row;
}
async function turnstile(request, env, body, fetcher) {
  const token = text(body.turnstileToken ?? "", 2048, true);
  let result;
  try {
    const response = await fetcher(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(8000),
        body: JSON.stringify({
          secret: env.TURNSTILE_SECRET_KEY,
          response: token,
          remoteip: request.headers.get("CF-Connecting-IP") || undefined,
        }),
      },
    );
    if (!response.ok) throw Error();
    result = await response.json();
  } catch {
    throw new ReviewError(
      "Spam protection is temporarily unavailable. Please retry.",
      503,
    );
  }
  if (
    !result.success ||
    result.action !== "review" ||
    result.hostname !== new URL(env.SITE_ORIGIN).hostname
  )
    throw new ReviewError("Please complete spam protection again.", 400);
}
async function start(request, env, fetcher) {
  const body = await readJSON(request),
    data = validateReview(body);
  if (data.photoCount && !photos(env))
    throw new ReviewError(
      "Photo uploads are not available yet. You can submit a text review.",
      503,
    );
  const requestKey = await hmac(
      env.REVIEWS_HASH_SECRET,
      "request:" + body.requestId,
    ),
    payloadHash = await hmac(env.REVIEWS_HASH_SECRET, JSON.stringify(data));
  const previous = await query(
    env,
    "SELECT * FROM reviews WHERE request_key=?",
    requestKey,
  ).first();
  if (previous) {
    if (previous.payload_hash !== payloadHash)
      throw new ReviewError(
        "These details differ from the original submission. Start a new review.",
        409,
      );
    return json({
      id: previous.id,
      uploadToken: await tokenFor(env, previous),
      complete: previous.ingestion_state === "ready",
      duplicate: true,
    });
  }
  await turnstile(request, env, body, fetcher);
  const now = Date.now(),
    id = crypto.randomUUID(),
    ip = await hmac(
      env.REVIEWS_HASH_SECRET,
      "ip:" + request.headers.get("CF-Connecting-IP"),
    );
  // Atomic INSERT condition prevents concurrent requests bypassing the quota.
  const result = await query(
    env,
    `INSERT INTO reviews (id,request_key,payload_hash,ip_hash,customer_name,customer_email,rating,review_text,service_category,expected_photos,created_at,updated_at,consent_version,consent_timestamp,photo_consent,upload_expires)
 SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?
 WHERE (SELECT COUNT(*) FROM reviews WHERE ip_hash=? AND created_at>?)<5
 AND NOT EXISTS(SELECT 1 FROM reviews WHERE payload_hash=? AND created_at>?)`,
    id,
    requestKey,
    payloadHash,
    ip,
    data.name,
    data.email,
    data.rating,
    data.review,
    data.category,
    data.photoCount,
    now,
    now,
    CONSENT_VERSION,
    now,
    data.photoConsent ? 1 : 0,
    now + 3600000,
    ip,
    now - 3600000,
    payloadHash,
    now - 86400000,
  ).run();
  if (!changed(result))
    throw new ReviewError(
      "A matching review was already received, or the submission limit was reached. Please try later.",
      429,
    );
  // Consents are finalised transactionally with the submission, not inferred from public cookies.
  return json(
    {
      id,
      uploadToken: await tokenFor(env, { request_key: requestKey }),
      complete: false,
    },
    201,
  );
}
async function upload(request, env, review, id, source, actor) {
  if (!uuid(id)) throw new ReviewError("Invalid photograph identifier.");
  if (!photos(env))
    throw new ReviewError("Photo uploads are currently unavailable.", 503);
  if (
    source === "customer" &&
    (review.ingestion_state !== "uploading" || !review.photo_consent)
  )
    throw new ReviewError(
      "This submission cannot accept more photographs.",
      409,
    );
  if (
    source === "business" &&
    (request.headers.get("X-Photo-Permission") !== CONSENT_VERSION ||
      review.ingestion_state !== "ready")
  )
    throw new ReviewError("Confirm photograph publication permission.");
  const old = await query(
    env,
    "SELECT * FROM review_images WHERE id=? AND review_id=?",
    id,
    review.id,
  ).first();
  if (old?.upload_state === "ready")
    return json({ ok: true, id, duplicate: true });
  if (old)
    throw new ReviewError(
      "This photograph is already being processed. Retry shortly or select it again.",
      409,
    );
  const mime = request.headers.get("content-type")?.split(";")[0];
  if (!["image/jpeg", "image/png", "image/webp"].includes(mime))
    throw new ReviewError("Only JPEG, PNG and WebP photographs are accepted.");
  const bytes = await readBytes(request, MAX_BYTES),
    now = Date.now();
  const reservation = await query(
    env,
    `INSERT INTO review_images (id,review_id,source,sort_order,permission_version,permission_timestamp,permission_actor,created_at)
 SELECT ?,?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM review_images WHERE review_id=? AND approval_status!='removed')<10
 AND (?='business' OR (SELECT COUNT(*) FROM review_images WHERE review_id=? AND source='customer' AND approval_status!='removed')<?)`,
    id,
    review.id,
    source,
    now,
    CONSENT_VERSION,
    now,
    actor,
    now,
    review.id,
    source,
    review.id,
    Math.min(5, review.expected_photos),
  ).run();
  if (!changed(reservation))
    throw new ReviewError("The photograph limit has been reached.", 409);
  const keys = [];
  let storageReserved = false;
  try {
    const storageCap = Math.min(
        512 * 1024 * 1024,
        Number(env.REVIEWS_STORAGE_BUDGET_BYTES) || 512 * 1024 * 1024,
      ),
      reservationBytes = MAX_BYTES + 6 * 1024 * 1024;
    const storage = await query(
      env,
      `INSERT INTO review_usage(scope,used) SELECT 'storage',? WHERE ?<=? ON CONFLICT(scope) DO UPDATE SET used=used+? WHERE used+?<=?`,
      reservationBytes,
      reservationBytes,
      storageCap,
      reservationBytes,
      reservationBytes,
      storageCap,
    ).run();
    if (!changed(storage))
      throw new ReviewError(
        "Photo storage is temporarily full. Please contact us or submit a text review.",
        503,
      );
    storageReserved = true;
    await query(
      env,
      "UPDATE review_images SET reserved_bytes=? WHERE id=?",
      reservationBytes,
      id,
    ).run();
    // Fail closed before processing if the local monthly budget is exhausted.
    const month = new Date().toISOString().slice(0, 7),
      budget = Math.min(4500, Number(env.REVIEWS_TRANSFORM_BUDGET) || 3000);
    const quota = await query(
      env,
      `INSERT INTO review_usage(scope,used) VALUES(?,3) ON CONFLICT(scope) DO UPDATE SET used=used+3 WHERE used+3<=?`,
      "transforms:" + month,
      budget,
    ).run();
    if (!changed(quota))
      throw new ReviewError(
        "Photo processing quota is temporarily exhausted. Please try again later.",
        503,
      );
    const result = await transformPhoto(bytes, mime, env.IMAGES),
      original = `originals/${review.id}/${id}`;
    keys.push(original);
    await env.REVIEWS_MEDIA.put(original, bytes, {
      httpMetadata: { contentType: mime },
    });
    const statements = [];
    for (const variant of result.variants) {
      const key = `derivatives/${review.id}/${id}/${variant.size}.webp`;
      keys.push(key);
      await env.REVIEWS_MEDIA.put(key, variant.bytes, {
        httpMetadata: { contentType: "image/webp" },
      });
      statements.push(
        query(
          env,
          "INSERT INTO review_image_variants(image_id,size,storage_key) VALUES(?,?,?)",
          id,
          variant.size,
          key,
        ),
      );
    }
    statements.push(
      query(
        env,
        "UPDATE review_images SET storage_key=?,upload_state='ready',width=?,height=? WHERE id=?",
        original,
        result.width,
        result.height,
        id,
      ),
    );
    if (source === "business")
      statements.push(
        event(
          env,
          review.id,
          "photo_uploaded",
          actor,
          "Business photograph awaiting approval.",
        ),
      );
    await env.REVIEWS_DB.batch(statements);
    return json({ ok: true, id }, 201);
  } catch (error) {
    // All objects remain private even if compensating cleanup fails; scheduled sweep retries.
    let deleted = true;
    for (const key of keys) {
      try {
        await env.REVIEWS_MEDIA.delete(key);
      } catch {
        deleted = false;
      }
    }
    if (deleted) {
      await env.REVIEWS_DB.batch([
        ...(storageReserved
          ? [
              query(
                env,
                "UPDATE review_usage SET used=MAX(0,used-?) WHERE scope='storage'",
                MAX_BYTES + 6 * 1024 * 1024,
              ),
            ]
          : []),
        query(
          env,
          "DELETE FROM review_images WHERE id=? AND upload_state='uploading'",
          id,
        ),
      ]);
    }
    throw error;
  }
}
function event(
  env,
  id,
  action,
  actor,
  notes = "",
  eventId = crypto.randomUUID(),
  details = {},
) {
  return query(
    env,
    "INSERT INTO review_moderation_events(id,review_id,action,actor,notes,details_json,created_at) VALUES(?,?,?,?,?,?,?)",
    eventId,
    id,
    action,
    actor,
    notes,
    JSON.stringify(details),
    Date.now(),
  );
}
async function finalize(env, row, fetcher) {
  if (row.ingestion_state === "ready")
    return json({ ok: true, duplicate: true });
  const count = await query(
    env,
    "SELECT COUNT(*) AS n FROM review_images WHERE review_id=? AND upload_state='ready' AND source='customer'",
    row.id,
  ).first();
  if (count.n !== row.expected_photos)
    throw new ReviewError(
      "Upload all selected photographs before submitting.",
      409,
    );
  const now = Date.now();
  await env.REVIEWS_DB.batch([
    query(
      env,
      "UPDATE reviews SET ingestion_state='ready',updated_at=? WHERE id=? AND ingestion_state='uploading'",
      now,
      row.id,
    ),
    query(
      env,
      "INSERT OR IGNORE INTO review_consents(id,review_id,kind,version,recorded_at) VALUES(?,?,'review',?,?)",
      row.id + ":review",
      row.id,
      row.consent_version,
      row.consent_timestamp,
    ),
    ...(row.photo_consent
      ? [
          query(
            env,
            "INSERT OR IGNORE INTO review_consents(id,review_id,kind,version,recorded_at) VALUES(?,?,'photos',?,?)",
            row.id + ":photos",
            row.id,
            row.consent_version,
            row.consent_timestamp,
          ),
        ]
      : []),
    query(
      env,
      "INSERT OR IGNORE INTO review_notification_outbox(review_id) VALUES(?)",
      row.id,
    ),
  ]);
  await notify(env, row.id, fetcher);
  return json({
    ok: true,
    message:
      "Thank you! Your review has been received and will be moderated before publication.",
  });
}
export async function notify(env, id, fetcher = fetch) {
  const now = Date.now(),
    reserved = await query(
      env,
      "UPDATE review_notification_outbox SET state='sending',attempts=attempts+1,attempted_at=? WHERE review_id=? AND state='pending'",
      now,
      id,
    ).run();
  if (!changed(reserved)) return;
  try {
    const sender = env.REVIEWS_FROM_EMAIL || env.QUOTE_FROM_EMAIL,
      to = env.REVIEWS_TO_EMAIL || env.QUOTE_TO_EMAIL;
    if (
      !env.BREVO_API_KEY ||
      ![sender, to].every((x) =>
        /^[^\s<>@]+@[^\s<>@]+\.[A-Za-z]{2,}$/.test(x || ""),
      )
    )
      throw Error();
    const row = await query(
      env,
      "SELECT customer_name,rating,created_at FROM reviews WHERE id=?",
      id,
    ).first();
    const response = await fetcher("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      signal: AbortSignal.timeout(12000),
      headers: {
        "api-key": env.BREVO_API_KEY,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        sender: { email: sender, name: "Home Tech Solutions & Services" },
        to: [{ email: to }],
        subject: "New website review awaiting moderation",
        textContent: `New review awaiting moderation.\nCustomer: ${row.customer_name}\nRating: ${row.rating}/5\nSubmitted: ${new Date(row.created_at).toISOString()}\nOpen: ${env.SITE_ORIGIN}/admin/reviews`,
        htmlContent: `<h1>New review awaiting moderation</h1><p>${escapeHTML(row.customer_name)} — ${row.rating}/5</p><p>${escapeHTML(new Date(row.created_at).toISOString())}</p><p><a href="${env.SITE_ORIGIN}/admin/reviews">Open secure administration</a></p>`,
      }),
    });
    if (!response.ok || !(await response.json()).messageId) throw Error();
    await query(
      env,
      "UPDATE review_notification_outbox SET state='sent',sent_at=?,last_error=NULL WHERE review_id=?",
      Date.now(),
      id,
    ).run();
  } catch {
    await query(
      env,
      "UPDATE review_notification_outbox SET state='failed',last_error='Provider acceptance not confirmed. Check delivery before manually retrying.' WHERE review_id=?",
      id,
    ).run();
  }
}
async function publicList(request, env) {
  const params = new URL(request.url).searchParams,
    limit = Math.floor(
      Math.max(1, Math.min(20, Number(params.get("limit")) || 20)),
    ),
    offset = Math.floor(
      Math.max(0, Math.min(10000, Number(params.get("offset")) || 0)),
    );
  const specific = params.get("review") || "";
  if (specific && !uuid(specific))
    throw new ReviewError("Invalid review link.");
  const project = params.get("project") || "";
  if (project && !PROJECT_OPTIONS.some((p) => p.id === project))
    throw new ReviewError("Invalid project.");
  const rows = await all(
    query(
      env,
      `SELECT id,customer_name,public_name,rating,review_text,public_text,redaction_reason,service_category,published_at,linked_project_id FROM reviews WHERE status='approved' AND ingestion_state='ready' AND (?='' OR linked_project_id=?) AND (?='' OR id=?) ORDER BY published_at DESC,id LIMIT ? OFFSET ?`,
      project,
      project,
      specific,
      specific,
      limit,
      offset,
    ),
  );
  const reviews = [];
  for (const row of rows) {
    const images = await all(
      query(
        env,
        "SELECT id,caption,source,width,height FROM review_images WHERE review_id=? AND approval_status='approved' AND upload_state='ready' AND permission_version!='' ORDER BY sort_order,id",
        row.id,
      ),
    );
    reviews.push({
      id: row.id,
      name: row.public_name || row.customer_name,
      rating: row.rating,
      text: row.public_text || row.review_text,
      edited: Boolean(row.public_text || row.public_name),
      category: row.service_category,
      categoryLabel:
        CATEGORIES.find((c) => c.id === row.service_category)?.name || "",
      date: row.published_at,
      project: row.linked_project_id,
      source: "Website Review",
      images: images.map((image) => ({
        id: image.id,
        caption: image.caption,
        source: image.source,
        width: image.width,
        height: image.height,
        url: `/api/reviews/images/${image.id}/960`,
        thumbnail: `/api/reviews/images/${image.id}/480`,
        full: `/api/reviews/images/${image.id}/1600`,
      })),
    });
  }
  return json({
    reviews,
    nextOffset: rows.length === limit ? offset + limit : null,
  });
}
async function imageResponse(env, id, size, admin) {
  const image = await query(
    env,
    `SELECT i.*,r.status,r.ingestion_state FROM review_images i JOIN reviews r ON r.id=i.review_id WHERE i.id=?`,
    id,
  ).first();
  if (
    !image ||
    image.upload_state !== "ready" ||
    image.approval_status === "removed" ||
    (!admin &&
      (image.status !== "approved" ||
        image.ingestion_state !== "ready" ||
        image.approval_status !== "approved" ||
        !image.permission_version))
  )
    throw new ReviewError("Photograph not found.", 404);
  const variant = await query(
    env,
    "SELECT storage_key FROM review_image_variants WHERE image_id=? AND size=?",
    id,
    Number(size),
  ).first();
  if (!variant) throw new ReviewError("Photograph not found.", 404);
  const object = await env.REVIEWS_MEDIA?.get(variant.storage_key);
  if (!object) throw new ReviewError("Photograph not found.", 404);
  return new Response(object.body, {
    headers: {
      ...headers,
      "Content-Type": "image/webp",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
async function adminDetails(env, id) {
  const row = await query(
    env,
    "SELECT * FROM reviews WHERE id=? AND ingestion_state='ready'",
    id,
  ).first();
  if (!row) throw new ReviewError("Review not found.", 404);
  // Never expose upload capabilities, IP hashes or deduplication hashes to the UI.
  const { request_key, payload_hash, ip_hash, ...review } = row;
  const images = await all(
    query(
      env,
      "SELECT id,source,caption,sort_order,approval_status,upload_state,permission_version,permission_timestamp,width,height FROM review_images WHERE review_id=? AND approval_status!='removed' ORDER BY sort_order,id",
      id,
    ),
  );
  const events = await all(
    query(
      env,
      "SELECT action,actor,notes,details_json,created_at FROM review_moderation_events WHERE review_id=? ORDER BY created_at DESC LIMIT 50",
      id,
    ),
  );
  const notification = await query(
    env,
    "SELECT state,attempts,last_error FROM review_notification_outbox WHERE review_id=?",
    id,
  ).first();
  return { review, images, events, notification };
}
async function moderate(request, env, id, actor) {
  const body = await readJSON(request),
    current = await query(
      env,
      "SELECT * FROM reviews WHERE id=? AND ingestion_state='ready'",
      id,
    ).first();
  if (!current) throw new ReviewError("Review not found.", 404);
  if (!Number.isInteger(body.version) || body.version !== current.version)
    throw new ReviewError("This review changed. Reload it before saving.", 409);
  const status = body.status;
  if (!["pending", "approved", "rejected", "hidden"].includes(status))
    throw new ReviewError("Choose a valid moderation state.");
  const notes = text(body.notes ?? "", 2000, false, true),
    publicText = text(body.publicText ?? "", 2000, false, true),
    publicName = text(body.publicName ?? "", 100),
    reason = text(body.redactionReason ?? "", 300);
  if ((publicText || publicName) && !reason)
    throw new ReviewError("Explain any public privacy or safety edit.");
  if (publicText && publicText.length < 20)
    throw new ReviewError(
      "Public review text must contain at least 20 characters.",
    );
  const project = body.project || null;
  if (project && !PROJECT_OPTIONS.some((p) => p.id === project))
    throw new ReviewError("Choose an existing project.");
  if (
    !Array.isArray(body.images) ||
    body.images.length > 10 ||
    new Set(body.images.map((i) => i.id)).size !== body.images.length
  )
    throw new ReviewError("Check the photographs.");
  const stored = await all(
    query(
      env,
      "SELECT id FROM review_images WHERE review_id=? AND approval_status!='removed'",
      id,
    ),
  );
  if (
    stored.length !== body.images.length ||
    stored.some((i) => !body.images.some((s) => s.id === i.id))
  )
    throw new ReviewError("Photographs changed. Reload before saving.", 409);
  const next = current.version + 1,
    now = Date.now(),
    statements = [
      query(
        env,
        `UPDATE reviews SET status=?,moderation_notes=?,public_text=?,public_name=?,redaction_reason=?,linked_project_id=?,published_at=CASE WHEN ?='approved' THEN COALESCE(published_at,?) ELSE published_at END,updated_at=?,version=version+1 WHERE id=? AND version=?`,
        status,
        notes,
        publicText || null,
        publicName || null,
        reason,
        project,
        status,
        now,
        now,
        id,
        current.version,
      ),
    ];
  for (const [order, image] of body.images.entries()) {
    if (!["pending", "approved", "removed"].includes(image.status))
      throw new ReviewError("Invalid photograph status.");
    statements.push(
      query(
        env,
        "UPDATE review_images SET approval_status=?,caption=?,sort_order=? WHERE id=? AND review_id=? AND (upload_state='ready' OR ?='removed') AND permission_version!=''",
        image.status,
        text(image.caption ?? "", 200),
        order,
        image.id,
        id,
        image.status,
      ),
    );
  }
  // Unique review/version event makes concurrent moderation batches roll back safely.
  statements.push(
    event(
      env,
      id,
      "moderation:" + status,
      actor,
      notes || reason,
      id + ":version:" + next,
      {
        from: current.status,
        to: status,
        project,
        publicEdit: Boolean(publicText || publicName),
        redactionReason: reason,
        photographs: body.images.map((image, order) => ({
          id: image.id,
          status: image.status,
          order,
          caption: text(image.caption ?? "", 200),
        })),
      },
    ),
  );
  let results;
  try {
    results = await env.REVIEWS_DB.batch(statements);
  } catch {
    throw new ReviewError("This review changed. Reload it before saving.", 409);
  }
  if (!changed(results[0]))
    throw new ReviewError("This review changed. Reload it before saving.", 409);
  return json({ ok: true, ...(await adminDetails(env, id)) });
}
export async function handleReviews(request, env, fetcher = fetch) {
  try {
    const url = new URL(request.url),
      path = url.pathname.replace(/\/$/, ""),
      method = request.method;
    if (url.origin !== env.SITE_ORIGIN)
      throw new ReviewError("This host is not allowed.", 403);
    if (path === "/api/reviews/config" && method === "GET")
      return json({
        enabled: Boolean(ready(env)),
        photosEnabled: Boolean(ready(env) && photos(env)),
        siteKey: ready(env) ? env.TURNSTILE_SITE_KEY : null,
        consentVersion: CONSENT_VERSION,
        categories: CATEGORIES,
      });
    if (!ready(env))
      throw new ReviewError(
        "Website reviews are not configured yet. Please contact info@hometechmayo.ie.",
        503,
      );
    if (!["GET", "POST", "PUT"].includes(method))
      throw new ReviewError("Method not allowed.", 405);
    if (method !== "GET" && !allowedOrigin(request, env))
      throw new ReviewError("This request origin is not allowed.", 403);
    if (path.startsWith("/api/reviews/admin")) {
      const actor = await authenticate(request, env, fetcher);
      if (
        method !== "GET" &&
        request.headers.get("X-Review-CSRF") !== actor.csrf
      )
        throw new ReviewError(
          "Reload administration before making changes.",
          403,
        );
      if (path === "/api/reviews/admin/session" && method === "GET")
        return json({
          csrf: actor.csrf,
          projects: PROJECT_OPTIONS,
          categories: CATEGORIES,
          consentVersion: CONSENT_VERSION,
          photosEnabled: Boolean(photos(env)),
        });
      if (path === "/api/reviews/admin" && method === "GET") {
        const status = url.searchParams.get("status") || "pending";
        if (!["pending", "approved", "rejected", "hidden"].includes(status))
          throw new ReviewError("Invalid status.");
        const offset = Math.max(
          0,
          Math.min(10000, Number(url.searchParams.get("offset")) || 0),
        );
        return json({
          reviews: await all(
            query(
              env,
              "SELECT id,customer_name,rating,created_at,status,version FROM reviews WHERE status=? AND ingestion_state='ready' ORDER BY created_at DESC LIMIT 30 OFFSET ?",
              status,
              offset,
            ),
          ),
          offset,
        });
      }
      let match = path.match(
        /^\/api\/reviews\/admin\/images\/([0-9a-f-]+)\/(480|960|1600)$/,
      );
      if (match && method === "GET")
        return await imageResponse(env, match[1], match[2], true);
      match = path.match(
        /^\/api\/reviews\/admin\/([0-9a-f-]+)(?:\/(photos)\/([0-9a-f-]+))?$/,
      );
      if (match) {
        if (match[2] && method === "PUT") {
          const row = await query(
            env,
            "SELECT * FROM reviews WHERE id=?",
            match[1],
          ).first();
          if (!row) throw new ReviewError("Review not found.", 404);
          return await upload(
            request,
            env,
            row,
            match[3],
            "business",
            actor.email,
          );
        }
        if (!match[2] && method === "GET")
          return json(await adminDetails(env, match[1]));
        if (!match[2] && method === "POST")
          return await moderate(request, env, match[1], actor.email);
      }
      throw new ReviewError("Administration route not found.", 404);
    }
    if (path === "/api/reviews" && method === "GET")
      return await publicList(request, env);
    if (path === "/api/reviews/submissions" && method === "POST")
      return await start(request, env, fetcher);
    let match = path.match(
      /^\/api\/reviews\/images\/([0-9a-f-]+)\/(480|960|1600)$/,
    );
    if (match && method === "GET")
      return await imageResponse(env, match[1], match[2], false);
    match = path.match(
      /^\/api\/reviews\/submissions\/([0-9a-f-]+)\/(photos|complete)(?:\/([0-9a-f-]+))?$/,
    );
    if (match) {
      const row = await uploadSession(request, env, match[1]);
      if (match[2] === "photos" && method === "PUT")
        return await upload(
          request,
          env,
          row,
          match[3],
          "customer",
          "customer",
        );
      if (match[2] === "complete" && method === "POST")
        return await finalize(env, row, fetcher);
    }
    throw new ReviewError("Route not found.", 404);
  } catch (error) {
    return json(
      {
        error:
          error instanceof ReviewError
            ? error.message
            : "Reviews are temporarily unavailable. Please try again later.",
      },
      error instanceof ReviewError ? error.status : 503,
    );
  }
}
export async function maintenance(env, fetcher = fetch) {
  if (!env.REVIEWS_DB) return;
  const now = Date.now();
  // Stuck sends are uncertain: do not automatically send a duplicate notification.
  await query(
    env,
    "UPDATE review_notification_outbox SET state='failed',last_error='Delivery uncertain; check Brevo before retrying.' WHERE state='sending' AND attempted_at<?",
    now - 3600000,
  ).run();
  const pending = await all(
    query(
      env,
      "SELECT review_id FROM review_notification_outbox WHERE state='pending' LIMIT 10",
    ),
  );
  for (const row of pending) await notify(env, row.review_id, fetcher);
  // Never erase the manifest if its private storage binding is unavailable.
  if (!env.REVIEWS_MEDIA) return;
  // Quarantine cleanup is bounded; never acts on quote guard or Q-SITE tables.
  const abandoned = await all(
    query(
      env,
      "SELECT id FROM reviews WHERE ingestion_state='uploading' AND upload_expires<? LIMIT 20",
      now - 86400000,
    ),
  );
  for (const row of abandoned) {
    if (env.REVIEWS_MEDIA) {
      for (const prefix of [`originals/${row.id}/`, `derivatives/${row.id}/`]) {
        const objects = await env.REVIEWS_MEDIA.list({ prefix, limit: 100 });
        for (const object of objects.objects)
          await env.REVIEWS_MEDIA.delete(object.key);
      }
    }
    await env.REVIEWS_DB.batch([
      query(
        env,
        "UPDATE review_usage SET used=MAX(0,used-COALESCE((SELECT SUM(reserved_bytes) FROM review_images WHERE review_id=?),0)) WHERE scope='storage'",
        row.id,
      ),
      query(
        env,
        "DELETE FROM reviews WHERE id=? AND ingestion_state='uploading'",
        row.id,
      ),
    ]);
  }
  // Remove objects for removed photos and stale interrupted uploads, including partial writes.
  const removed = await all(
    query(
      env,
      "SELECT id,review_id,reserved_bytes FROM review_images WHERE approval_status='removed' OR (upload_state='uploading' AND created_at<?) LIMIT 30",
      now - 86400000,
    ),
  );
  for (const image of removed) {
    if (!env.REVIEWS_MEDIA) continue;
    for (const prefix of [
      `originals/${image.review_id}/${image.id}`,
      `derivatives/${image.review_id}/${image.id}/`,
    ]) {
      const objects = await env.REVIEWS_MEDIA.list({ prefix, limit: 10 });
      for (const object of objects.objects)
        await env.REVIEWS_MEDIA.delete(object.key);
    }
    await env.REVIEWS_DB.batch([
      query(
        env,
        "UPDATE review_usage SET used=MAX(0,used-?) WHERE scope='storage'",
        image.reserved_bytes,
      ),
      query(env, "DELETE FROM review_images WHERE id=?", image.id),
    ]);
  }
  await query(
    env,
    "UPDATE reviews SET ip_hash=NULL WHERE created_at<? AND ip_hash IS NOT NULL",
    now - 86400000,
  ).run();
  // Longer retention policy must be approved before rollout. Off by default.
  if (env.REVIEWS_RETENTION_ENABLED === "true") {
    const expired = await all(
      query(
        env,
        "SELECT id FROM reviews WHERE (status='rejected' AND updated_at<?) OR (status='pending' AND ingestion_state='ready' AND created_at<?) LIMIT 20",
        now - 30 * 86400000,
        now - 90 * 86400000,
      ),
    );
    for (const row of expired) {
      if (env.REVIEWS_MEDIA) {
        for (const prefix of [
          `originals/${row.id}/`,
          `derivatives/${row.id}/`,
        ]) {
          const objects = await env.REVIEWS_MEDIA.list({ prefix, limit: 100 });
          for (const object of objects.objects)
            await env.REVIEWS_MEDIA.delete(object.key);
        }
      }
      await env.REVIEWS_DB.batch([
        query(
          env,
          "UPDATE review_usage SET used=MAX(0,used-COALESCE((SELECT SUM(reserved_bytes) FROM review_images WHERE review_id=?),0)) WHERE scope='storage'",
          row.id,
        ),
        query(env, "DELETE FROM reviews WHERE id=?", row.id),
      ]);
    }
    await query(
      env,
      "UPDATE reviews SET customer_email='' WHERE ingestion_state='ready' AND updated_at<?",
      now - 90 * 86400000,
    ).run();
    const originals = await all(
      query(
        env,
        "SELECT id,storage_key FROM review_images WHERE storage_key IS NOT NULL AND created_at<? LIMIT 30",
        now - 30 * 86400000,
      ),
    );
    for (const image of originals) {
      if (!env.REVIEWS_MEDIA) continue;
      await env.REVIEWS_MEDIA.delete(image.storage_key);
      await query(
        env,
        "UPDATE review_images SET storage_key=NULL WHERE id=?",
        image.id,
      ).run();
    }
  }
}
export default {
  fetch: handleReviews,
  scheduled(controller, env, ctx) {
    ctx.waitUntil(maintenance(env));
  },
};
