# Website Reviews — Stage 3A preparation, NOT deployed

Public URL after rollout: https://hometechmayo.ie/reviews
Owner URL after rollout: https://hometechmayo.ie/admin/reviews

Stage 3A created the separate EU D1 hometech-reviews and applied migrations 0001
and 0002, including migration tracking. It contains no reviews. No R2 subscription,
Access activation, Worker/public deployment, real review, email or push was performed.
All tests remain synthetic and local. Quote guard, Q-SITE and HBM are independent.

## Architecture and deployment units

Static Pages HTML/modules -> `/api/reviews/*` Pages proxy -> `REVIEWS_SERVICE`
service binding -> dedicated Reviews Worker. The Worker owns its NEW D1, private
R2, Images binding, review-only abuse protection, Brevo notification outbox and
hourly maintenance. Do not route `/api/quote` through this Worker.

Existing GitHub -> Pages deployment does NOT deploy this additional Worker.
Stage 3 must explicitly deploy the Worker, configure Pages service binding, then
publish Pages. The included Wrangler file is an example with nonfunctional IDs,
all feature switches OFF, and no credentials. If copying the config to work/,
adjust main to ../server/reviews/worker.mjs and migrations_dir to
../server/reviews/migrations relative to that copied file. Do not run it as a production deploy.

`_routes.json` adds `/admin/*` so Pages middleware protects the static owner page.
Both page middleware and Worker API validate Access JWT signatures server-side.
`workers.dev`/preview URLs must remain disabled for the production Worker.

## Stage 3 configuration checklist — requires explicit owner approval

1. Confirm account remains Workers Free / Images Free. Never purchase Images
   storage, upgrade Workers, or enable a paid plan automatically.
2. Create NEW D1 `hometech-reviews`; bind it ONLY to the Reviews Worker as
   `REVIEWS_DB`. Apply `migrations/0001-reviews.sql` and `migrations/0002-retention.sql` to this database, never to
   `hometech-quote-guard`, any HBM database or Supabase. Migration is additive,
   foreign keys enabled, no ALTER/DROP/UPDATE of existing quote tables.
3. Create private R2 bucket `hometech-review-media`, preferably EU jurisdiction
   where available and appropriate to the owner's data-processing setup. Disable
   r2.dev and custom public domains. Bind `REVIEWS_MEDIA` to the Worker. No public
   bucket URLs, browser R2 tokens or direct browser access. Use separate test
   resources if preview environments are enabled; never connect previews to live
   reviews storage.
4. Add Worker Images binding `IMAGES`. Confirm Free transformations in the account.
   Images Free includes 5,000 unique transformations/month; over-limit requests
   fail rather than incur transformation overages. Review defaults reserve 3,000
   transformations/month (3 WebP sizes per photo), hard capped at 3,000 in code. Other
   account usage shares the provider quota. API info/decode and real output errors
   fail closed. Transform once, save WebP in R2; never transform on public reads.
5. Cloudflare Access self-hosted application: protect BOTH
   `hometechmayo.ie/admin/*` and `hometechmayo.ie/api/reviews/admin*`. Use the same
   application audience for both paths, exact owner email allowlist, and owner
   Google/other IdP with MFA. Do not add a public Bypass policy. Confirm free user
   allowance in the account. Verify HTML `.html` variants are protected too.
6. Set the following on BOTH Pages and the Worker:
   `ACCESS_TEAM_DOMAIN=https://YOUR-TEAM.cloudflareaccess.com`, `ACCESS_AUD`,
   `REVIEWS_ADMIN_EMAILS` (JSON array of exactly two approved owner emails), secret `REVIEWS_HASH_SECRET` (random >=32 characters).
   Pages needs these for page middleware, Worker for API auth and CSRF.
7. Worker-only variables: `SITE_ORIGIN=https://hometechmayo.ie`,
   `TURNSTILE_SITE_KEY`, `REVIEWS_FROM_EMAIL=info@hometechmayo.ie`,
   `REVIEWS_TO_EMAIL=info@hometechmayo.ie`, `REVIEWS_TRANSFORM_BUDGET=3000`,
   optionally `REVIEWS_STORAGE_BUDGET_BYTES` (cannot exceed 512 MiB in this release).
   Worker secrets: `TURNSTILE_SECRET_KEY`, `BREVO_API_KEY`, plus the shared Reviews
   hash secret above. Reuse existing verified Brevo sender/key and Turnstile widget
   if its hostname policy permits production. Secrets do NOT automatically carry
   across from Pages to a Worker; configure explicitly, never copy into Git.
   Existing QUOTE_* configuration and quote action must remain unchanged.
