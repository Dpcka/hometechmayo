# GA4 integration вЂ” consent, privacy and verification

## Current release state — 17 October 2026

The owner accepted the final privacy/network audit and explicitly approved
technical activation of `G-7H312MNH9B` in source. The production-source gate
`GOOGLE_CONFIGURATION_VERIFIED` is **true**. Analytics still requires affirmative
consent before even loading Google. This source preparation does not authorize
commit, push or deployment; those remain pending a separate owner instruction.

A fresh public tag has Enhanced Measurement handlers absent, automatic history,
forms, outbound clicks, scroll, downloads and video detection disabled, and the
user-provided-data module disabled. Its SHA-256 is
`094bc2d9e179f89af0572683dd31c51fa0139239214ec6892ab6a511c583a198`.
This confirms the configuration distributed by Google, not an authenticated
inspection of every property setting. No credentials or customer data are used.

The final standalone automatic `user_engagement` was captured on natural
Pricing-to-Privacy navigation, with `_et=6041`, sanitized page location and empty
referrer. Source activation needs no custom heartbeat, manual reserved event,
re-enabled Enhanced Measurement or weakened consent. Refusal, withdrawal and
returning visits remain covered. Realtime/DebugView and actual Google delivery
are post-publication checks; all audit measurement transport is intercepted.

The calculator/cart/Cookie Consent implementation is already in `e86a661`.
The pending release diff adds activation, verification tooling and current docs.
Temporary reports and downloaded Google code stay in ignored `work/` and must
never be staged. Test helpers can also exercise a false-gate fixture; that is not
a change to the approved production source.

## Historical audit record

The sections below retain earlier disabled-gate and missing-coverage states as
audit history. The current release state above supersedes their old instructions
to wait for activation approval or keep the gate false. Account-side privacy
settings must stay disabled; repeat the audit if they change.

## Latest audit after owner account changes вЂ” 16 October 2026

17 October resolution: the owner's manual report established trusted visibility
changes but contained only one page_view, no body/_et, and only two font requests
in blockedOther. A separate all-intercepted probe with the identical public tag
SHA-256 `094bc2d9e179f89af0572683dd31c51fa0139239214ec6892ab6a511c583a198`
then reproduced automatic `user_engagement` on real Pricing-to-Privacy document
navigation: `_et=6041`, safe pricing `dl`, empty `dr`, no private/query/form data.
The next privacy page view was also safe. Thus this configuration DOES generate
automatic engagement; a separate hit was absent in the earlier visibility-only
scenario, not demonstrably disabled by Enhanced Measurement settings. No manual
reserved event, weakened consent, or production workaround is needed. The
minimal test change is normal document navigation after foreground activity.
See `work/ga4-navigation-probe.json` and the updated manual procedure. The source
gate remains false pending explicit activation approval; no live delivery or
Realtime/DebugView verification is claimed. Earlier missing-coverage notes below
describe the historical probes, not the final navigation result.

17 October follow-up: one headed Google Chrome probe with a fresh tag still
did not establish a trusted visible-to-hidden transition (focus changed, but
visibility stayed visible). It emitted only a safe `page_view`; no separate
`user_engagement` was observed. Automatic retries stopped. The source gate
remains false. See [the exact manual Chrome DevTools procedure](GA4_MANUAL_CHROME.md)
and `scripts/manual-ga4-chrome.cjs`, a dependency-free manual interception
helper. A subsequent helper fault was reproduced and fixed: `Page.enable`
was missing before registration of the document init script, leaving the local
debug key unset even though the fixture gate was true. The corrected helper's
Chrome `--self-test` now passes no-consent/accept/withdrawal checks and captures
a safe real-tag page view. The human-driven engagement scenario has not yet
been executed. Existing calculator/cart/GA source files are preserved.

Fresh official tag SHA-256:
`823bd9982444bf58848408769442b9ce016798d631d7c567debc0e7698b73b26`.
The public configuration now has automatic forms, outbound clicks, history,
scroll, download and video detection disabled, no enhanced site-search handler,
and the first-party user-data module disabled. The owner's changes are visible
in the downloaded tag. No further account setting changes are currently indicated
by this audit. Authenticated property UI and live reporting were not inspected.

