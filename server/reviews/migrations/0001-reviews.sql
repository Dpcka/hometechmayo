-- Apply only to the NEW hometech-reviews database. Never quote guard or HBM.
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS reviews (
 id TEXT PRIMARY KEY, request_key TEXT NOT NULL UNIQUE, payload_hash TEXT NOT NULL,
 ip_hash TEXT, customer_name TEXT NOT NULL, customer_email TEXT NOT NULL DEFAULT '',
 rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5), review_text TEXT NOT NULL CHECK(length(review_text) BETWEEN 20 AND 2000),
 service_category TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','hidden')),
 ingestion_state TEXT NOT NULL DEFAULT 'uploading' CHECK(ingestion_state IN ('uploading','ready')),
 expected_photos INTEGER NOT NULL CHECK(expected_photos BETWEEN 0 AND 5),
 created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, published_at INTEGER,
 consent_version TEXT NOT NULL, consent_timestamp INTEGER NOT NULL,
 photo_consent INTEGER NOT NULL CHECK(photo_consent IN (0,1)),
 linked_project_id TEXT, public_text TEXT, public_name TEXT, redaction_reason TEXT NOT NULL DEFAULT '',
 moderation_notes TEXT NOT NULL DEFAULT '', version INTEGER NOT NULL DEFAULT 0,
 upload_expires INTEGER NOT NULL,
 CHECK(linked_project_id IS NULL OR linked_project_id IN ('bathroom-ventilation','furniture-assembly','wayfair-console-table'))
);
CREATE INDEX IF NOT EXISTS reviews_status_date ON reviews(status,ingestion_state,published_at DESC,id);
CREATE INDEX IF NOT EXISTS reviews_ip_time ON reviews(ip_hash,created_at);
CREATE INDEX IF NOT EXISTS reviews_payload_time ON reviews(payload_hash,created_at);
CREATE INDEX IF NOT EXISTS reviews_project ON reviews(linked_project_id,status);
CREATE TABLE IF NOT EXISTS review_consents (
 id TEXT PRIMARY KEY, review_id TEXT NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
 kind TEXT NOT NULL CHECK(kind IN ('review','photos')), version TEXT NOT NULL, recorded_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS review_images (
 id TEXT PRIMARY KEY, review_id TEXT NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
 storage_key TEXT, source TEXT NOT NULL CHECK(source IN ('customer','business')),
 caption TEXT NOT NULL DEFAULT '', sort_order INTEGER NOT NULL DEFAULT 0,
 approval_status TEXT NOT NULL DEFAULT 'pending' CHECK(approval_status IN ('pending','approved','removed')),
 upload_state TEXT NOT NULL DEFAULT 'uploading' CHECK(upload_state IN ('uploading','ready')),
 permission_version TEXT NOT NULL, permission_timestamp INTEGER NOT NULL,
 permission_actor TEXT NOT NULL, created_at INTEGER NOT NULL, width INTEGER, height INTEGER,
 reserved_bytes INTEGER NOT NULL DEFAULT 0 CHECK(reserved_bytes >= 0),
 UNIQUE(review_id,id)
);
CREATE INDEX IF NOT EXISTS review_images_parent ON review_images(review_id,approval_status,sort_order);
CREATE TABLE IF NOT EXISTS review_image_variants (
 image_id TEXT NOT NULL REFERENCES review_images(id) ON DELETE CASCADE,
 size INTEGER NOT NULL CHECK(size IN (480,960,1600)), storage_key TEXT NOT NULL UNIQUE,
 PRIMARY KEY(image_id,size)
);
CREATE TABLE IF NOT EXISTS review_moderation_events (
 id TEXT PRIMARY KEY, review_id TEXT NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
 action TEXT NOT NULL, actor TEXT NOT NULL, notes TEXT NOT NULL DEFAULT '',
 details_json TEXT NOT NULL DEFAULT '{}', created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS review_events_parent ON review_moderation_events(review_id,created_at);
CREATE TABLE IF NOT EXISTS review_notification_outbox (
 review_id TEXT PRIMARY KEY REFERENCES reviews(id) ON DELETE CASCADE,
 state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','sending','sent','failed')),
 attempts INTEGER NOT NULL DEFAULT 0, attempted_at INTEGER, sent_at INTEGER, last_error TEXT
);
-- All quotas are local to Reviews; no interaction with quote tables.
CREATE TABLE IF NOT EXISTS review_usage (
 scope TEXT PRIMARY KEY, used INTEGER NOT NULL DEFAULT 0
);
