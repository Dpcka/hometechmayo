# Text Reviews: manual retention — approved 13 November 2026

Public policy: /privacy#website-reviews-privacy. Automated retention and Cron
remain disabled. This is an owner-operated procedure, not a scheduled job.

The owner must review retention every month and handle removal/withdrawal requests
when received. Plan the next review date and delete records that would reach their
limit before then; a monthly inspection must not extend the 90-day maximum.

- Pending: at most 90 days from submission.
- Hidden: at most 90 days from the start of the current hidden period. Consult
  moderation:hidden events and from/to values; later note edits do not restart it.
- Rejected: at most 90 days from rejected_at.
- Approved: assess continued need and consent monthly; remove on withdrawal unless
  a separately justified retention exception applies. Assess early email removal.
- Email: remove with its review, or earlier if no longer needed for follow-up.
- Incomplete submissions: eligible after 24 hours; inspect during monthly checks.
- Limited audit records: at most 12 calendar months unless a specific lawful hold.
- Review justified holds monthly; record the reason and remove when it ends.

## How authorised owners carry out manual deletion

1. Identify the record privately in /admin/reviews. Verify a removal request using
   only proportionate information. Hide a published review promptly if appropriate.
   Hiding stops publication but does not erase stored data.
2. Check for a documented dispute hold. Do not silently override one; assess its
   necessity. Keep the minimum justified data separately with a review deadline.
3. Permanent deletion is an authorised maintenance action in the Cloudflare D1
   Console for **hometech-reviews** (4fc2e7dc-31f4-4110-b8d5-335b69101235), not a
   button currently provided by the admin UI. Never use hometech-quote-guard.
   Select the exact review by its internal UUID; do not run broad bulk deletes.
4. An authorised maintainer must claim the exact record using retention_deleting
   with a no-hold condition to prevent concurrent moderation. Check the claim
   succeeded and there are no active uploads. Photos are disabled; if legacy
   image records exist, stop text-only deletion and arrange private R2/variant
   cleanup before deleting their metadata. Do not leave orphaned media.
5. Preserve only the necessary moderation audit fields in review_moderation_archive
   before parent removal. Exclude customer names, email, free-text notes or details
   unless specifically needed and justified. Use the original event dates so the
   12-month limit is not restarted. Do not archive raw customer review text by default.
6. Delete the claimed exact review with hold and claim predicates. Existing foreign
   keys cascade to consent records, images, moderation events and notification outbox;
   verify the exact parent and dependent records were removed. This removes the
   customer's email, review text, IP hash and submission keys with the review.
7. Where an approved review remains, an authorised maintainer may clear only its
   customer_email field when follow-up is no longer necessary. Review obsolete
   security hashes too. Do not export customer data into tickets, Git or chat.
8. Review audit/archive expiry separately; document completion and next review date
   without copying customer content. Keep Cloudflare platform backups/versioned
   retention in mind when handling a request; do not promise instant backup erasure.

This document performs no SQL and creates no scheduled automation. Seek scoped
maintenance assistance for an actual deletion; inspect and validate exact IDs
before any irreversible action. No production records were altered for launch.
