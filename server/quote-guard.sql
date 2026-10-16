-- Run ONLY against a NEW, dedicated Cloudflare D1 database for website spam
-- protection. Never execute against HBM/Supabase. No enquiry content is stored.
CREATE TABLE IF NOT EXISTS quote_guard (
  request_key TEXT PRIMARY KEY,
  payload_hash TEXT NOT NULL UNIQUE,
  ip_hash TEXT NOT NULL,
  reference TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'sent')),
  ack INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS quote_guard_ip_time ON quote_guard(ip_hash, created_at);
CREATE INDEX IF NOT EXISTS quote_guard_time ON quote_guard(created_at);
