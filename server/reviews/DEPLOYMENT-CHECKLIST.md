# Reviews controlled production deployment checklist

Prepared 8 November 2026. This document is a plan, not permission to execute it.
No migrations, resource creation, policy changes, secrets writes or deployment
were performed in this preparation.

## Validated target and configuration

- Account: 88a3bbca56a32fed76f3806d1176acc1.
- Existing D1: hometech-reviews, ID 4fc2e7dc-31f4-4110-b8d5-335b69101235.
  0001-reviews.sql and 0002-retention.sql are already applied. Do not re-run them.
- Existing private R2: hometech-review-media, jurisdiction eu.
- Worker name hometech-reviews, main server/reviews/worker.mjs. No existing Worker.
- Prepared deployment config: ignored work/reviews-production-preparation.json.
  The tracked wrangler.example.jsonc is a template, not a production config.
- Compatibility date 2026-10-18 retained; workers_dev=false, preview_urls=false,
  no routes/custom domains. Bind REVIEWS_DB, REVIEWS_MEDIA (jurisdiction eu), IMAGES.
- The public TURNSTILE_SITE_KEY was copied from the existing Pages text variable;
  it is not a secret. Do not print or copy its matching secret from runtime.
- Access issuer and audience match the existing protected application.
  REVIEWS_ADMIN_EMAILS is a JSON array containing exactly the two approved owner
  addresses, kept in ignored config. Set the identical array on Pages and Worker.
  The old singular variable is not used as a fallback; absent/invalid plural config
  fails closed. Do not add aliases, wildcards, third addresses or domain-wide rules.
- All four feature flags remain false. triggers.crons=[]; no scheduled trigger.
- Cleanup also fails closed in code: cleanReviewData returns before any database
  or R2 access unless retention is exactly the string true. Disabled notification
  maintenance also performs no outbox writes/sends. Scheduled handler is a no-op
  when both maintenance flags are disabled, even if accidentally invoked.

## Required manual secret handling

Cloudflare secret storage is write-only through supported settings/API: existing
Pages encrypted values cannot be exported for reuse. Do not add diagnostic routes,
log env, inspect credential files, or temporarily decrypt secrets for transfer.
No secret value belongs in this config, source, a command argument, chat or preview.

Owner supplies these Worker secrets privately from an existing secure source:
- TURNSTILE_SECRET_KEY: existing approved widget secret (Cloudflare widget settings).
- BREVO_API_KEY: original saved verified Brevo credential. If the original value
  was not retained, stop for an owner-managed key decision; do not rotate or overwrite
  the working Pages quote credential. A separate key may be considered only if approved.

REVIEWS_HASH_SECRET is currently absent in Pages and Worker. Owner generates ONE
cryptographically random value, at least 32 characters (prefer 32 random bytes),
saves it in a password manager and enters that SAME value encrypted into both.
Never generate independently for each target, reuse QUOTE_HASH_SECRET or overwrite
an existing Reviews value. Check secret-name lists first. If one target already
contains it and the owner cannot supply its saved value, stop rather than generate
another value. Only names/presence may appear in verification output.

Wrangler secret put creates/deploys a Worker version; it is a production change,
not a harmless inspection command. Secret input must be interactive/private or
through a reviewed no-log stdin mechanism, never literal values in CLI arguments.
Do not use secret put, versions secret, bulk updates or Pages secret writes now.

## Exact recommended execution order — after separate approval

1. Recheck main/production SHA, account, existing resources and Access policy.
   Preserve any intervening changes. No duplicate D1, bucket or Worker.
2. In Access application hometechmayo.ie, reusable policy Home Tech Reviews Owner,
   KEEP BOTH existing approved email addresses unchanged. Verify there are exactly
   those two email selectors and no Bypass/broad rules. Preserve all three
   destinations, existing IdP and other protections. No policy edit is required.
   Do not alter account membership or weaken authentication.
3. Verify ignored config against Dashboard. Keep workers_dev/preview false, routes
   absent, crons empty, flags false. Keep current D1 schema. Run tests and dry-run:

   npm test
   npx wrangler deploy --dry-run --config work/reviews-production-preparation.json
   npx wrangler pages functions build --outdir work/reviews-pages-build

