-- Owner: verify project in dashboard. Run sections separately in SQL Editor.
-- SELECT only. No register/claim/bootstrap/mutation RPCs. No historical count targets.
-- 1. Migration-history availability. If absent, do NOT create it.
SELECT to_regclass('supabase_migrations.schema_migrations') IS NOT NULL AS migration_history_available;
-- Run only when previous result is true:
SELECT version FROM supabase_migrations.schema_migrations ORDER BY version;
-- 2. Inventory and RLS; names only, no business payloads.
SELECT c.relname AS table_name,c.relrowsecurity AS rls_enabled,c.relforcerowsecurity AS force_rls
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='hbm' AND c.relkind IN ('r','p') ORDER BY c.relname;
SELECT tablename,cmd,roles,count(*) AS policy_count FROM pg_policies
WHERE schemaname='hbm' GROUP BY tablename,cmd,roles ORDER BY tablename,cmd;
-- Direct privileges and function security, without function source or policy expressions.
SELECT table_name,grantee,privilege_type FROM information_schema.role_table_grants
WHERE table_schema='hbm' AND grantee IN ('anon','authenticated','PUBLIC') ORDER BY table_name,grantee,privilege_type;
SELECT n.nspname AS schema_name,p.proname,p.prosecdef AS security_definer,
 has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute,
 has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_execute,
 NOT EXISTS(SELECT 1 FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE a.grantee=0 AND a.privilege_type='EXECUTE') AS public_execute_denied,
 coalesce(p.proconfig @> ARRAY['search_path=hbm, pg_catalog'],false) AS expected_search_path
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='hbm' OR (n.nspname='public' AND p.proname LIKE 'hbm_%') ORDER BY 1,2;
-- 3. Run only if inventory confirms all referenced tables/columns exist.
-- Workspace ordinals are pseudonyms for this report, not business identifiers.
SELECT row_number() OVER(ORDER BY w.id) AS workspace_ordinal,w.is_test,w.bootstrap_state,
 (SELECT count(*) FROM hbm.workspace_memberships m WHERE m.workspace_id=w.id) AS memberships,
 (SELECT count(*) FROM hbm.workspace_memberships m WHERE m.workspace_id=w.id AND m.role='OWNER') AS owners,
 (SELECT count(*) FROM hbm.devices d WHERE d.workspace_id=w.id) AS devices,
 (SELECT count(*) FROM hbm.sync_customers c WHERE c.workspace_id=w.id) AS customers,
 (SELECT count(*) FROM hbm.sync_jobs j WHERE j.workspace_id=w.id) AS jobs,
 (SELECT count(*) FROM hbm.sync_job_scope_lines s WHERE s.workspace_id=w.id) AS scope_lines,
 (SELECT count(*) FROM hbm.sync_visits v WHERE v.workspace_id=w.id) AS visits,
 (SELECT max(checkpoint) FROM hbm.sync_changes ch WHERE ch.workspace_id=w.id) AS latest_change_checkpoint
FROM hbm.workspaces w ORDER BY w.id;
SELECT role,count(*) AS membership_count FROM hbm.workspace_memberships GROUP BY role;
SELECT state,count(*) AS session_count FROM hbm.workspace_bootstrap_sessions GROUP BY state;
SELECT count(*) AS changes,count(DISTINCT mutation_id) AS unique_mutations,min(checkpoint) AS first_checkpoint,max(checkpoint) AS latest_checkpoint FROM hbm.sync_changes;
SELECT count(*) AS mutation_receipts FROM hbm.sync_mutations;
SELECT 'customers' AS entity,count(*) AS total,count(*) FILTER(WHERE deleted_at IS NOT NULL) AS tombstones FROM hbm.sync_customers
UNION ALL SELECT 'jobs',count(*),count(*) FILTER(WHERE deleted_at IS NOT NULL) FROM hbm.sync_jobs
UNION ALL SELECT 'scope',count(*),count(*) FILTER(WHERE deleted_at IS NOT NULL) FROM hbm.sync_job_scope_lines
UNION ALL SELECT 'visits',count(*),count(*) FILTER(WHERE deleted_at IS NOT NULL) FROM hbm.sync_visits;
SELECT count(*) AS orphan_jobs FROM hbm.sync_jobs j LEFT JOIN hbm.sync_customers c ON c.id=j.customer_id AND c.workspace_id=j.workspace_id WHERE c.id IS NULL;
SELECT count(*) AS orphan_scope FROM hbm.sync_job_scope_lines s LEFT JOIN hbm.sync_jobs j ON j.id=s.job_id AND j.workspace_id=s.workspace_id WHERE j.id IS NULL;
SELECT count(*) AS orphan_visits FROM hbm.sync_visits v LEFT JOIN hbm.sync_jobs j ON j.id=v.job_id AND j.workspace_id=v.workspace_id WHERE j.id IS NULL;
