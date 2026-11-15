-- Additive companion state: legacy state retained for old handlers and rollback.
ALTER TABLE enquiry_outbox ADD COLUMN delivery_state TEXT NOT NULL DEFAULT 'READY' CHECK(delivery_state IN ('READY','LEASED','RETRY_WAIT','DELIVERED','NEEDS_REVIEW'));
ALTER TABLE enquiry_outbox ADD COLUMN lease_until INTEGER;
ALTER TABLE enquiry_outbox ADD COLUMN send_started_at INTEGER;
ALTER TABLE enquiry_outbox ADD COLUMN remote_receipt TEXT;
UPDATE enquiry_outbox SET delivery_state=CASE WHEN state='SENT' THEN 'DELIVERED' WHEN state IN ('SENDING','UNCERTAIN','NEEDS_REVIEW') THEN 'NEEDS_REVIEW' WHEN state='RETRY_WAIT' THEN 'RETRY_WAIT' ELSE 'READY' END;
CREATE INDEX enquiry_delivery_due ON enquiry_outbox(delivery_state,next_attempt_at,lease_until);