4. Deploy the private Worker, only when approved:

   npx wrangler deploy --config work/reviews-production-preparation.json

   This creates only the named Worker and references existing D1/R2. It does not
   apply migrations. Missing auth secret keeps APIs fail-closed during setup.
   Check deployment output maps R2 to EU and no public endpoints/Cron are created.
5. Worker > Settings > Variables and Secrets: check prepared variables, add encrypted
   REVIEWS_HASH_SECRET with the single owner-held value. Add owner-supplied Turnstile
   and Brevo secrets privately without replacing any existing names. Inspect only
   names/types afterward. No notifications or submissions are enabled.
6. Pages hometechmayo > Settings > Variables and Secrets > Production: add
   ACCESS_TEAM_DOMAIN, ACCESS_AUD and REVIEWS_ADMIN_EMAILS from verified private config.
   Add encrypted REVIEWS_HASH_SECRET using the SAME owner-held value. Preserve all
   QUOTE_* variables, QUOTE_GUARD, SITE_ORIGIN, existing Brevo/Turnstile credentials.
7. Pages > Settings > Bindings > Add > Service binding (Production):
   REVIEWS_SERVICE -> hometech-reviews. Save without replacing unrelated bindings.
8. Pages > Deployments > Retry the approved latest main production deployment.
   Binding/env changes apply to a new deployment. Do not connect preview to live
   review data. Check direct Pages deployment URLs fail closed without owner JWT.
9. Verify read-only: /api/reviews/config returns 200 with enabled=false and
   photosEnabled=false. Access challenges all three admin route patterns. Owner
   login with EACH approved identity yields /admin/session and /admin/readiness
   JSON and the private list loads; every other identity is denied. Check readiness schema/auth/bindings. Do not create reviews.
10. Home/Pricing/quote return 200, quote-config enabled=true. Confirm no quote code,
    quote database, secret or binding changes. No quote POST, photos or real emails.
    Do not add Cron or enable any feature flag in this deployment window.

## Safety / remaining gates

Infrastructure and encrypted secret entry can be executed without displaying
secret values. Actual deployment still requires separate approval and the owner's
private secret provisioning. The original Pages values cannot be recovered through
an ordinary read-only audit. Until these are supplied, functional acceptance of
owner admin APIs remains blocked. Public reviews and cleanup stay disabled.

Missing production Worker logs/traces and real Free CPU headroom should be reviewed
before a later public activation; do not enable additional logging of customer
payloads or paid features silently.

References:
https://developers.cloudflare.com/pages/functions/bindings/#service-bindings
https://developers.cloudflare.com/pages/functions/bindings/#secrets
https://developers.cloudflare.com/r2/reference/data-location/#using-jurisdictions-from-workers


## Optional photograph launch — 13 November 2026

- Preserve notification=false, retention=false, Cron=[], private Worker URLs.
- Confirm existing EU REVIEWS_MEDIA bucket has r2.dev disabled and no custom
  domains. Wrangler read-only r2 bucket dev-url get / domain list with -J eu can
  verify this if MCP lacks permissions. Check bucket info and D1 review_usage
  storage before launch; retain 512 MiB / 3,000 monthly transformation limits.
- Manual Remove photograph + Save now revokes publication before physical R2
  deletion. Failures return 503, retain hidden manifest/quota, and require owner
  reload/save retry. A success clears object references and reservation; no Cron
  or enabled retention is needed. Retention holds must be reviewed separately.
- Deploy tested Worker code with photos=false first. Deploy updated privacy page
  and admin UI through main/Pages. Verify the public notice before photos=true.
- Verify public config, optional photo selector and unchecked permission, maximum
  5 photos / 10 MB, responsive gallery and protected administration. Do not create
  real production tests/reviews or upload synthetic customer photos.
- Monthly manual operations cover R2 originals, derivatives, unfinished uploads,
  expiry, withdrawal and failed deletion retries: see MANUAL-RETENTION.md.
- Application tests use local SQLite/R2 and image decoding with mocked email and
  Turnstile. A controlled real customer submission remains an owner action;
  do not claim production image ingestion has been exercised by smoke checks.
