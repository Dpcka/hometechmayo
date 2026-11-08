import { administratorEmails } from "./auth.mjs";
// Read-only checks. Never returns secret values, customer records or private keys.
const required = {
  reviews: [
    "id",
    "status",
    "retention_hold",
    "retention_hold_reason",
    "rejected_at",
    "publication_review_due_at",
    "retention_deleting",
  ],
  review_images: [
    "id",
    "review_id",
    "published_at",
    "permission_version",
    "reserved_bytes",
  ],
  review_consents: ["review_id", "kind", "version", "recorded_at"],
  review_image_variants: ["image_id", "size", "storage_key"],
  review_moderation_events: [
    "review_id",
    "action",
    "details_json",
    "created_at",
  ],
  review_moderation_archive: ["review_id", "action", "created_at"],
  review_notification_outbox: ["review_id", "state"],
  review_usage: ["scope", "used"],
};
export async function reviewReadiness(env) {
  const missing = [];
  let schema = false;
  try {
    for (const [table, columns] of Object.entries(required)) {
      const result = await env.REVIEWS_DB.prepare(
        `PRAGMA table_info(${table})`,
      ).all();
      const names = new Set(result.results.map((row) => row.name));
      for (const column of columns)
        if (!names.has(column)) missing.push(table + "." + column);
    }
    const trigger = await env.REVIEWS_DB.prepare(
      "SELECT name FROM sqlite_master WHERE type='trigger' AND name='review_moderation_retention_lock'",
    ).first();
    if (!trigger) missing.push("review_moderation_retention_lock");
    schema = missing.length === 0;
  } catch {
    missing.push("Reviews database unavailable");
  }
  const auth = Boolean(
    /^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(
      env.ACCESS_TEAM_DOMAIN || "",
    ) &&
    env.ACCESS_AUD &&
    env.ACCESS_AUD !== "REPLACE" &&
    administratorEmails(env).length === 2 &&
    env.REVIEWS_HASH_SECRET?.length >= 32,
  );
  const bindings = {
    database: Boolean(env.REVIEWS_DB),
    privateMedia: Boolean(env.REVIEWS_MEDIA),
    images: Boolean(env.IMAGES),
  };
  const transforms = Number(env.REVIEWS_TRANSFORM_BUDGET || 3000),
    storage = Number(env.REVIEWS_STORAGE_BUDGET_BYTES || 536870912);
  const limits =
    Number.isInteger(transforms) &&
    transforms >= 3 &&
    transforms <= 3000 &&
    Number.isInteger(storage) &&
    storage >= 16777216 &&
    storage <= 536870912;
  return {
    schema,
    missing,
    bindings,
    authenticationConfigured: auth,
    turnstileConfigured: Boolean(
      env.TURNSTILE_SITE_KEY && env.TURNSTILE_SECRET_KEY,
    ),
    notificationConfigured: Boolean(
      env.BREVO_API_KEY &&
      (env.REVIEWS_FROM_EMAIL || env.QUOTE_FROM_EMAIL) &&
      (env.REVIEWS_TO_EMAIL || env.QUOTE_TO_EMAIL),
    ),
    limitsValid: limits,
    switches: {
      submissions: env.REVIEWS_ENABLED === "true",
      photos: env.REVIEWS_PHOTOS_ENABLED === "true",
      notifications: env.REVIEWS_NOTIFICATIONS_ENABLED === "true",
      retention: env.REVIEWS_RETENTION_ENABLED === "true",
    },
    accountEntitlementsVerified: false,
    resourcePermissionsVerified: false,
    note: "Binding presence and schema only. Verify account plan, exact resource mapping, private R2 policy and real Access configuration separately before rollout.",
  };
}
