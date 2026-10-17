# Website quote request numbering rollout

Use only the dedicated `hometech-quote-guard` D1 database. HBM is not involved.

1. Run `server/migrations/0001-website-quote-numbering.sql` in D1 Console. It adds tables; it does not replace or alter existing requests.
2. Check the table definitions using `SELECT name, sql FROM sqlite_master WHERE name IN ('quote_reference_counters', 'quote_public_references');`.
3. Set Pages Production text variable `QUOTE_SITE_NUMBERING_ENABLED=true`. Keep the existing `QUOTE_GUARD` binding and all current email/Turnstile variables.
4. Deploy the validated commit through the existing GitHub main / Cloudflare Pages workflow.
5. The owner can submit a controlled test using synthetic job details and an email they control. Confirm the same Q-SITE reference in the success screen, business email and acknowledgement. Automated tests never send live email.

The year uses Europe/Dublin. A transactional D1 batch increments the year-specific counter and records one unique public reference for a validated, Turnstile-approved, durably reserved request. Database constraints prevent duplicates. Retries reuse the existing mapping. Internal HT references and request keys remain intact; old successful requests keep their original references.

Acceptance occurs before contacting Brevo so that both notifications contain the public reference. Delivery failure never produces a success response; it can leave a sequence gap. Numbers are never reused. Existing uncertain-delivery retry protection is retained.

Existing 24-hour guard retention also removes associated mappings through a foreign key. Year counters persist. Public references remain in delivered emails and the response data; this is not a permanent request archive or HBM import. Future imports should retain that reference alongside the internal technical ID.

With the flag absent, the existing submission flow remains unchanged. With the flag enabled and schema missing, submission fails safely before reserving a request or calling email providers. Do not enable the flag without the migration. Do not disable it after issuing public references without reviewing retry behaviour.
