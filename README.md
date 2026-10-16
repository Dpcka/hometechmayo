# Home Tech Mayo

Production website for **Home Tech Solutions & Services**, serving County Mayo,
Ireland. This is the existing production repository; maintain it in place.

- Website: https://hometechmayo.ie
- Repository: https://github.com/Dpcka/hometechmayo
- Local project: `E:\HTSS\Home Tech\27 Site\hometechmayo`
- Hosting: Cloudflare Pages, deployed from GitHub.
- Contact: info@hometechmayo.ie | 083 349 8496 (+353 83 349 8496)
- WhatsApp: https://wa.me/353833498496

See [PROJECT.md](PROJECT.md) for architecture, business context, development rules
and future integration plans. Current source was reviewed on 16 October 2026;
provider settings described as owner-confirmed were not independently audited.

## Website architecture

Static HTML, shared `css/style.css`, vanilla `js/main.js` and local `assets/`.
No framework, CMS or HBM connection is implemented. The dedicated quote page has a shared browser/server pricing engine and Pages
Functions for email requests; Pricing provides category links and starting prices.
A dedicated Cloudflare D1 binding stores anti-abuse metadata only. Node.js runs
image maintenance and tests; `sharp` remains the only package dependency.

| File | Purpose |
| --- | --- |
| `index.html` | Home, About, services, recent projects, reviews, FAQ and contact |
| `services.html` | Furniture Assembly, TV Wall Mounting, Ventilation, Wi-Fi & Networking, Smart Home and General Handyman |
| `pricing.html` | Compact starting-price cards and links to all 17 quote categories |
| `quote.html` | Three-step services / estimate / email quote wizard (noindex utility page) |
| `privacy.html` | Privacy policy |
| `404.html` | Custom noindex error page |

About, Projects and Contact are homepage anchors, not standalone pages.
Implemented features include responsive navigation, scrolling header behavior,
back-to-top, entrance animations, accessible FAQ controls, a reviews carousel,
WhatsApp links/widget and automatic footer year. Reviews are maintained in HTML,
not loaded from Google. Google Fonts supplies Poppins and Inter.

## Local maintenance and deployment

Use the existing checkout:

```powershell
Set-Location 'E:\HTSS\Home Tech\27 Site\hometechmayo'
git status --short --branch
```

The local branch at review is `main`, tracking `origin/main`. Cloudflare Pages
is connected to GitHub. Production branch, build command, output directory and
preview/environment settings must be verified in the Cloudflare dashboard;
they are not recorded in repository configuration.

There are no tracked GitHub Actions workflows or production Wrangler settings.
Pages Functions in `functions/api/` serve `/api/quote` and `/api/quote-config`;
`_routes.json` limits dynamic routing to `/api/*`. `npm test` runs pricing and
endpoint tests using Node.js 24 or newer; `npm run images` remains unchanged.
Both `package-lock.json` and `pnpm-lock.yaml` are present;
the maintenance workflow below uses npm.

**Never commit or push without explicit approval.** Approval to edit files does
not authorize deployment. A push to a connected branch may trigger Pages.

## Image optimization workflow

Requires Node.js LTS, including npm. Install dependencies when needed:

```powershell
npm ci
```

After adding or updating JPG, JPEG or PNG project/service photos under `assets/`:

```powershell
npm run images
```

`scripts/optimize-images.js` creates quality-82 responsive WebP files beside each
source: `{name}-800.webp` and `{name}-1600.webp`.

- Keeps originals, corrects orientation and never upscales smaller images.
- Skips a variant when its output is at least as new as the source.
- Excludes logo, icon, font and favicon assets; does not process existing WebP.
- Does not update HTML/CSS references automatically.

For example, `assets/services/example.jpg` produces `example-800.webp` and
`example-1600.webp` in the same directory. Review the crop and update `src`,
`srcset`, `sizes`, alt text and image dimensions manually within an approved task.
Keep lazy loading/asynchronous decoding for appropriate below-the-fold photos;
do not apply lazy loading indiscriminately to the hero. Existing reviewed CSS
background WebP images may remain as they are. No automatic deployment image
optimization step is recorded in source.

## Existing SEO and accessibility

Public content pages have titles, descriptions, canonical URLs and Open
Graph/Twitter metadata. The homepage includes `LocalBusiness` structured data
with County Mayo, contact details and the six-service offer catalogue.

`sitemap.xml` contains the production homepage, `services.html`, `pricing.html`
and `privacy.html`. `robots.txt` permits crawling and references that sitemap.
`404.html` uses `noindex, follow` and is excluded from the sitemap.

Preserve the existing metadata, canonical paths, structured data, robots and
sitemap configuration. For any separately approved new public page, follow the
existing SEO conventions. Do not list private, temporary or noindex pages.
Preserve semantic HTML, alt text, keyboard navigation, visible focus, contrast,
ARIA state and existing reduced-motion support.

## Contact and email

The website currently provides phone, `mailto:` and WhatsApp links. Quote CTAs
usually lead to the contact section. The dedicated quote page provides a
calculator and server-side quote submission; live email needs the configuration
below. The server uses Brevo HTTPS API, leaving existing SMTP mail unchanged.