At 390px and 1280px, with test-only gate overrides and all third-party measurement
transport intercepted, the initial document emitted one manual page view and
the intended quote/contact/lead events in two batched requests. `pushState`,
`replaceState` and back navigation emitted no additional page views. No synthetic
private value, arbitrary query, raw referrer path, or known synthetic contact
hash was found. `dl` remained `https://hometechmayo.ie/quote.html`; `dr` remained
`https://www.google.ie/`. `_ss=1`, a session ID and `sct=1` accompanied the first
page view. A returning visit with stored consent emitted one page view without
a new session-start flag. Before consent, after Reject including a reload,
after withdrawal and on a return with stored refusal there were zero collection
requests. Namespaced analytics cookies were removed on withdrawal. The real
source flag still prevents even tag loading after consent.

Engagement time `_et` was observed on intended events with safe default context.
No separate `en=user_engagement` was observed. Additional headed/tab-switch,
minimise, freeze/resume, navigation and close probes did not produce it; the
visibility probe continued reporting the original document as visible/focused.
Thus a real visible-to-hidden lifecycle was not established in this automation
environment. No reserved event was fabricated to claim automatic-event coverage.
`configurationSafe: true` in the wire report means the observed payloads passed
the privacy checks; it is not a claim that every requested lifecycle event was
observed or that live GA reporting was verified. Keep the source gate false until
that remaining engagement coverage is verified, then seek activation approval.

`npm test` passed 50/50; the normal consent/browser event suite passed, including
API success/failure/duplicate lead semantics. The real-tag lead transport probe
uses a synthetic DOM success signal; real API-confirmation semantics are tested
separately with mocked API responses. No quote mail or test hit was sent live.

The sections below retain the earlier unsafe-configuration findings as history;
those previously observed URL/form/search leaks did not recur with this tag.

An earlier local test using the real public Google tag (with EVERY measurement request
intercepted locally) observed automatic `form_start`/`scroll` events. Its
`form_destination` included the current URL query string. This is an observed
privacy risk if Enhanced Measurement remains enabled, not just a hypothetical
warning. No test measurement or synthetic private value was forwarded to Google.
The gate prevents the production tag from loading until that configuration is
corrected and verified. The code's manual events alone are not enough to disable
Google's remote automatic measurement settings.

## Required GA4 account settings before activation

### Extended session/lifecycle audit, 16 October 2026

This supersedes the short-run context conclusion below. With foreground focus,
a 12-second idle interval, history replacement and trusted navigation, the real
tag emitted a second automatic `page_view`: its `dl` contained the history URL
query and its `dr` contained the previous full URL, including a synthetic phone
and click/search markers. Email redaction did not remove these other values.
Thus explicit event overrides do NOT guarantee safe context on automatic
history events. The gate must remain false; disabling forms/search alone is
insufficient. No transport monkey-patching or calculator/history mutation was
introduced to hide this remote configuration issue.

At both 390px and 1280px there were seven intercepted collection requests in
the diagnostic phase. Initial manual page views had safe page/referrer context.
Session start appeared as `_ss=1` on the first collected event, with `sid`,
`sct=1`, safe `dl` and safe `dr`; no separate `en=session_start` request was
observed. Engagement time was present as `_et` on multiple events, including
the unsafe automatic history page view. No standalone `en=user_engagement`
was observed despite the idle/navigation probe; its safety is NOT verified.
Do not manufacture that reserved event to make a test appear to pass.

Before consent, after an explicit Reject, and with the actual source gate false
after consent, there were zero tag loads/collection requests. Withdrawal stopped
subsequent collection and removed namespaced cookies. All measurement transport
was intercepted; no test hit reached Google. Known SHA-256 hashes of the synthetic
email/phone were also checked; none was observed, which is not a guarantee about
all possible remotely enabled user-data formats.

After changing account settings, rerun both the normal consent browser suite and
the real-tag lifecycle audit. Require one page view per document, safe default
context on every emitted automatic event, no private URL/form/link parameters,
and a further engagement check in a headed/real-device browser. Confirm actual
session/engagement reporting in DebugView only after a separately approved safe
activation. Until those checks pass, this integration is not ready to publish.

