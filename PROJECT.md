# Home Tech Solutions & Services

## Project status and locations

Existing production business website, maintained in the original repository.
Current architecture reviewed on 16 October 2026.

- Production: https://hometechmayo.ie
- GitHub: https://github.com/Dpcka/hometechmayo
- Local project: `E:\HTSS\Home Tech\27 Site\hometechmayo`
- Hosting: Cloudflare Pages, deployed from GitHub.
- Current local branch: `main`, tracking `origin/main` at the documentation review.

The site originated from a Google Sites design reference. The custom website is
now the production project; the existing implementation is the design baseline.

## Business and services

- Business: Home Tech Solutions & Services
- Service area: County Mayo, Ireland
- Email: info@hometechmayo.ie
- Phone: 083 349 8496 / +353 83 349 8496
- WhatsApp: https://wa.me/353833498496
- Audience: homeowners, landlords, property managers and small businesses.

Core services promoted on the existing site (additional calculator categories
are listed in the catalogue, with Custom Quote where rates are unconfirmed):

- Furniture Assembly
- TV Wall Mounting
- Ventilation
- Wi-Fi & Networking
- Smart Home
- General Handyman

CCTV is not part of the service offer and must not be reintroduced.

## Architecture

Static HTML5, CSS3 and vanilla JavaScript. There is no application framework or
CMS. The pricing calculator uses shared vanilla JavaScript modules and a Cloudflare Pages Function for email quote
requests. A dedicated Cloudflare D1 binding stores only anti-abuse metadata; it
does not connect to HBM/Supabase. Node.js provides image tooling and automated
tests; no new runtime package dependencies were added.

```text
hometechmayo/
  index.html
  services.html
  pricing.html
  privacy.html
  404.html
  css/style.css
  js/main.js
  assets/
    hero/
    icons/
    logo/
    projects/
    services/
  css/calculator.css
  js/pricing-catalogue.mjs
  js/pricing-calculator.mjs
  functions/api/quote.js
  functions/api/quote-config.js
  server/quote.mjs
  server/quote-guard.sql
  tests/
  docs/QUOTE_SETUP.md
  _routes.json
  scripts/optimize-images.js
  robots.txt
  sitemap.xml
  package.json
  package-lock.json
  pnpm-lock.yaml
  PROJECT.md
  README.md
  DESIGN.md
  CONTENT.md
  TODO.md
```

`DESIGN.md`, `CONTENT.md` and `TODO.md` contain historical planning material and
may differ from the implemented site. Confirm current behavior against source.

## Current pages and functionality

| Page | Current content |
| --- | --- |
| `index.html` | Hero, About, six service cards, recent projects, reviews, FAQ and contact/quote section |
| `services.html` | Six service descriptions, selected photographs, starting prices and enquiry links |
| `pricing.html` | Starting prices, interactive 17-category estimate calculator and email quote form |
| `privacy.html` | Current privacy policy |
| `404.html` | Custom page-not-found page |

About, Projects and Contact are homepage sections, not separate HTML pages.
Shared navigation links to those sections and the dedicated Services and Pricing
pages. The footer includes contact details and the privacy policy link.

Implemented interactions:

- Responsive mobile navigation with ARIA state and Escape-to-close behavior.
- Header styling and active homepage navigation during scrolling.
- Smooth scrolling, back-to-top control and intersection-based entrance animation.
- FAQ accordion with expanded/collapsed accessibility state.
- Reviews carousel with controls, dots, swipe and keyboard navigation, autoplay
  pauses, and reduced-motion handling. Review content is stored in HTML; it is
  not fetched automatically from Google.
- WhatsApp links and a delayed welcome widget. The `whatsappClosed` local-storage
  key remembers dismissal.
- Automatic copyright year.

The calculator and quote endpoint are implemented. Live submission remains
disabled until the required Cloudflare/Brevo configuration is supplied. There is
no booking system, customer account, HBM integration, Google Analytics or
advertising tracking in the site source.

## Design and accessibility baseline

Preserve the existing responsive layout, logos, imagery, typography and branding:

- Primary: `#111111`; gold accent: `#C9A227`.
- Accessible darker accent: `#806400`.
- White and light-grey (`#F5F5F5`) backgrounds.
- Poppins headings and Inter body text, loaded through Google Fonts.
- Shared CSS, cards, rounded corners, restrained animation and mobile layouts.

Preserve semantic markup, image alternative text, keyboard controls, visible
focus, contrast, ARIA state and existing reduced-motion support when extending
features.

## Image optimization

Use Node.js LTS and npm in the existing repository. See README.md for commands.
`scripts/optimize-images.js` recursively processes JPG/JPEG/PNG photos in
`assets/`, excluding logo, icon, font and favicon assets.

- Writes `{name}-800.webp` and `{name}-1600.webp` beside the original.
- WebP quality: 82; applies orientation correction; never upscales.
- Preserves original files and skips outputs at least as new as their source.
- Does not rewrite HTML or CSS and does not process existing WebP inputs.
- HTML references must be reviewed manually, including crop, `srcset`, `sizes`,
  alternative text and dimensions. Below-the-fold photos use lazy loading and
  asynchronous decoding; the homepage hero has a separate mobile source.
- Existing CSS background images can retain their reviewed WebP assets.

Image generation is an explicit local maintenance step; no automatic deployment
image-processing command is recorded in this repository.

## Existing SEO

Preserve the implemented SEO configuration:

- Page titles, descriptions, self-referencing canonical URLs and social metadata
  (Open Graph and Twitter cards) on the public content pages.
- Homepage `LocalBusiness` JSON-LD with business contact details, County Mayo
  service area and an offer catalogue for the six current services.
