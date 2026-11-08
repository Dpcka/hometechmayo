-- Reviews database ONLY. Additive change; preserves all existing review records.
-- Apply after 0001-reviews.sql. Never apply to quote guard or HBM.
ALTER TABLE reviews ADD COLUMN retention_deleting INTEGER NOT NULL DEFAULT 0 CHECK(retention_deleting IN (0,1));
ALTER TABLE reviews ADD COLUMN retention_deleting_at INTEGER;
ALTER TABLE reviews ADD COLUMN rejected_at INTEGER;
ALTER TABLE reviews ADD COLUMN retention_hold INTEGER NOT NULL DEFAULT 0 CHECK(retention_hold IN (0,1));
ALTER TABLE reviews ADD COLUMN retention_hold_reason TEXT NOT NULL DEFAULT '';
ALTER TABLE reviews ADD COLUMN retention_hold_at INTEGER;
ALTER TABLE reviews ADD COLUMN publication_reviewed_at INTEGER;
ALTER TABLE reviews ADD COLUMN publication_review_due_at INTEGER;
ALTER TABLE review_images ADD COLUMN published_at INTEGER;
CREATE INDEX IF NOT EXISTS reviews_rejected_retention ON reviews(status,retention_hold,rejected_at);
CREATE INDEX IF NOT EXISTS reviews_publication_review ON reviews(status,publication_review_due_at);
CREATE INDEX IF NOT EXISTS review_images_publication_retention ON review_images(published_at);
-- Rejected records keep their known last-modified date, not an invented rejection date.
UPDATE reviews SET rejected_at=updated_at WHERE status='rejected' AND rejected_at IS NULL;
-- Existing approved images deliberately retain NULL publication time until an owner
-- confirms them again; do not infer publication from upload time or delete early.
-- Archive survives parent deletion, so 90-day review cleanup does not erase a
-- moderation action before its 12-month retention window. Private admin access only.
CREATE TABLE IF NOT EXISTS review_moderation_archive (
 id TEXT PRIMARY KEY, review_id TEXT NOT NULL, action TEXT NOT NULL, actor TEXT NOT NULL,
 notes TEXT NOT NULL DEFAULT '', details_json TEXT NOT NULL DEFAULT '{}', created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS review_archive_date ON review_moderation_archive(created_at);
CREATE INDEX IF NOT EXISTS review_archive_parent ON review_moderation_archive(review_id,created_at);

-- Reject a moderation transaction while private objects are being removed. This
-- makes accepting a dispute hold and starting deletion mutually exclusive.
CREATE TRIGGER IF NOT EXISTS review_moderation_retention_lock
BEFORE INSERT ON review_moderation_events
WHEN EXISTS(SELECT 1 FROM reviews WHERE id=NEW.review_id AND retention_deleting=1)
BEGIN SELECT RAISE(ABORT,'Retention operation in progress; retry moderation'); END;