8. Pages service binding: `REVIEWS_SERVICE` -> `hometech-reviews` Worker.
   Keep `REVIEWS_ENABLED=false`, `REVIEWS_PHOTOS_ENABLED=false`,
   `REVIEWS_NOTIFICATIONS_ENABLED=false` and `REVIEWS_RETENTION_ENABLED=false`
   until the separately approved rollout. Notifications have their own kill switch.
9. Keep `triggers.crons=[]` during controlled preparation. All cleanup is gated by
   `REVIEWS_RETENTION_ENABLED=true`; disabled retention performs no cleanup writes,
   including unfinished uploads and removed photos. Notification maintenance is
   independently gated by `REVIEWS_NOTIFICATIONS_ENABLED=true`. Schedule `17 * * * *`
   only after separate cleanup approval. Never apply Reviews cleanup to quote guard.
10. Validate Access, private R2, transformations and server-side permissions using
    isolated staging data. Then enable `REVIEWS_ENABLED=true`; enable photos only
    after real binding validation. These switches do not enable anything paid.
11. Production testing needs separate approval: do not invent public reviews or
    send real emails automatically. Owner should perform a controlled real review
    only after approving activation. Do not fabricate successful email delivery.

## Free-plan suitability and limits

Verified against Cloudflare documentation on 19 October 2026:

- https://developers.cloudflare.com/images/pricing/
- https://developers.cloudflare.com/images/optimization/binding/
- https://developers.cloudflare.com/pages/functions/bindings/
- https://developers.cloudflare.com/r2/pricing/
- https://developers.cloudflare.com/d1/platform/pricing/

Images binding is Worker-specific, supports private raw byte streams and works in
local Wrangler without paid remote processing. Local binding was tested, not only
mocked. The correct account dashboard confirms Workers Free and Images Free (0 of 5,000
transformations used in the current period). R2 and Access still need activation;
see STAGE3A.md. A live Images binding has not yet been provisioned or tested. Workers Free CPU/request limits still apply;
production-like staging tests must verify headroom, especially JWT and uploads.
No native Sharp dependency is shipped to Workers. Sharp is existing local tooling
and the offline test decoder only.

D1, Workers and Access have plan allowances; R2 can incur storage/operation costs
outside its allowance. No blanket zero-cost guarantee: account-wide traffic and
other products share allowances. An application storage reservation caps Reviews
objects conservatively at 512 MiB (reserves 16 MiB per photo, max 32 simultaneous
stored photos by default). Lower it if necessary. Removed/expired photos release
reservations after physical deletion. Reservation remains conservative after
original deletion; it may block uploads before actual storage is full. This is a
safety limit, not a billing hard cap. Configure usage alerts and check billing
before activating R2. Rate limits and provider Free caps can return safe errors.

If Images is unavailable on the account or Free CPU is unsuitable: keep photo
uploads OFF; text reviews work independently. Safe alternative to propose before
implementation is a trusted local Sharp processing workflow plus authenticated
import of verified derivatives, or a reviewed bounded WASM decoder. Never publish
raw uploads, rely on client-only validation, or upgrade automatically.

## Submission, images and reliability

- Name/rating/text/consent required; optional private email/category. Text 20–2000.
- Review consent and separate photo permission recorded with version/time.
- New rows pending; ingestion uploading until all expected photos are complete.
- Max 5 customer photos, 10 active photos total after owner additions.
- One file/request <=10 MiB, JPEG/PNG/WebP actual signature AND decoder format,
  <=40MP and <=12,000px per side. Decode/re-encode through Images, flatten animation,
  WebP outputs <=2 MiB each. The public derivatives contain only image chunks,
  stripping EXIF/GPS/XMP/ICC and other ancillary chunks. Never serve originals.
- Originals/derivatives both private. Public image handler checks approved parent,
  approved ready image and recorded permission every time; no-store to avoid
  stale public caches after hiding. Downloaded third-party copies cannot be recalled.
- Upload IDs random UUIDs; one-hour HMAC capabilities grant upload/finalize only,
  not read or moderation. Tokens stay in memory/headers, not URLs/localStorage.
- Five starts/IP/hour with atomic SQL quota, HMAC IP/deduplication values. IP hash
  discarded after 24h by maintenance. Same request ID resumes; payload mismatch
  conflicts; duplicate payload within 24h blocked. Refresh during a partial upload
  loses browser session; unfinished data stays private and is cleaned later.
- No D1/R2 cross-system transaction exists. Reserve slots, store private objects,
  commit manifest, compensate failures; scheduled sweep retries private orphans.
- Public success only after review finalization. Email failure does not lose the
  review. Outbox records failed/uncertain acceptance. Uncertain sends are NOT
  automatically retried, preventing repeated owner messages. Owner can inspect
  delivery in Brevo; a retry UI is not included in this release. No customer emails.

