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
No framework, CMS, database, form backend or HBM connection is implemented.
Node.js and `sharp` are used only for image maintenance.

| File | Purpose |
| --- | --- |
| `index.html` | Home, About, services, recent projects, reviews, FAQ and contact |
| `services.html` | Furniture Assembly, TV Wall Mounting, Ventilation, Wi-Fi & Networking, Smart Home and General Handyman |
| `pricing.html` | Current starting prices and pricing conditions |
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

There are no tracked GitHub Actions workflows, Wrangler configuration or Pages
Functions. The only npm script is `images`; no site build or test script is
currently defined. Both `package-lock.json` and `pnpm-lock.yaml` are present;
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
lead to the contact section; there is no form submission or email-sending code.

Owner-confirmed infrastructure:

- Incoming: `info@hometechmayo.ie` -> Cloudflare Email Routing -> Gmail.
- Outgoing business mail: Brevo SMTP -> recipient.
- Domain authentication: SPF, DKIM and DMARC configured.

These provider/DNS settings are external to the static website and were not
audited during source review. Never place SMTP passwords, API keys or credentials
in HTML, JavaScript, documentation, logs or Git. Use hosting secrets for future
server-side integrations.

## Future integrations (planning only)

**Request a Quote:** extend the existing contact section, retaining branding and
current contact channels. Proposed fields are name, email, optional phone,
location in Mayo, service and job description, with optional timing. A Cloudflare
Pages Function would validate requests and Turnstile server-side, apply abuse
limits, and send through Brevo's transactional HTTPS API to the existing business
inbox. Use a verified domain sender and the customer's email as Reply-To. Store
secrets in Cloudflare, and test preview delivery/failure states before release.
This proposed API transport does not replace current Brevo SMTP business mail.
Keep photos on email/WhatsApp initially unless uploads are separately approved.

**HBM:** future integration only. The actual interface, authentication, data
mapping and scope must be agreed before implementation. Possible enquiry handoff
or project/gallery publishing must be explicitly scoped; no current API or
connection is assumed. Keep secrets server-side and define access, retention,
duplicate handling, retries and publication permissions before sharing data.

Both plans require separate implementation approval and a privacy-policy review.
The current policy explicitly says there is no contact form. Do not change it
as part of documentation-only work.

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
