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

Current services:

- Furniture Assembly
- TV Wall Mounting
- Ventilation
- Wi-Fi & Networking
- Smart Home
- General Handyman

CCTV is not part of the service offer and must not be reintroduced.

## Architecture

Static HTML5, CSS3 and vanilla JavaScript. There is no application framework,
CMS, database, form endpoint or server-side email implementation in the current
repository. Node.js is development tooling for image optimization, not a website
runtime. The only npm script is `npm run images`, using the `sharp` dependency.

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
| `pricing.html` | Existing starting prices, pricing conditions and enquiry calls to action |
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

There is currently no website contact form, booking system, customer account,
HBM integration, Google Analytics or advertising tracking in the site source.

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

There are no tracked GitHub Actions workflows, Wrangler configuration, Pages
Functions, `_headers` or `_redirects` at this review. Both npm and pnpm lockfiles
exist; the documented image workflow uses npm. Do not assume a package-manager
migration or build-system change is required.

## Contact and email architecture

Current website enquiries use `mailto:`, `tel:` and WhatsApp links. Quote buttons
lead to the existing contact section; they do not submit data to a backend.
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
incoming forwarding; Brevo handles outbound delivery. Neither is currently called
by website JavaScript or a website backend.

Never store email credentials, SMTP passwords, API keys or other secrets in
source, browser code, documentation, screenshots, logs or Git history. Future
server credentials must use the hosting platform's secret storage.

## Future Request a Quote form (not implemented)

Proposed approach, requiring separate implementation approval:

1. Extend the existing contact section using the current design and accessible
   form patterns; retain phone, email and WhatsApp options.
2. Collect name, email, optional phone, Mayo town/location, one of the existing
   service categories and job description; optionally preferred timing.
3. Submit to a same-origin Cloudflare Pages Function with server validation,
   request limits, abuse protection and server-verified Turnstile.
4. Use Brevo's transactional HTTPS API for form notifications to
   `info@hometechmayo.ie`, forwarded to Gmail through the existing incoming route.
   This is a proposed form transport; current business outbound email remains
   Brevo SMTP. Use an authenticated domain sender and the visitor's validated
   email as Reply-To, never as the From address.
5. Store Brevo and Turnstile secrets only in Cloudflare secret bindings. Define
   separate preview and production configuration before testing.
6. Provide accessible validation, pending, success and failure states; confirm
   provider acceptance before displaying success. Avoid logging enquiry content.

For an initial version, job photos can continue through email/WhatsApp. Uploads
would require separately agreed storage, file limits, access and deletion rules.
Review and update the privacy policy before launch: it currently states there
is no contact form. Test delivery to Gmail and reply behavior in a preview before
any approved production release. Do not add a price calculator or alter prices.

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