- `sitemap.xml` lists the homepage, `services.html`, `pricing.html` and
  `privacy.html`, using the production domain and current canonical paths.
- `robots.txt` allows crawling and points to the production sitemap.
- `404.html` has `noindex, follow` and is excluded from the sitemap.
- SVG favicon and PNG Apple touch icon.

Do not change existing metadata, structured data, canonical paths, robots rules
or sitemap entries as incidental cleanup. Follow the existing conventions for
any separately approved new public page.

## Git and deployment

The existing GitHub repository is connected to Cloudflare Pages for deployment,
as confirmed by the owner. The local branch is `main` tracking `origin/main`.
Cloudflare dashboard settings are not captured in source: production branch,
build command, output directory, environment variables and preview controls must
be verified there before deployment-related work.

There are no tracked GitHub Actions workflows or production Wrangler settings.
`functions/api/quote.js` and `quote-config.js` provide the quote endpoints;
`_routes.json` restricts Functions execution to `/api/*`. Both npm and pnpm lockfiles
exist; the documented image workflow uses npm. Do not assume a package-manager
migration or build-system change is required.

## Contact and email architecture

Existing contact options use `mailto:`, `tel:` and WhatsApp links. The pricing
page now also provides a calculator and server-backed quote form. Most existing
site quote buttons continue to lead to the homepage contact section.
A `mailto:` link opens the visitor's email application.

Owner-confirmed email infrastructure:

```text
Incoming email to info@hometechmayo.ie
  -> Cloudflare Email Routing
  -> Gmail inbox

Outgoing business email
  -> Brevo SMTP
  -> Recipient
```

The email domain is authenticated with SPF, DKIM and DMARC, as confirmed by the
owner. DNS authentication, delivery and provider dashboard settings were not
independently audited during the source review. Cloudflare Email Routing handles
incoming forwarding; Brevo handles outbound delivery. The new quote endpoint
uses the Brevo HTTPS API when configured; it does not
expose credentials to website JavaScript or change existing SMTP mail usage.

Never store email credentials, SMTP passwords, API keys or other secrets in
source, browser code, documentation, screenshots, logs or Git history. Future
server credentials must use the hosting platform's secret storage.

## Pricing calculator and email quote requests

Implemented in `pricing.html` with `css/calculator.css` and
`js/pricing-calculator.mjs`. The authoritative catalogue and calculation engine
are in `js/pricing-catalogue.mjs`, shared with `server/quote.mjs`.

The catalogue contains 17 categories. Existing published starting prices are
used where established; newly requested work without an approved rate remains
Custom Quote. The owner's 16 October 2026 calculator rules supersede old handyman
rates: €45/hour, €50 minimum labour per separate visit, explicit €170 half-day
and €320 full-day packages, and €50/hour specialist troubleshooting as specified.
Fixed jobs are never automatically converted to packages.

Discount tiers count eligible main units including quantities: 1–5 = 0%, 6–10 =
5%, 11+ = 10%. Only eligible base labour is discounted. Add-ons do not increase
the count; hourly work, packages, custom work, materials and travel are excluded.
The €50 labour minimum is applied after discount, when labour is known. Travel
is once per visit: Straide/Foxford/Castlebar €0; Ballina/Westport €10; Other is
Custom Quote. Unknown work/materials/travel are excluded and marked clearly.
The calculator is for one visit, not a final quotation or confirmed booking.

Email flow: form -> Pages Function -> Brevo transactional HTTPS API -> business
inbox -> Cloudflare Email Routing -> Gmail. Optional customer acknowledgement
is sent only if an email was supplied. The server validates inputs, verifies
Turnstile, recalculates all prices and uses plain-text emails with a unique
reference. A dedicated D1 anti-abuse store provides atomic duplicate reservation
and a five-request-per-IP/hour limit, without storing enquiry content.

Required setup and operational limitations are documented in
[docs/QUOTE_SETUP.md](docs/QUOTE_SETUP.md). Missing configuration fails closed;
calculator estimates still work but online submission remains disabled. No live
email delivery is implied by passing mocked tests. Privacy-policy form disclosures
were updated with this implementation. Photos remain on email/WhatsApp.

## Future HBM integration (not implemented)

HBM website integration is a future planning item. Its API, authentication,
capabilities, hosting and exact data flows have not been supplied or verified.
No existing connection or automated publishing should be assumed.

Before implementation, agree the intended scope, such as quote/enquiry handoff
and any separately approved project/gallery publishing. Define field mapping,
data ownership, access, retention, duplicate handling and failure/retry behavior
against the actual HBM interface. Keep credentials server-side and use only the
minimum necessary data. Any publication of customer/project material requires
review of privacy and publication permissions. Review the privacy policy before
adding HBM data transfers or automated publishing. Implementation requires
separate approval and must preserve the public site's design and SEO.

## Development rules

- Work in `E:\HTSS\Home Tech\27 Site\hometechmayo`, the existing repository;
  do not create a separate project copy or replacement repository.
- Preserve the existing design and branding; do not redesign without approval.
- Do not modify prices without explicit approval.
- Do not reintroduce CCTV services.
- Preserve existing SEO configuration and accessibility.
- Never expose API keys, email credentials or other secrets.
- Never commit or push without explicit approval. Editing approval does not
  authorize a commit, push or production deployment.
- Keep changes within the approved scope. A documentation-only task must not
  change HTML, CSS, JavaScript, assets, configuration or the privacy policy.
- Review the privacy policy before adding forms, HBM integration, analytics,
  advertising, customer accounts, automated publishing or third-party embeds.
