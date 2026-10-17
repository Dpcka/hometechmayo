# Branded quote emails

`server/quote-emails.mjs` presents the existing server-calculated estimate as
business and customer HTML/text email bodies. It does not calculate or change
prices, fingerprints, request references, validation, delivery sequencing or
Turnstile/D1 behavior. `server/quote.mjs` passes both bodies to the existing Brevo
sender. Plain-text content retains the important request/pricing information,
with cleaner quantity labels. Business receipt times use Europe/Dublin explicitly.

The shared summary follows the website's #111111 header, #C9A227 accent, white
cards, #dddddd borders, #f5f5f5 background and existing type hierarchy. Email-safe
Arial/Helvetica fallbacks replace the website's external Inter/Poppins fonts.
Layout uses tables, inline styles and a 600px Outlook conditional wrapper. No
scripts, external styles, web fonts or tracking pixels are added.

All customer text, service labels, options and references are escaped for HTML.
Descriptions keep line breaks through escaped text plus generated `<br>` tags.
Customer content never enters an HTML attribute or URL. Both email variants use
the same authoritative line amounts, discounts, minimum, travel and exclusions.

## Logo

The original `assets/logo/logo.svg` remains unchanged. The website shows this
currentColor SVG in white using `brightness(0) invert(1)` on the dark header.
`scripts/generate-email-logo.mjs` rasterises that same artwork as a white,
transparent 720 × 607 PNG, using the existing sharp development dependency.
Email renders it at 104px wide with automatic proportional height; the header
also includes readable business text when images are blocked.

The production HTML uses:
`https://hometechmayo.ie/assets/logo/logo-email.png`.
This new asset must be included in the eventual approved deployment. It is not
published by generating previews. No original logo files or website styles change.

## Local preview and verification

From the existing repository, without production credentials:

```powershell
node scripts/generate-email-logo.mjs
node scripts/preview-quote-emails.mjs
npm test
$env:PLAYWRIGHT_MODULE='C:\Users\Taras\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules\playwright'
node tests/browser-emails.cjs
```

The preview script accepts an optional output directory. Default: ignored
`work/email-previews`. It uses the approved €170 furniture example and fictional
contact details. `customer.html` / `business.html` are the exact generated HTML
bodies. The `-local.html` versions change only the logo to a relative local PNG
for offline viewing; `.txt` files contain their plain-text alternatives.

The browser test renders the exact generated bodies, intercepts the production
logo URL to serve the local PNG, and blocks every other network request. It saves
four desktop/mobile screenshots plus two image-blocked previews. Checks include
image loading, the €170 total, long text, and horizontal overflow. No provider
requests or real emails are sent.

Browser screenshots are not real Gmail/Outlook/Apple Mail delivery verification.
After approval and deployment, use a controlled owner test to check those clients,
the remote PNG, multipart alternatives and final received Reply-To headers.

## Reply-To investigation

The pre-existing business email already set Brevo's supported `replyTo` object to
the validated customer email/name when email was provided. The Brevo request uses
`sender` from QUOTE_FROM_EMAIL and `to` from QUOTE_TO_EMAIL. Customer
acknowledgements keep Reply-To set to the business recipient address. With no
customer email there is no acknowledgement and no customer Reply-To.

An added regression captures the actual JSON sent by sendMail, checks both From /
To / Reply-To combinations with a customer address different from the business,
and asserts both HTML/text bodies. Do not add a second standard Reply-To header
through Brevo's custom headers field.

The owner subsequently confirmed on 17 October 2026 that Reply-To works when
testing from another email address. No change to Reply-To handling was required.
Raw received headers were not independently inspected, so no root cause is
assigned to the earlier reported Gmail Reply behavior.

The owner approved the design and authorized commit, push and deployment on
17 October 2026. No real emails are sent as part of automated release checks;
actual rendering in Gmail/Outlook/Apple Mail still requires controlled delivery.
