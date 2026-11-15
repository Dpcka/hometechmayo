-- Additive: dedicated website Quote Guard D1 only. Never HBM/Supabase/Reviews.
-- No dependency on quote_guard: its 24h cleanup must not delete enquiries.
CREATE TABLE website_enquiries (
 request_key TEXT PRIMARY KEY, source_id TEXT NOT NULL, payload_hash TEXT NOT NULL,
 schema_version INTEGER NOT NULL CHECK(schema_version=1), encrypted_payload TEXT NOT NULL,
 key_version TEXT NOT NULL, received_at INTEGER NOT NULL, internal_reference TEXT NOT NULL,
 external_reference TEXT UNIQUE, state TEXT NOT NULL CHECK(state IN ('RECEIVED','NUMBERED')),
 UNIQUE(source_id,request_key)
);
CREATE TABLE enquiry_outbox (
 id TEXT PRIMARY KEY, request_key TEXT NOT NULL REFERENCES website_enquiries(request_key),
 destination TEXT NOT NULL CHECK(destination IN ('HBM','BUSINESS_EMAIL','CUSTOMER_ACK')),
 state TEXT NOT NULL DEFAULT 'READY' CHECK(state IN ('READY','SENDING','SENT','UNCERTAIN','RETRY_WAIT','NEEDS_REVIEW')),
 attempt_count INTEGER NOT NULL DEFAULT 0, next_attempt_at INTEGER, lease_token TEXT,
 created_at INTEGER NOT NULL, delivered_at INTEGER, last_error_code TEXT,
 UNIQUE(request_key,destination)
);
CREATE INDEX enquiry_outbox_due ON enquiry_outbox(state,next_attempt_at);
CREATE TABLE enquiry_delivery_attempts (
 id TEXT PRIMARY KEY, outbox_id TEXT NOT NULL REFERENCES enquiry_outbox(id),
 started_at INTEGER NOT NULL, finished_at INTEGER,
 outcome TEXT CHECK(outcome IN ('ACCEPTED','UNCERTAIN')), error_code TEXT
);
CREATE TABLE enquiry_receipts (
 source_id TEXT NOT NULL, request_key TEXT NOT NULL, payload_hash TEXT NOT NULL,
 external_reference TEXT, received_at INTEGER NOT NULL, PRIMARY KEY(source_id,request_key)
);
