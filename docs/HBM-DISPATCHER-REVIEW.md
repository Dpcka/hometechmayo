# PR01-04 review and dispatch record - 15 November 2026

## Review findings resolved in their respective branches
PR01: recovery lacked envelope identity/schema validation; services now use authoritative normalized estimate lines. Added trust-boundary validation without logging values.
PR02: claim/attempt were separate transactions, leases never expired, final acknowledgements lacked expiry/state fencing, and conflicting finalization could overwrite a receipt before throwing. Added 0003 (additive canonical delivery_state, lease_until, send_started_at, remote_receipt), atomic claim+attempt, guarded ACK and reference receipt mapping. Legacy state remains for compatible rollback. Retained old key versions decrypt authenticated source/request/version envelopes.
PR03: feature OFF could bypass durable receipts after guard cleanup; recovered payload was not domain checked; inline network send had no durable start marker. Fixed with durable-profile rollback reads, fail-closed new intake when capture is paused, envelope validation and fenced send/ACK. The crash test was retargeted to ACK SQL after claim SQL changed; no failed test was committed.

Q-SITE allocator, pricing catalogue and email templates remain byte-unchanged. Existing guard receipts are never reconstructed as full payloads. Old HMAC identity secret must remain stable; AES key rotation is independent. Never remove an old decrypt key while any retained payload or backup uses it. Privacy notice version must be pinned before production activation.

## PR04 states and delivery guarantees
Canonical delivery_state: READY, LEASED, RETRY_WAIT, DELIVERED, NEEDS_REVIEW. Legacy state mirrors canonical state for reviewed inline-handler compatibility. No table is rebuilt or dropped. D1 is the durable authority. Claim and attempt insertion share one D1 batch, leases last 120s, provider calls have 12s timeout, stale ACKs are fenced. Provider message ID is required for DELIVERED. HBM is intentionally not processed; no Inbox receipt protocol exists.

Expired pre-send lease retries; expired post-start lease needs review. Missing credentials and explicit 429 use exponential backoff/jitter, respecting Retry-After and bounded attempts. Connection failure, timeout, ambiguous 5xx or missing provider receipt are NEEDS_REVIEW, not blind resend. This sacrifices automatic email completion where exactly-once cannot be proven, while preserving the enquiry and operator evidence. Failed/uncertain email cannot truthfully be called DELIVERED. Acknowledgement is independent but waits for business delivery. No provider error bodies, recipients, payloads, keys or tokens are logged. Scheduled logs contain aggregate counts and allow-listed codes only.

RECEIVED captures are repaired independently of browser retry using saved estimate/version (no repricing). Per-capture backoff prevents corrupt/key-unavailable records monopolizing the first recovery batch. Need-review payloads are never deleted. There is no automatic operator reconciliation endpoint; manual review must verify provider outcome and the old sender has ceased before requeueing.

Disable INTAKE_DISPATCHER_ENABLED to stop all dispatcher binding/network work, without stopping inline capture. Disable only INTAKE_DISPATCHER_EMAIL_ENABLED to pause mail but keep capture repair. QUOTE_DURABLE_ENABLED=false with durable profile retained reads receipts and pauses NEW intake (503); it is not a traffic-preserving rollback. Keep durable capture on for normal rollout/rollback. Never roll back to an old email-only binary or unset the source profile on an activated dataset. Do not reset counters, purge outbox or downgrade applied schemas.

## Validation and staging status
17 dispatcher unit/integration tests initially passed. Local real workerd via installed Miniflare 5.20261113.0-beta passed D1 batch rollback, parallel dispatch, stale leases, timeout after simulated provider commit, 429, encryption, rotation, disabled flags, abandoned capture repair and inline rollback. External network is blocked and provider calls are mocked. This is LOCAL runtime evidence, not remote staging evidence.

Remote isolated D1 creation was attempted through the connected Cloudflare API and rejected HTTP 401: missing d1.write scope. No D1 was created, no remote migration or Worker deployment performed. No alternate credential path used to bypass the denied scope. Remote staging remains blocked until the connection has appropriate authorization or an owner provisions the isolated resources.

Final verification: npm test with HBM_MINIFLARE_MODULE enabled: 200 passed, 0 failed, 0 skipped. This includes 19 dispatcher tests and one multi-scenario actual local workerd/D1 test. No remote staging success is claimed.
