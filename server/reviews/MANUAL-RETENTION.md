# Website Reviews and photographs: manual retention — 13 November 2026

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
   succeeded and there are no active uploads. Before removing a whole review,
   list and delete every object under its exact `originals/<review UUID>/` and
   `derivatives/<review UUID>/` prefixes in the EU hometech-review-media bucket.
   Paginate listings. Verify no objects remain. If any R2 operation fails, keep
   the D1 manifest and conservative storage reservation, release the maintenance
   claim safely, record the failure privately and retry; never report completion.
   Only after confirmed deletion may a D1 transaction release that review's sum
   of reserved_bytes from review_usage storage and remove the claimed record.
   Never delete D1 metadata first or leave orphaned media.
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

## Photograph-specific manual procedure (Cron and automatic retention remain off)

- Each month inspect pending/hidden/rejected reviews and unfinished uploads,
  plus review_images.published_at and storage_key. Plan work BEFORE the next
  review so published private originals never exceed 30 days without a justified
  hold. Incomplete uploads are eligible after 24 hours; do not describe this as
  an automatic or guaranteed 24-hour erasure service.
- Individual removal: in /admin/reviews choose Remove photograph and Save.
  This operation requires Access JWT, approved owner, same Origin and CSRF.
  It commits revocation first, then deletes the exact private original and all
  derivatives, clears variant references and storage reservation atomically,
  and records an audit event. No retention feature flag is needed.
- On a deletion error, reload the review and save again. The UI retains a hidden
  deletion-pending entry; private files/manifests and the budget reservation are
  preserved until success. Do not say deleted until the request succeeds.
  Do not clear the tombstone or restore its publication status.
- For private originals reaching 30 days after publication: an authorised
  maintainer claims the exact review using retention_deleting and no-hold
  predicates, confirms all three approved derivatives exist, deletes only the
  exact originals/<review UUID>/<image UUID> object, then clears storage_key.
  Retain the conservative per-image budget reservation while derivatives exist.
  Release the claim on success or failure. Do not delete approved derivatives
  when only the private original expires. Verify storage errors before retrying.
- Hiding/rejecting a review immediately revokes its public image endpoints;
  it does not physically erase photos. Remove files during the associated
  review deletion, within the approved 90-day limits, or promptly on withdrawal.
- Maintain EU bucket privacy: r2.dev disabled, no public custom domains.
  Public endpoints serve approved re-encoded derivatives only, never originals.
- Monthly completion notes contain counts/dates/actions, not customer content.
  Audit logs remain limited to 12 months; holds require a recorded reason and
  reassessment. Respect Cloudflare backup retention and never promise instant
  removal of copies already downloaded by visitors.