Owner-confirmed infrastructure:

- Incoming: `info@hometechmayo.ie` -> Cloudflare Email Routing -> Gmail.
- Outgoing business mail: Brevo SMTP -> recipient.
- Domain authentication: SPF, DKIM and DMARC configured.

These provider/DNS settings are external to the static website and were not
audited during source review. Never place SMTP passwords, API keys or credentials
in HTML, JavaScript, documentation, logs or Git. Use hosting secrets for future
server-side integrations.

## Pricing calculator and email setup

The catalogue and authoritative rules live in `js/pricing-catalogue.mjs`.
`js/pricing-calculator.mjs` renders the English three-step wizard in `quote.html`;
`server/quote.mjs` validates and recalculates every submission. No client-supplied
prices are trusted. Existing prices are retained except the explicitly approved
handyman rules. Unconfirmed service prices remain Custom Quote.

- €50 minimum labour after discount, per separate visit; handyman €45/hour.
- Explicit half/full-day packages €170/€320, additional hours €45; specialist
  troubleshooting €50/hour as configured in the catalogue.
- Eligible main units: 1–5 no discount, 6–10 5%, 11+ 10% on eligible base labour.
- Add-ons do not increase tiers. Materials, travel, Custom Quote, hourly work
  and packages are excluded from discounts.
- Travel once per visit: Straide/Foxford/Castlebar €0, Ballina/Westport €10;
  other areas require confirmation. Unknown costs are never invented.

The locally prepared redesign moves the calculator off Pricing. Each category
links to `quote.html?category=<id>`; the wizard opens that category without adding
unrequested work. Search is global, results are paged in groups of six, and
selections/options remain in memory while moving between steps. Materials and
area are in step 2; personal details and submission are in step 3. Previous-step
fields are disabled for browser validation, and their data are included explicitly
in the unchanged endpoint payload. Old `pricing#quote-calculator` links forward
to the new page. The quote utility page has its own canonical and noindex metadata;
existing page metadata, sitemap and robots remain unchanged.

**Release approval:** the owner authorized commit, push and publication on
16 October 2026, including cookie consent with GA4 collection disabled. Deployment
results must be verified separately; this approval does not enable analytics.

Run automated tests (Node.js 24+):

```powershell
npm test
```

Read [docs/QUOTE_SETUP.md](docs/QUOTE_SETUP.md) for exact Cloudflare/Brevo setup,
secrets, Turnstile, the separate D1 anti-abuse store and live verification steps.
Without configuration the calculator still works, but email submission is
explicitly unavailable. Mocked test success does not verify actual email delivery.
The privacy policy now discloses the form and its processors. No file uploads
are implemented; use email/WhatsApp for photos.

## Future HBM integration

Email only for this version. No production HBM/Supabase tables, schema, RLS,
authentication or records are accessed or changed. `server/quote.mjs` separates
validation/calculation from delivery so an approved integration can be designed
later. Any future API, data mapping, access, retention, duplicate handling and
publication scope must first be agreed and reviewed for privacy.

## Development rules

- Use the existing local repository, not a separate project copy.
- Preserve existing design and branding.
- Do not modify prices without approval.
- Do not reintroduce CCTV services.
- Preserve existing SEO and accessibility.
- Never expose API keys or credentials.
- Never commit or push without explicit approval.
- Keep changes within the approved scope; documentation approval does not
  authorize HTML, CSS, JavaScript or privacy-policy changes.
- Review privacy before forms, HBM, analytics, advertising, accounts, automated
  publishing or additional third-party embeds.

## Consent-based GA4 (collection disabled)

GA4 measurement ID `G-7H312MNH9B` uses the shared consent entry on all six pages.
The banner has equal Accept/Reject choices; every footer has Cookie settings.
No Google Analytics script, request or cookie is allowed before consent. Quote
privacy consent remains separate, and rejection does not change site features.

`js/analytics-policy.mjs` defines strict page/referrer/campaign allowlists.
Permitted landing attribution is held only in page memory until consent; it is
not persisted across pre-consent page navigation. Contact clicks are separate
from `generate_lead`, which is emitted only after the quote server confirms
success, without any request/customer data in Analytics.

**Production remains fail-closed:** `GOOGLE_CONFIGURATION_VERIFIED = false`
until Enhanced Measurement and automatic user-provided data collection are
turned off in the GA4 account and re-verified. An intercepted real-tag test
observed automatic form events containing the current form URL; it forwarded
no measurements to Google. Publishing the integration with collection disabled
was approved by the owner on 16 October 2026. Do not activate collection until
the account configuration is corrected and verified. Full setup, limits and Realtime/DebugView instructions:
[docs/ANALYTICS.md](docs/ANALYTICS.md).

No API credentials, backend/schema changes or HBM integration are involved.
The owner approved publishing the calculator/cart redesign and cookie-consent
changes together on 16 October 2026, with GA4 collection remaining disabled.
Any later activation requires separate approval.