Google references: [automatic events](https://support.google.com/analytics/answer/9234069),
[tag settings](https://support.google.com/analytics/answer/12131703),
[enhanced conversions/user-data controls](https://support.google.com/analytics/answer/14252663).

### Earlier short-run audit, 16 October 2026 (limited coverage)

A freshly downloaded public tag still exposes enabled auto-events (outbound,
scroll, download, history, forms, video and page views), site-search keys
`q,s,search,query,keyword`, and automatic first-party email/phone/address detection.
Its email-redaction flag is enabled, but this did not remove a synthetic phone
number from `form_destination`. Google Signals is disallowed in the public
region-scope configuration; the full authenticated account settings were not
accessible and were not changed.

With real tag execution and all third-party measurement transport intercepted,
at 390px and 1280px, the diagnostic fixture produced five batched collection
requests per run. `dl` was consistently `https://hometechmayo.ie/quote.html` and
`dr` was `https://www.google.ie/`; no query/hash or private referrer path was in
those fields. No Referer header accompanied the tag load. However automatic
`view_search_results` sent a synthetic private query through `ep.search_term`,
and `form_start` sent a synthetic phone and query marker through
`ep.form_destination`. Automatic `scroll` was observed too. The local explicit
page/context filtering is working, but cannot sanitise separate parameters
constructed internally by remotely configured Google collectors.

No additional invasive URL/history/form mutation or network monkey-patch has
been added: that would risk the calculator while still not guaranteeing all
Google collection paths are covered. Account-side collectors must be disabled.
The source gate remains false. Without the diagnostic fixture override, Accept
analytics produced **zero tag loads and zero measurement requests** at both
widths. Withdrawal produced zero further requests and removed namespaced
analytics cookies. No test measurement was forwarded to Google.

Reproduce with the existing local preview at port 8788 and installed Playwright:

```powershell
Invoke-WebRequest 'https://www.googletagmanager.com/gtag/js?id=G-7H312MNH9B' -OutFile work/ga-real-tag.js
# Set PLAYWRIGHT_MODULE to the installed Playwright module if not on NODE_PATH.
node tests/browser-real-analytics.cjs
```

The audit writes `work/ga4-network-audit.json`, including tag SHA-256, public
settings, parameter keys, safe page/referrer values and gate/withdrawal checks.
It exits nonzero when account configuration is unsafe; this is a release
blocker for GA4 activation, not an all-green end-to-end GA verification. It
does not prevent the explicitly approved release with collection gated off. Synthetic success DOM
signals in this transport audit do not submit a real quote; server-success
semantics are covered separately by `tests/browser-analytics.cjs`.

In the property containing `G-7H312MNH9B`, using an Editor/Admin account:

1. Open Admin -> Data collection and modification -> Data streams -> the Web
   stream. Turn **Enhanced measurement OFF**. This includes automatic form
   interactions, outbound clicks, site search, downloads, scrolls, video and history
   page changes. Basic page views will be sent manually by the integration.
2. Review Google tag settings -> Configure tag settings -> automatic event
   detection. Disable automatic forms/outbound detection there too if the UI
   exposes a separate setting. Do not add a second Google tag or GTM container.
3. Turn off **user-provided data collection**, including automatic user-provided
   data capabilities, and Google Signals/advertising personalisation. The code
   also disables Google Signals and advertising consent/features.
4. Review connected tag destinations: only the intended Analytics stream should
   receive these events. Do not enable advertising tags or automatic conversions.
5. Review data retention and save a documented business choice (for example,
   the minimum practical retention period). Do not claim a retention setting
   was changed without checking the actual account.
6. Mark only `generate_lead` as the quote-request key event. Do not treat
   `phone_click`, `whatsapp_click`, `quote_interaction`, `form_start` or
   `form_submit` as a confirmed website quote request.
7. Re-fetch/retest the real public Google tag with intercepted measurement
   requests to confirm automatic form/outbound events and private URL values
   are absent. Settings changes may take time to appear in the tag.
8. Only after that verification, set `GOOGLE_CONFIGURATION_VERIFIED = true`,
   review the final diff and obtain explicit commit/push/deployment approval.

Account settings, Realtime and DebugView were not accessed through an
authenticated Google Analytics account during this implementation. The
integration requires no Brevo, Cloudflare or Google API credentials and makes
no changes to the quote API, D1 schema or HBM/Supabase.

## Consent behavior

- Basic Consent Mode, applying the same opt-in rule to all visitors. No
  geolocation request or pre-consent Google Analytics connection.
- Initially there is no Google tag, analytics request, analytics cookie or
  buffered interaction. Accept analytics and Reject analytics are equal actions.
- Essential first-party local storage `htss_cookie_consent` contains only the
  choice, policy version and timestamp. Invalid, future, old-version or expired
  records fail closed. A choice lasts up to 180 days.
- Cookie settings is available in all six footers and in the privacy policy.
  Its accessible dialog supports keyboard use, Escape/cancel and mobile layouts.
- Analytics consent is completely separate from the quote privacy checkbox.
  Refusal does not change the calculator, contacts or submission behavior.
- Withdrawal sets Google's `ga-disable-G-7H312MNH9B` flag before further sends,
  clears this integration's `htss_ga`/`htss_ga_*` cookies and discards pending
  post-consent events. There is no reload, so quote fields remain intact.
- The same decision is respected in other open tabs, after back-forward cache
  restoration and at expiry. Storage failure never implies consent and does
  not break the calculator; a new choice can apply to the current page only.
- Advertising storage, ad user data and ad personalisation remain denied even
  when analytics is allowed. Namespaced GA cookies are host-only, root-path,
  capped at 180 days with no rolling expiry update.
- Withdrawal stops future collection; it cannot retract information already
  sent while permission was active.

## Traffic attribution and data boundaries

At module initialization, `landingContext` captures only a sanitized in-memory
snapshot. No attribution is persisted in cookies, local storage, session storage
or link decoration before consent. History/category changes on the same page do
not overwrite the captured permitted landing source before acceptance.

Leaving/reloading the landing page before granting consent can lose original
campaign attribution. This is intentional: retaining it across pages in browser
storage would conflict with the no-analytics-storage-before-consent rule. The
integration does not secretly work around that rule with URL passthrough.

Only the exact lower-case labels configured in `CAMPAIGNS` are accepted:

- `utm_source`: google, bing, facebook, instagram, whatsapp, email, newsletter,
  flyer, google_business_profile.
- `utm_medium`: organic, cpc, ppc, social, paid_social, email, referral, offline, qr.
- `utm_campaign`: website, launch, mayo, furniture, tv-mounting, ventilation,
  wifi, smart-home, handyman, spring, summer, autumn, winter.

These map to GA `campaign_source`, `campaign_medium` and `campaign_name`.
Unknown or duplicated values are discarded. Extend the explicit list for a real
campaign only after confirming the label contains no personal information.
`utm_term`, `utm_content`, arbitrary query parameters, fragments, `gclid`,
`fbclid`, dynamic titles and raw destination URLs are never supplied by our code.

Page locations/titles come from a fixed six-page allowlist. Unknown paths map
to the 404 label. Referrers use a small canonical-origin allowlist for search/
social sources; paths, query strings and unknown domains are not forwarded.
Unknown external referrals are grouped as `external-referral / referral`.
Google Analytics still processes technical browser/device/cookie information
and receives network IP addresses; the privacy policy does not call it fully
anonymous.

## Events

| Event | Meaning | Allowed custom fields |
| --- | --- | --- |
| `page_view` | One view per document, after consent and tag readiness | Fixed page metadata, permitted campaign labels |
| `whatsapp_click` | WhatsApp contact link | placement enum only |
| `phone_click` | Phone contact link | placement enum only |
| `quote_interaction` | Open/contact/add/remove/actual wizard step | action enum, placement enum |
| `generate_lead` | Server confirmed quote success | method = website_quote_form |

The calculator dispatches two payload-free/coarse local DOM signals; there is
no Analytics import/dependency in its calculation or network code. The success
signal is after HTTP success and `result.ok === true`. Failures and rejected
responses do not generate a lead. A successful retry/duplicate confirmation
can count the one real lead once per document. A lead that happened without
analytics consent is never backfilled after later acceptance.

No customer name, phone, email, Eircode, description, form values, materials,
quote selections, estimate, request ID/reference or Turnstile token is forwarded
by these events. Even link labels and href values are excluded from parameters.

## Local verification

Run the normal tests with Node.js 24+:

```powershell
npm test
```

Run browser tests against the existing local preview on port 8788, with Edge and
Playwright supplied as external development tools:

```powershell
node tests/browser-analytics.cjs
node --require ./tests/consent-regression-preload.cjs tests/browser.cjs
node --require ./tests/consent-regression-preload.cjs tests/browser-cart.cjs
```

If necessary set `PLAYWRIGHT_MODULE` to the installed Playwright module path.
The preload only sets an explicit rejected preference for existing calculator
regression tests, without editing their source or changing the customer UI.
Analytics tests use mock Google/Turnstile/quote responses and intercept all mock
hits. The approved source is tested directly for positive collection checks;
a disabled response fixture also preserves fail-closed coverage. They never send test leads or data to Google/Brevo.

After account verification, for manual debugging on localhost explicitly opt
in in the browser console:

```javascript
sessionStorage.setItem('htss_ga_debug', '1');
location.reload();
```

Then accept analytics in the banner. This allows localhost diagnostics only
when the account-verification gate is already enabled. While the source flag is
false, no debug flag can load Google. Use intercepted transport/mocked responses
while testing private synthetic inputs. The flag alone never grants consent.
Remove it afterwards:

```javascript
sessionStorage.removeItem('htss_ga_debug');
```

Normal localhost and Pages preview hosts do not collect Analytics. No debug
query parameter is required or sent to Google.

## Realtime / DebugView check after account verification and approved release

1. Use an incognito browser and DevTools Network/Application. Before choosing,
   confirm no gtag.js / google-analytics collect requests or `htss_ga` cookies.
   Reject analytics; repeat contact and calculator actions with zero GA requests.
2. Open Cookie settings, allow analytics and save. Confirm one gtag script, one
   page_view and only sanitized URL/referrer/campaign fields in collected data.
3. Open GA4 Reports -> Realtime. Locate page_view and the custom events. Traffic
   source reports can take longer than Realtime to populate.
4. For DebugView on your own approved test session, set
   `sessionStorage.setItem('htss_ga_debug','1')`, reload, and explicitly allow
   analytics. This adds `debug_mode: true` only in that browser session. Open
   Admin -> Data display -> DebugView. Google filters, blockers and consent can
   affect visibility; lack of Realtime access here is not evidence of delivery.
5. Click WhatsApp/phone and open the wizard. Verify separate contact and
   interaction events; generate_lead must remain zero until a server-confirmed
   successful quote. Use an owned test enquiry/inbox only for that final check.
   A mocked success is not a live email-delivery test.
6. Use an approved URL such as
   `/?utm_source=google&utm_medium=cpc&utm_campaign=mayo`. Delay accepting, then
   verify permitted source attribution. Never put real customer information in
   campaign labels. Inspect payloads to ensure contact URLs/text and form fields
   are absent.
7. Withdraw through Cookie settings. Confirm immediate stop, cookie deletion,
   unchanged in-progress quote fields and refusal persisted after navigation.
   Test mobile widths, reopening settings and a second open tab.
8. Clear the debug flag and test cookies. Confirm no duplicate GTM/GA tag is
   injected by Cloudflare, another plugin or a second HTML snippet.

Official references:
[Consent Mode](https://developers.google.com/tag-platform/security/guides/consent),
[Enhanced Measurement](https://support.google.com/analytics/answer/9216061),
[Google tag privacy controls](https://developers.google.com/tag-platform/security/guides/privacy),
[DebugView](https://support.google.com/analytics/answer/7201382),
[Irish DPC cookies guidance](https://www.dataprotection.ie/en/dpc-guidance/guidance-cookies-and-other-tracking-technologies).
