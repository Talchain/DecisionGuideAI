-- J1 · X7 schema assert (SPINE X7; object list: Integrator, programme-docs integrator/github-26
-- output/integrator/J1-SCHEMA-ASSERT.md @335316c8, derived from call sites at CEE b43bb79e
-- and DGAI cd3fdd45). Runs on the local stack after every migration, before any J1 row counts.
--
-- One row per check: class, check, verdict, detail.
--   REQUIRED  PASS | FAIL   any FAIL makes the job red: J1's rows rest on it.
--   SECURITY  PASS | FAIL   anon must NOT execute a CEE-only RPC that takes a scenario id.
--   REPORT    REPORT        recorded, never red (authenticated EXECUTE on SECURITY DEFINER RPCs:
--                           which state is live on the hosted project is UNVERIFIED).
-- A check whose object is missing FAILS; it never silently drops out of the table.
--
-- SCOPE (Integrator, 5 Oct): this measures the STACK's migration-built database. It proves
-- what the migrations declare, never the live ACL: the hosted project has objects no
-- migration creates (cee_prompt_observations, SPINE X7 out-of-band, owner Core Platform).
-- The live ACL is Core Platform's read-only verify (X10).
WITH rpc(name) AS (VALUES
  ('append_turn_atomic_v2'), ('append_agent_answer_with_guidance'), ('append_turn_atomic_v3'),
  ('append_turn_atomic_v4'), ('append_turn_atomic_v5'), ('store_draft_graph'), ('ensure_scenario_exists'),
  ('store_brief_and_provenance'), ('is_scenario_member'), ('get_rolling_summary'), ('upsert_rolling_summary'),
  ('copy_guest_scenario'), ('create_model_version')
),
fn AS (
  SELECT r.name, p.oid, p.prosecdef, pg_get_function_identity_arguments(p.oid) AS args
  FROM rpc r LEFT JOIN pg_proc p ON p.proname = r.name
    AND p.pronamespace = 'public'::regnamespace
),
checks AS (
  -- A. CEE-called RPCs: every overload exists and service_role may EXECUTE it (CEE calls as service_role).
  SELECT 'REQUIRED' AS class, 'rpc ' || name || '(' || coalesce(args, '') || ') exists + service_role EXECUTE' AS check_name,
         CASE WHEN oid IS NOT NULL AND has_function_privilege('service_role', oid, 'EXECUTE') THEN 'PASS' ELSE 'FAIL' END AS verdict,
         CASE WHEN oid IS NULL THEN 'MISSING' ELSE 'secdef=' || prosecdef END AS detail
  FROM fn
  UNION ALL
  -- C. anon must not EXECUTE a CEE-only RPC that takes a scenario id. is_scenario_member is
  -- not CEE-only (RLS policies call it as the querying role), so it is reported, not asserted.
  SELECT 'SECURITY', 'anon cannot EXECUTE ' || name || '(' || args || ')',
         CASE WHEN has_function_privilege('anon', oid, 'EXECUTE') THEN 'FAIL' ELSE 'PASS' END,
         'secdef=' || prosecdef
  FROM fn WHERE oid IS NOT NULL AND args ILIKE '%scenario%' AND name <> 'is_scenario_member'
  UNION ALL
  SELECT 'REPORT', 'EXECUTE on ' || name || '(' || args || ')',
         'REPORT', 'anon=' || has_function_privilege('anon', oid, 'EXECUTE')
           || ' authenticated=' || has_function_privilege('authenticated', oid, 'EXECUTE') || ' secdef=' || prosecdef
  FROM fn WHERE oid IS NOT NULL AND args ILIKE '%scenario%'
  UNION ALL
  -- Tables CEE touches on the path.
  SELECT 'REQUIRED', 'table public.' || t || ' exists',
         CASE WHEN to_regclass('public.' || t) IS NOT NULL THEN 'PASS' ELSE 'FAIL' END, ''
  FROM unnest(ARRAY['scenarios', 'v5_conversation_turns', 'v5_handler_facts', 'v5_turn_fence', 'user_profiles']) AS t
  UNION ALL
  -- B. UI direct access: RLS on.
  SELECT 'REQUIRED', 'RLS enabled on public.' || t,
         CASE WHEN EXISTS (SELECT 1 FROM pg_class c WHERE c.oid = to_regclass('public.' || t) AND c.relrowsecurity) THEN 'PASS' ELSE 'FAIL' END, ''
  FROM unnest(ARRAY['scenarios', 'v5_handler_facts']) AS t
  UNION ALL
  -- Policies. Permissive policies OR together, so the EFFECTIVE set is open if ANY applicable
  -- permissive policy is (Codex buddy r2: an ALL policy USING(true) WITH CHECK(auth.uid() = ...)
  -- passed a token check). For each command the UI uses: at least one applicable permissive
  -- policy (cmd or ALL, a role the UI or anon can hold), and EVERY one of them scopes the
  -- predicate that command evaluates: SELECT/DELETE → USING, INSERT → WITH CHECK, UPDATE → both
  -- (WITH CHECK defaults to USING). "Scopes" = names auth.uid() or is_scenario_member. Static,
  -- so J9 and the ISO rows also probe the same tables BEHAVIOURALLY (B reads A's rows → 0).
  -- (The alias is `want`, never `cmd`: pg_policies has a cmd column, and an unqualified name
  -- inside a subquery would bind to it and match every row.)
  SELECT 'REQUIRED', w.tbl || ' ' || w.want || ': every applicable permissive policy scopes its predicate',
         CASE WHEN count(p.policyname) > 0 AND bool_and(
                CASE w.want
                  WHEN 'SELECT' THEN coalesce(p.qual, 'true') ~* '(auth\.uid\(\)|is_scenario_member)'
                  WHEN 'DELETE' THEN coalesce(p.qual, 'true') ~* '(auth\.uid\(\)|is_scenario_member)'
                  WHEN 'INSERT' THEN coalesce(p.with_check, 'true') ~* '(auth\.uid\(\)|is_scenario_member)'
                  WHEN 'UPDATE' THEN coalesce(p.qual, 'true') ~* '(auth\.uid\(\)|is_scenario_member)'
                                 AND coalesce(p.with_check, p.qual, 'true') ~* '(auth\.uid\(\)|is_scenario_member)'
                END)
              THEN 'PASS' ELSE 'FAIL' END,
         count(p.policyname) || ' applicable: ' || coalesce(string_agg(p.policyname, ', ' ORDER BY p.policyname), 'NONE')
  FROM (VALUES ('scenarios', 'SELECT'), ('scenarios', 'INSERT'), ('scenarios', 'UPDATE'), ('scenarios', 'DELETE'),
               ('v5_handler_facts', 'SELECT')) AS w(tbl, want)
  LEFT JOIN pg_policies p ON p.schemaname = 'public' AND p.tablename = w.tbl
    AND p.cmd IN (w.want, 'ALL') AND p.permissive = 'PERMISSIVE'
    AND p.roles && ARRAY['public', 'anon', 'authenticated']::name[]
  GROUP BY w.tbl, w.want
  UNION ALL
  -- user_profiles: the column the sign-up trigger writes, and the trigger itself.
  SELECT 'REQUIRED', 'user_profiles.email exists',
         CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_profiles' AND column_name = 'email') THEN 'PASS' ELSE 'FAIL' END,
         'hosted-drift.sql shim'
  UNION ALL
  SELECT 'REQUIRED', 'trigger on_auth_user_created on auth.users',
         CASE WHEN EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created' AND tgrelid = 'auth.users'::regclass AND NOT tgisinternal) THEN 'PASS' ELSE 'FAIL' END, ''
)
SELECT class, check_name, verdict, coalesce(detail, '') FROM checks ORDER BY class, check_name;
