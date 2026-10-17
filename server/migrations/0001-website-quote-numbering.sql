-- Additive migration for the existing dedicated hometech-quote-guard D1 ONLY.
-- No ALTER, UPDATE, DELETE or replacement of existing quote_guard records.
-- Run before enabling QUOTE_SITE_NUMBERING_ENABLED=true.
CREATE TABLE IF NOT EXISTS quote_reference_counters (
  year INTEGER PRIMARY KEY CHECK (year BETWEEN 1 AND 9999),
  last_sequence INTEGER NOT NULL CHECK (last_sequence >= 1)
);

CREATE TABLE IF NOT EXISTS quote_public_references (
  request_key TEXT PRIMARY KEY REFERENCES quote_guard(request_key) ON DELETE CASCADE,
  public_reference TEXT NOT NULL UNIQUE,
  year INTEGER NOT NULL,
  sequence INTEGER NOT NULL CHECK (sequence >= 1),
  accepted_at INTEGER NOT NULL,
  UNIQUE (year, sequence)
);
-- D1 enforces foreign keys. Existing 24h guard cleanup also removes its public
-- mapping. Year counters persist, so previously issued numbers are never reused.
