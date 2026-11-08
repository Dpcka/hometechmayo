// Reviews-only retention. No quote guard/Q-SITE dependencies.
const DAY = 86400000;
const query = (env, sql, ...args) => env.REVIEWS_DB.prepare(sql).bind(...args);
const all = async (statement) => (await statement.all()).results;
export function auditCutoff(now) {
  const current = new Date(now),
    day = current.getUTCDate();
  current.setUTCDate(1);
  current.setUTCMonth(current.getUTCMonth() - 12);
  const last = new Date(
    Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + 1, 0),
  ).getUTCDate();
  current.setUTCDate(Math.min(day, last));
  return current.getTime();
}
async function claim(env, id, now, reason = "") {
  const condition =
    reason === "rejected"
      ? " AND status='rejected' AND rejected_at<=?"
      : reason === "abandoned"
        ? " AND ingestion_state='uploading' AND created_at<=?"
        : "";
  const extra = reason ? [now - (reason === "rejected" ? 90 : 1) * DAY] : [];
  const result = await query(
    env,
    `UPDATE reviews SET retention_deleting=1,retention_deleting_at=?
  WHERE id=? AND retention_hold=0 AND retention_deleting=0
  AND NOT EXISTS(SELECT 1 FROM review_images WHERE review_id=? AND upload_state='uploading' AND created_at>?)${condition}`,
    now,
    id,
    id,
    now - 3600000,
    ...extra,
  ).run();
  return Number(result.meta?.changes || 0) > 0;
}
async function release(env, id) {
  await query(
    env,
    "UPDATE reviews SET retention_deleting=0,retention_deleting_at=NULL WHERE id=?",
    id,
  ).run();
}
async function removeReview(env, id, now, reason) {
  if (!(await claim(env, id, now, reason))) return;
  try {
    // Delete private objects before losing their manifest. A partial failure keeps
    // the database record and conservative quota reservation for a later retry.
    for (const prefix of [`originals/${id}/`, `derivatives/${id}/`]) {
      let cursor;
      do {
        const page = await env.REVIEWS_MEDIA.list({
          prefix,
          limit: 100,
          cursor,
        });
        for (const object of page.objects)
          await env.REVIEWS_MEDIA.delete(object.key);
        cursor = page.truncated ? page.cursor : undefined;
      } while (cursor);
    }
    await env.REVIEWS_DB.batch([
      query(
        env,
        `INSERT OR IGNORE INTO review_moderation_archive(id,review_id,action,actor,notes,details_json,created_at)
    SELECT id,review_id,action,actor,notes,details_json,created_at FROM review_moderation_events WHERE review_id=? AND created_at>?`,
        id,
        auditCutoff(now),
      ),
      query(
        env,
        "UPDATE review_usage SET used=MAX(0,used-COALESCE((SELECT SUM(reserved_bytes) FROM review_images WHERE review_id=?),0)) WHERE scope='storage'",
        id,
      ),
      query(
        env,
        "DELETE FROM reviews WHERE id=? AND retention_hold=0 AND retention_deleting=1",
        id,
      ),
    ]);
  } finally {
    await release(env, id);
  }
}
export async function cleanReviewData(env, now = Date.now()) {
  // One candidate per cleanup queue per invocation keeps Free CPU/subrequest
  // usage bounded. Monitor overdue counts; never upgrade the plan automatically.
  const enabled = env.REVIEWS_RETENTION_ENABLED === "true";
  await query(
    env,
    "UPDATE reviews SET retention_deleting=0,retention_deleting_at=NULL WHERE retention_deleting=1 AND retention_deleting_at<?",
    now - 3600000,
  ).run();
  if (enabled)
    await env.REVIEWS_DB.batch([
      query(
        env,
        "DELETE FROM review_moderation_events WHERE created_at<=?",
        auditCutoff(now),
      ),
      query(
        env,
        "DELETE FROM review_moderation_archive WHERE created_at<=?",
        auditCutoff(now),
      ),
    ]);
  if (!env.REVIEWS_MEDIA) return;
  const abandoned = await all(
    query(
      env,
      "SELECT id FROM reviews WHERE ingestion_state='uploading' AND created_at<=? AND retention_hold=0 LIMIT 1",
      now - DAY,
    ),
  );
  for (const row of abandoned)
    await removeReview(env, row.id, now, "abandoned");
  const removed = await all(
    query(
      env,
      `SELECT i.id,i.review_id,i.reserved_bytes FROM review_images i JOIN reviews r ON r.id=i.review_id
  WHERE r.retention_hold=0 AND (i.approval_status='removed' OR (i.upload_state='uploading' AND i.created_at<=?)) LIMIT 1`,
      now - DAY,
    ),
  );
  for (const image of removed) {
    if (!(await claim(env, image.review_id, now))) continue;
    try {
      for (const prefix of [
        `originals/${image.review_id}/${image.id}`,
        `derivatives/${image.review_id}/${image.id}/`,
      ]) {
        const page = await env.REVIEWS_MEDIA.list({ prefix, limit: 20 });
        for (const object of page.objects)
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
    } finally {
      await release(env, image.review_id);
    }
  }
  await query(
    env,
    "UPDATE reviews SET ip_hash=NULL WHERE created_at<=? AND ip_hash IS NOT NULL",
    now - DAY,
  ).run();
  if (!enabled) return;
  const rejected = await all(
    query(
      env,
      "SELECT id FROM reviews WHERE status='rejected' AND retention_hold=0 AND rejected_at IS NOT NULL AND rejected_at<=? LIMIT 1",
      now - 90 * DAY,
    ),
  );
  for (const row of rejected) await removeReview(env, row.id, now, "rejected");
  // Original retention begins at actual authoritative publication, never upload.
  const originals = await all(
    query(
      env,
      `SELECT i.id,i.review_id,i.storage_key FROM review_images i JOIN reviews r ON r.id=i.review_id
  WHERE i.storage_key IS NOT NULL AND i.published_at IS NOT NULL AND i.published_at<=? AND r.retention_hold=0
  AND (SELECT COUNT(*) FROM review_image_variants v WHERE v.image_id=i.id)=3 LIMIT 1`,
      now - 30 * DAY,
    ),
  );
  for (const image of originals) {
    if (!(await claim(env, image.review_id, now))) continue;
    try {
      await env.REVIEWS_MEDIA.delete(image.storage_key);
      await query(
        env,
        "UPDATE review_images SET storage_key=NULL WHERE id=?",
        image.id,
      ).run();
    } finally {
      await release(env, image.review_id);
    }
  }
  // Approved reviews never auto-expire. Pending, hidden and optional email
  // retention need an additional owner decision; do not invent a deletion period.
}
