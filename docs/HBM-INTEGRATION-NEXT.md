# Next bounded PRs (not implemented)

## Owner read-only Supabase procedure
No authorized Supabase connector/session was available. Do not use the Desktop Start Production Bootstrap button as an inspection tool. Do not sign in, claim/register, or call mutation RPCs merely to inspect.

1. In an existing owner dashboard session verify the intended production project locally; do not share keys or project credentials.
2. Open docs/HBM-CLOUD-READONLY.sql. Execute SELECT sections separately. If a referenced object is missing, record unavailable and stop that section; do not create/fix it. Export only the displayed aggregate results, no table-editor screenshots containing contacts.
3. Migration version history is evidence of tracking, not proof SQL matches deployed functions. Compare inventory with Desktop supabase/migrations 0001..0005. Owner review of policy USING/WITH CHECK, grants and SECURITY DEFINER bodies is still required; the safe aggregate report intentionally omits their text. A boolean search_path mismatch needs inspection, not automatic alteration.
4. Workspace ownership/member/device consistency and same-workspace FK checks must pass. Counts are observational: never require an historical bootstrap count or an empty database universally. ACTIVE/BOOTSTRAPPING must be interpreted with actual session evidence. Sequence gaps in a global change feed are not proof of loss.
5. Checkpoints/conflicts are client-local in this version, not presumed Supabase tables. On a verified isolated Desktop snapshot use SQLite mode=ro and query_only=ON: SELECT status,count(*) FROM sync_outbox GROUP BY status; SELECT count(*),max(last_remote_checkpoint) FROM sync_checkpoints; SELECT category,count(*) FROM sync_conflicts GROUP BY category; SELECT count(*) FROM sync_inbox;. Compare each device checkpoint privately with the corresponding workspace change feed; share only aggregate lag, not device identities. Do not start Desktop against a snapshot because startup may migrate it.

## PR04: outbox dispatcher
Depends on durable storage + staging key provisioning. Add lease expiry, fencing, bounded batches, Retry-After/jitter and HBM idempotent receipts. Mail SENDING/UNCERTAIN requires provider reconciliation; never blind resend. Test concurrent consumers, process crash, auth failure, rate limit, timeout after remote commit. Accept: accepted payload cannot disappear and unconfirmed tasks remain visible. Rollback: pause dispatcher only, keep capture and backlog.

## PR05: Supabase Inbox
Depends on live read-only verification + contract. Add source-scoped intake receipts, immutable item versions, memberships/RLS and notification outbox. Source-to-workspace mapping is server-owned. Test cross-tenant denial, repeated events, malicious workspace input, transaction rollback and receipt replay. Accept: exactly one logical item/event under at-least-once transport. Rollback: stop ingest, retain D1 backlog; additive schema stays.

## PR06-09: auth, read-only Android Inbox, FCM
Depends on Inbox/auth membership, not financial sync. Preserve applicationId, signing/update path, core SQLite and current backup compatibility. Isolated rebuildable read cache, no auto Job creation. Restore INTERNET permission deliberately; add notification permission/channel and secure session handling. Bind tokens to authorized user/device/workspace, rotate/revoke, exclude PII from push. Test declined permission, offline CRUD, token change, logout/revocation, foreground/background/cold start, missed push recovered by cursor fetch. Accept: no push can cross business boundaries; no network blocks offline work. Rollback feature gates, never uninstall/clear data.

## PR10-13: SyncEngine safety
Independent of early read-only Inbox. Split into ordering/workspace scoping + per-mutation ACK; pending/in-flight conflict deferral; immutable sent envelope + sequential baseline revision chain; tombstone projections/dependency visibility. Existing engine.py/supabase_transport.py/repositories are the starting points. Test same timestamp and reversed clocks; two runners; partial server ACK; edits A/B/C offline; remote update/delete against pending; crash after apply before checkpoint; unknown DELETE then stale UPSERT. Accept no lost local edit, no mutation-ID payload reuse, no resurrection, durable conflict before cursor progress. Rollback: sync OFF, preserve journals/revisions/audit, no schema downgrade destroying history.

## PR14: Inbox conversion
Depends on stable core sync, numbering policy and reviewed Customer matching. Command is idempotent and revision-checked; two devices cannot create two Jobs from one conversion. Q-SITE stays external reference, estimate stays indicative, availability stays preference, official Quote follows Desktop. Test concurrent conversion, customer ambiguity, offline queued command and repeated receipt. Rollback disables conversion, retains item and links.

No phase here authorizes production migrations, deploy, sync enablement, secret/RLS changes or app publication.