## Moderation and privacy

Owner mobile UI supports states, full originals, notes, permission-aware photo
approval/removal/captions/order, up to 10 photos, explicit existing project linkage
and public preview. Versioned writes and unique audit events prevent stale saves.
No rating-dependent auto rejection. Originals immutable; public privacy/safety
redactions require a reason and display an editing notice. Source label Website
Review; Bark/Google text is not imported. Homepage displays at most 3 approved
website reviews. Project associations use explicit existing public project IDs,
never name inference; existing project images/carousels are unchanged.

Approved retention defaults (privacy notice remains a rollout draft): incomplete
uploads 24 hours from creation; rejected reviews 90 days from rejection unless an
active dispute/investigation hold applies; private originals 30 days after the
image is successfully published with approved derivatives, unless held. Audit
logs are retained for 12 calendar months, including in a private archive after a
review is deleted. Published reviews are not automatically deleted; a private
90-day assessment reminder supports periodic review and withdrawal requests.
Pending completed reviews, hidden reviews and private email retention still need
an explicit owner decision before rollout; no invented automatic deadline applies.

The mobile admin supports reasoned retention holds and a publication-review queue.
Cleanup claims a review before deleting objects, blocks competing moderation,
preserves manifests when R2 fails and retries later. Each hourly queue processes
one candidate to bound Free CPU/subrequests; monitor overdue cleanup and test
headroom before activation. Retention deadlines are eligibility thresholds for
the next successful sweep, not a guaranteed deletion SLA under outages/backlogs.
Hiding immediately revokes public access; photo removal schedules physical deletion.
Contact correction/removal requests via info@hometechmayo.ie. No automatic HBM creation.

Review data never goes to GA. Existing analytics consent/lead logic is unchanged.
New /reviews and admin do not load the analytics/consent entry point; no optional
tracking is added to these pages. The public footer links to the existing Privacy
page and its cookie settings, which continue to manage the same saved preference.
The existing consent and analytics modules remain unmodified. Existing privacy text
was corrected to describe actual consent-gated GA4; no new tracking enabled.

## Local validation

`npm test` includes real SQLite-backed backend tests and all existing regressions.
`node scripts/test-reviews-browser.mjs` uses Playwright (install separately or set
`PLAYWRIGHT_MODULE` to its import URL), Edge by default (`BROWSER_CHANNEL` override),
localhost only, temporary in-memory DB/R2, mocked Access JWKS/Turnstile/Brevo, real
Sharp decoding. `REVIEWS_SCREENSHOTS` sets output; default ignored work/ directory.
Never use real account keys or real review data in this harness.

Pages: `npx wrangler pages functions build --outdir work/reviews-pages-build`.
Worker: `npx wrangler deploy --dry-run --config server/reviews/wrangler.example.jsonc`.
These compile only; do not replace dry-run with deployment without approval.
The local D1 migration has also been applied through Wrangler `--local`.
There is no npm production build script in this static project.

## Stage 2 validation record

- Existing 84 regression tests preserved; 28 new Reviews tests pass (112 total).
- Local browser checks: public/homepage at 360, 390, 768, 1280 px; owner UI at
  390 and 1280 px, including upload, order, approval, public preview, keyboard and
  touch gallery navigation. No page errors or horizontal overflow.
- Actual local Wrangler Images binding decoded a PNG and generated all 3 WebP
  variants; production account capability remains to be verified before rollout.
- Fresh local Wrangler D1 migration applied successfully. SQLite tests exercise
  constraints, competing writes and visibility rules.
- Pages Functions compilation and Worker dry-run bundling pass.
- No production requests, emails, resources or deployments performed.

## Stage 3A validation record

126 automated tests pass, including all existing regressions and 14 added retention/
readiness cases. Local browser checks pass at 360/390/768/1280px (admin 390/1280),
without page errors; Brevo, Access and Turnstile are mocked. Local Wrangler applied
both migrations. See [STAGE3A.md](STAGE3A.md) for actual infrastructure findings,
approval gates and the Stage 3B no-go checklist. Stage 2 records above are historical.

## Controlled preparation — 8 November 2026

See [DEPLOYMENT-CHECKLIST.md](DEPLOYMENT-CHECKLIST.md). The prepared R2 binding
uses EU jurisdiction, Cron is absent, and every feature switch remains false.
Both approved owner addresses remain in the existing Access policy. Pages and
Worker use the same REVIEWS_ADMIN_EMAILS JSON array of exactly those two emails.
JWT verification, issuer/audience/expiry, exact email membership, Origin and CSRF
remain mandatory. All other addresses are denied; malformed configuration fails closed.
No production policy/settings/secrets were changed in this preparation.
