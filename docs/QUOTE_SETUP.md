# Quote calculator deployment and operations

## Current implementation

The existing GitHub-connected Cloudflare Pages site serves the calculator in
`quote.html` (Pricing links to preselected categories). The owner approved
publishing the three-step/cart redesign and cookie consent on 16 October 2026,
with GA4 collection disabled. Pages auto-discovers `functions/api/quote.js` and
`functions/api/quote-config.js`. `_routes.json` includes only `/api/*`; existing
public page URLs, metadata and SEO are unchanged. No new package dependencies
or website framework are required.

The browser and endpoint import `js/pricing-catalogue.mjs`. Money is integer
cents and discounts are rounded once to cents. All established prices are
starting estimates. The owner's 16 October rules override historic handyman
rates. Other rates come from the pre-existing pricing page; unestablished prices
are Custom Quote. Catalogue entries explicitly identify their source, pricing
kind and discount eligibility. Unknown option/material prices never become
fabricated numbers. A Custom Quote bundle replaces its standard labour and
priced add-ons, preventing double charging. Packages and hourly handyman cannot
be selected together; additional hours belong in the package's own option.

This calculator estimates ONE visit. Additional visits require separate labour
minimums and travel. Labour has a €50 minimum after discount if known labour is
selected. Custom-only work has no invented labour amount; the €50 minimum is
stated as a quotation condition. No unknown material costs enter the total.

## Required Cloudflare configuration

No credentials were available during implementation. Do not paste secrets into
chat, files or Git. Use Workers & Pages -> existing Pages project -> Settings ->
Variables and Secrets / Bindings. Configure production and preview separately.

| Name | Type | Value/purpose |
| --- | --- | --- |
| `BREVO_API_KEY` | Secret | A Brevo transactional API key, NOT the SMTP password |
| `TURNSTILE_SECRET_KEY` | Secret | Secret for the configured Turnstile widget |
| `QUOTE_HASH_SECRET` | Secret | At least 32 random bytes; stable across deployments, used for HMAC fingerprints |
| `TURNSTILE_SITE_KEY` | Plain variable | Public Turnstile site key (the only key returned to the browser) |
| `QUOTE_FROM_EMAIL` | Plain variable | Verified Brevo sender on the authenticated business domain, e.g. `info@hometechmayo.ie` |
| `QUOTE_FROM_NAME` | Plain variable, optional | `Home Tech Solutions & Services` |
| `QUOTE_TO_EMAIL` | Plain variable | `info@hometechmayo.ie`; use an owned test inbox for previews |
| `SITE_ORIGIN` | Plain variable | `https://hometechmayo.ie` (no trailing slash); use the exact owned preview origin for previews |
| `QUOTE_GUARD` | D1 binding | NEW dedicated website anti-abuse database, described below |

Do not change existing MX/SPF/DKIM/DMARC or Brevo SMTP settings for this feature.
Verify that the chosen sender is authorized and transactional sending is enabled
in Brevo. Existing Cloudflare Email Routing forwards business requests to Gmail.
Customer acknowledgement is sent only when email is provided. The customer
address is Reply-To for business mail, never the From address.

1. Create a Turnstile widget in the Cloudflare dashboard. Allow the production
   hostname (and exact owned preview/test hostnames as needed). The form uses
   action `quote`; the server checks both action and hostname with Siteverify.
2. Create a NEW Cloudflare D1 database named, for example,
   `hometech-quote-guard`. This is a separate Cloudflare resource, NOT Supabase
   and NOT HBM. Do not run any SQL against an existing customer database.
3. Initialize only that new database with `server/quote-guard.sql` using the D1
   console, or the following Wrangler command after authenticating locally:

   ```powershell
   npx wrangler@4 d1 execute hometech-quote-guard --remote --file=server/quote-guard.sql
   ```

4. Bind that database to the existing Pages project as `QUOTE_GUARD`. Use a
   different new D1 database for previews; initialize it with the same SQL.
5. Set the variables/secrets above in the corresponding Pages environment.
6. Verify that the existing Pages Git configuration deploys `main`, includes
   the root `functions/` directory and serves the root static files. Preserve
   the existing working build/output settings rather than guessing replacements.
7. Redeploy after setting bindings/variables. A Git push alone cannot create
   account secrets, a D1 binding or a Turnstile widget.
8. Check `/api/quote-config`: `enabled` should be true, the public site key should
   be present, and no secret should appear. Missing configuration fails closed
   (disabled form and HTTP 503), leaving estimates and direct contact usable.
   This check confirms configuration presence, not provider connectivity or SQL
   initialization; perform the live checks below.

For local integration testing, use ignored `.dev.vars` for development-only
values and a local D1 binding with Wrangler Pages dev. Never use production
HBM credentials or production customer data. Pure pricing/endpoint tests do
not require Cloudflare credentials or live network requests.

## Submission safety and delivery semantics

- POST only, same-origin, JSON only, 32 KiB request limit, strict server field
  lengths, quantities/options and catalogue version validation.
- Server-calculated amounts; client totals, prices and labels are ignored.
- Required name, phone, area, services and privacy agreement. Email optional
  but validated. Phone/Eircode format checked; header control characters rejected.
