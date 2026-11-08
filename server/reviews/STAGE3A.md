# Reviews — Stage 3A readiness, 19 October 2026

## Actual account findings

The correct production account was inspected through the Cloudflare dashboard.
Workers Free is the current plan: 100,000 requests/day, 10 ms CPU/request,
5 Cron triggers. D1 Free allowances shown are 5 million rows read/day,
100,000 rows written/day and 5 GB storage. Quotas are shared with existing services.
Images Free shows 0/5,000 transformations used. Keep the application cap at 3,000.
Do not enable zone URL transformations: the private Worker byte-stream binding
is the intended integration, with derivatives stored once in R2.

Created separate EU database `hometech-reviews`:
`4fc2e7dc-31f4-4110-b8d5-335b69101235`.
Applied 0001-reviews.sql and 0002-retention.sql and recorded both in d1_migrations.
Eight review tables, eight review retention columns, an image publication timestamp
and the cleanup coordination trigger are present. No review records exist.
Never apply these migrations to hometech-quote-guard. Do not reapply ALTER statements
manually: use the existing migration tracking.

R2 is not subscribed. Its checkout requires accepting a recurring usage-billed
subscription, although the base/due-now amount is $0. No subscription was accepted.
Access is not activated. Free offers 50 seats, but this account's checkout requires
a payment method, terms and authorization for charges above free limits. Checkout
was exited without submitting these agreements. No Access application/policy exists.
The owner explicitly confirmed the admin email in this conversation; use that exact
address, not the different production-account login. Keep the address in private config.

## Owner actions / explicit approval gates

1. Owner reviews and accepts R2 subscription and billing terms if acceptable.
   Free Standard allowance: 10 GB-month storage, 1 million Class A and 10 million
   Class B operations. Above allowance: $0.015/GB-month, $4.50/million A,
   $0.36/million B. App storage cap 512 MiB is NOT a billing hard cap.
   Create private hometech-review-media; no public domain or r2.dev access.
2. Owner completes Access Free payment/terms steps if acceptable. No paid upgrade.
   Configure team and IdP with MFA, then approve the exact owner-only Allow policy
   protecting /admin/* and /api/reviews/admin*, including HTML variants. No Bypass.
   Record team domain and application audience privately. Access grants must be
   explicitly confirmed at the action. Do not grant account membership as a workaround.
3. Authorize CLI privately using normal Cloudflare login; the CLI is not currently
   authenticated. Never paste credentials into chat. Deploy the dedicated Worker
   only during an explicitly approved rollout; workers.dev and previews stay disabled.
4. Bind REVIEWS_DB to the new database, REVIEWS_MEDIA to private R2 and IMAGES
   to the Worker. Configure Pages REVIEWS_SERVICE service binding only after the
   private Worker exists. Existing Pages quote bindings/variables remain unchanged.
5. Configure shared Reviews hash secret (32+ random characters), Access audience,
   team and owner allowlist on Pages and Worker. Worker additionally needs Turnstile
   site/secret keys, Brevo key, SITE_ORIGIN and review sender/recipient addresses.
   Follow README.md names exactly. Secrets do not transfer automatically from Pages.
6. Keep all four feature switches false until approved; notification switch prevents
   real sends even with Brevo credentials. Configure hourly Cron 17 * * * * only for
   the approved Worker rollout. Cleanup touches only Reviews resources.
7. Approve remaining retention decisions for completed pending/hidden submissions
   and private email; publish final privacy notice after approval. Existing approved
   defaults are implemented in migration 0002 and retention.mjs, including holds.

## Stage 3B go/no-go

NO-GO for public activation today. R2 subscription, Access setup, Worker, production
bindings/secrets and real permission/CPU validation remain incomplete. No resources
requiring financial acceptance were activated. No public deployment or push occurred.

Before GO: validate Access denial and allowed owner access; JWT/CSRF; private pending
images; real Images transformations and quota errors; D1/R2 binding permissions;
cleanup retry/holds and bounded backlog; Free CPU headroom on JWT/uploads/Cron;
shared quota impact on quote service; disabled notification/submission switches.
Authenticated /api/reviews/admin/readiness reports schema/config presence without
secrets, but does not prove account entitlements or actual resource permissions.
Use isolated synthetic staging data. No fake production reviews or real email tests.
Review final diff and rerun all regressions/builds before separately approved rollout.

## Cost and alternative

No paid plan was activated. Workers/D1/Images remain Free with hard provider limits.
R2 billing acceptance and Access checkout are owner gates, not assumed free of risk.
If these terms or Free CPU are unsuitable, keep submissions/photos disabled and
propose a trusted local image-processing workflow or another approved architecture.
Never publish raw unmoderated uploads or silently upgrade services.

Sources: https://developers.cloudflare.com/images/pricing/ ;
https://developers.cloudflare.com/r2/pricing/ ;
https://developers.cloudflare.com/d1/platform/pricing/ ;
https://developers.cloudflare.com/workers/platform/limits/
