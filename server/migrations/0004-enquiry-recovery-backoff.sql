-- Additive recovery scheduling; no payload deletion or numbering changes.
ALTER TABLE website_enquiries ADD COLUMN recovery_attempt_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE website_enquiries ADD COLUMN recovery_next_attempt_at INTEGER;
ALTER TABLE website_enquiries ADD COLUMN recovery_error_code TEXT;
CREATE INDEX enquiry_capture_recovery_due ON website_enquiries(source_id,state,recovery_next_attempt_at,received_at);