- Turnstile server verification, honeypot and dedicated D1 abuse protection.
- D1 atomically reserves a keyed request ID and unique normalized fingerprint;
  same-payload duplicates are blocked for 24 hours. Maximum five new submissions
  per IP/hour across isolates. Request/IP hashes use a secret HMAC key.
- Only hashes, reference, timestamps and delivery state are stored in D1, not
  enquiry text/contact fields. Expired rows are deleted on the next accepted
  verification/submission attempt; during inactivity rows persist until then.
  Periodic operational cleanup can run `DELETE FROM quote_guard WHERE
  created_at < <current Unix time in milliseconds minus 86400000>` in this
  dedicated database only. Mailbox retention remains normal business policy.
- Brevo receives plain-text email with a unique reference, all form fields and
  itemised authoritative estimate. No user content enters HTML email or subject.
- Success requires Brevo HTTP success AND a message ID for the business email.
  This confirms provider acceptance, not inbox delivery. Check Brevo logs/Gmail
  to verify actual delivery. No fabricated successful submission on API failure.
- If acknowledgement fails after business acceptance, the request remains
  successful and the browser explicitly reports the missing acknowledgement.
  An acknowledgement is never retried by resending the business email.
- Network timeouts can leave delivery uncertain. The reserved reference is kept
  pending and further attempts are blocked rather than risking duplicate mail.
  Staff must check Brevo delivery logs using that reference before advising a
  customer to resend. There is no automatic retry queue or exactly-once guarantee
  across the external email provider. Do not delete pending rows to retry blindly.
- Rotating the hash secret invalidates duplicate/IP tracking for existing rows;
  avoid rotation during in-flight delivery. Separate preview from production.
- No logs of customer payloads or provider error bodies; no public integration
  with HBM/Supabase. Future adapters must be separately designed and approved.

## Verification before enabling public submission

1. Run `npm test` on Node.js 24+. Tests use the real pricing module, real SQLite
   constraints for D1 SQL and mocked Turnstile/Brevo responses. No live mail is sent.
2. Optional browser regression: with the current local files served on
   `http://127.0.0.1:8788`, installed Microsoft Edge, and Playwright available
   outside the website dependencies, run `node tests/browser.cjs`. Set
   `PLAYWRIGHT_MODULE` to its absolute module path if it is not globally
   resolvable. The preview must serve `.mjs` as JavaScript and return
   `{"enabled":false,"version":"2026-10-16.1"}` for `/api/quote-config`.
   Browser tests exercise all 17 category links, the three-step workflow, retained
   selections and validation. They mock enabled config, Turnstile and quote
   responses and never send email.
3. In an owned preview, test Android-sized viewport, desktop/tablet, keyboard-only
   controls, service search, quantities, removal, material choices and incomplete
   totals. Check console errors and horizontal overflow.
4. Verify €40 -> €50, Westport -> €60; tiers at 5/6/11 eligible units; add-ons,
   packages, materials and travel exclusions; unknown/custom costs; hourly and
   package interactions. Per-row source and option scopes must remain consistent.
5. Send a real request to an owned test inbox, once without an email and once
   with an owned email. Confirm the business itemisation/reference, Reply-To,
   forwarding to Gmail and optional acknowledgement in Brevo delivery logs.
6. Test invalid consent, bad phone/email, expired token, provider failure, missing
   key, repeated click/retry, duplicate payload and rate limiting. The same browser
   request ID is retained during retries. Uncertain references must not be resent.
7. Enable production only after provider settings and actual delivery are verified.

## Pricing maintenance

Never invent missing catalogue prices. Update `VERSION` whenever prices/rules
change so stale browser submissions cannot silently use changed rates. Keep
published tables and service descriptions consistent with approved rates. Do
not add excluded services, automatically substitute day packages, discount
unknown materials or wire this public form to HBM production tables.

Provider references: [Pages bindings](https://developers.cloudflare.com/pages/functions/bindings/),
[Turnstile validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/),
[Brevo transactional API](https://developers.brevo.com/reference/send-transac-email).

## Redesign price audit (16 October 2026)

All 32 entries in the six existing Starting Prices cards were compared against
the unchanged authoritative calculator catalogue or minimum labour rule. No
numeric price discrepancies were found. The TV label previously said 75 inches+
while the catalogue prices 66–75 inches at €110 and over 75 inches as Custom
Quote; the label now says over 75 inches, following the catalogue boundary.

The existing broad label “Complex or multi-job visits” remains Quote required;
it has no standalone fixed-price catalogue item. Bracket supply, custom services
and unconfirmed materials remain unpriced. PC troubleshooting still appears in
the Wi-Fi starting-price table at the matching €50 rate; the calculator locates
it in Computer & Laptop Repair, and the table now provides a direct service
category link. No rate, service ID, discount flag or restriction was changed.

The email API, Turnstile action, environment variables and separate D1 binding
are unchanged. This redesign adds no secrets, schema or Supabase integration.
Live email delivery is still not verified and must not be inferred from mocked
UI/API tests. New page route: `quote.html?category=furniture`, served by Pages
as a static page. Legacy `pricing#quote-calculator` fragments redirect locally
to the dedicated quote page when JavaScript is enabled.
