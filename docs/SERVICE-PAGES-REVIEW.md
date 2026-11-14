# Five service pages — approved publication implementation

Owner approved publication and final repair rules. Production content is generated with `node scripts/render-service-pages.mjs --publish`; verify with `--publish --check`. Default generation remains noindex for future unapproved drafts.

- Complete approved English copy, metadata, FAQs and all price sources: SERVICE-PAGE-CONTENT-REVIEW.md.
- Furniture uses verified Westport JYSK and Wayfair projects; Handyman uses the correctly captioned Westport wardrobe. No unrelated TV/network/computer photos or invented cases.
- Catalogue v2026-11-13.1 adds selectable diagnostics and RAM, reusing shared server/browser calculation. Drop-off diagnostics €40/no travel; on-site €50 overall minimum plus travel; RAM from €40 labour/materials separate. Diagnostic waiver remains conditional on confirmed repair, never automatically credited.
- Drop-off diagnostics cannot mix with an on-site estimate. Diagnostics and PC troubleshooting cannot duplicate the same assessment. Existing pricing, eligible discounts, hourly/package rules and unknown costs are preserved.
- Five clean indexable routes have canonical, Service and BreadcrumbList data, readable HTML, existing consent/contact scripts and responsive assets. Services hub, furniture project context links and sitemap expose the new pages.
- Only safe analytics route contexts were added; consent gating and events remain unchanged. No customer submissions, emails or analytics hits are sent during production checks.

Validation and deployed identifiers are reported in the final deployment report. No Reviews logic, privacy notice, Q-SITE allocation, database schema, secret or Access policy changes are part of this deployment.
