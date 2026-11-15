# Isolated staging runbook - no production activation

## Current blocker
Connected Cloudflare account can be listed, but POST D1 database was denied missing d1.write (HTTP 401). No staging D1 exists from this work. Reconnect with approved D1 Write and Worker edit scopes, or have the owner provision resources. Never paste credentials into chat. Do not substitute existing production D1/bindings or use production mail credentials.

## Isolation gates before any remote write
1. New unique D1 name hbm-intake-stage-<date>-<suffix>, new Worker name; verify fresh UUID and empty schema. Record name/UUID privately. Account match alone is insufficient.
2. Standalone config copied to ignored work/; no inheritance from Pages/Reviews/production configs; no routes/domains/service bindings except new staging D1. Set database_id explicitly: a placeholder must never auto-provision or fall back to production.
3. Generate independent AES keys and HMAC secret through approved secure provisioning; no production key reuse. Use separate source ID. Recipients and sender must be reserved example.invalid addresses. Do not load .env/.dev.vars from production.
4. Use an isolated MOCK provider service with hard egress denial. Current scheduled Worker uses actual Brevo transport; do NOT enable email on remote scheduled config until a reviewed mock-service adapter exists. The committed tests/intake-runtime-harness.mjs is LOCAL ONLY and must not be exposed as a public remote API. These gates prevent an unsafe "staging" run just to claim coverage.

## Staging migration procedure after authorization and gates
Use installed Wrangler with an explicit ignored staging config on every command. First list/show the NEW D1 and verify its UUID against that config. Run only against that explicit new database:
- server/quote-guard.sql
- server/migrations/0001-website-quote-numbering.sql
- server/migrations/0002-website-enquiry-storage.sql
- server/migrations/0003-enquiry-lease-safety.sql
- server/migrations/0004-enquiry-recovery-backoff.sql
Command form: wrangler d1 execute <NEW_STAGING_DATABASE_NAME> --remote --config work/<STAGING_CONFIG>.jsonc --file <ONE_FILE_ABOVE>. Record each successful stage; do not rerun additive ALTER scripts blindly. Do not execute any Supabase/Reviews migration.

Deploy only a newly named staging Worker after inspection of its full resolved bindings. Default dispatcher and email switches remain false, crons empty, workers_dev/preview URLs false. Re-read resolved settings to prove isolation; do not enable a production hostname. Remote provider-mock harness/access protection remains a prerequisite, not something this runbook pretends was provisioned.

## Local actual runtime (performed)
Use Node 24+ and installed Miniflare 5.20261113.0-beta. Set HBM_MINIFLARE_MODULE to its absolute dist/src/index.js path, then npm test. The runtime test explicitly constructs all modules, ephemeral d1Persist=false database and an outbound service denying external network. Applies all schemas only inside isolated local D1. All generated requests/keys are synthetic. Without HBM_MINIFLARE_MODULE the runtime test explicitly skips; do not describe a skipped run as runtime validation.

## Acceptance matrix for future remote staging
Verify batch rollback; two concurrent dispatchers/inline handler; duplicate and changed request; crash before/after numbering; crash before network and after provider commit; 429 delta/date Retry-After; ambiguous 5xx; ciphertext/semantic corruption; historical key present/missing; key rotation; canonical states; HBM always pending; flags disabled/enabled; restart and rollback preserving counts/UUID/reference. Compare provider-mock commit count to DELIVERED/NEEDS_REVIEW state. Test retained receipt after 24h guard cleanup. No real contacts permitted.

## Rollback and cleanup
Pause dispatcher first, retain capture and compatible receipt reads. Snapshot staging D1 before/after rehearsal. Do not delete uncertain jobs or reset numbers. Before any future production rollout require remote staging evidence, privacy notice/key recovery, need-review monitoring and explicit production approval. Production must remain unchanged throughout this phase.
