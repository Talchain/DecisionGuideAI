-- ============================================================================
-- F3 CONTAINMENT — drop the legacy cross-organisation profile-read policy
-- ============================================================================
-- STATUS: the containment this file records was ALREADY EXECUTED on staging
-- Supabase (etmmuzwxtc) 2026-07-11 18:24 UTC by A1 under the emergency-
-- security exception (parallel-briefs/A1-RULING-F3-AND-GATE1-2026-07-12.md).
-- EVIDENTIARY PRECISION (review round 3): this file is the CANONICAL
-- REPLAY-SAFE migration, NOT the byte-exact executed script. The exact
-- script-as-run (incl. simulated-JWT allow/deny post-checks with resolved
-- user ids) + the execution transcript + fresh-session recheck live in
-- acceptance-evidence/security/F3-CONTAINMENT-2026-07-12.md. This replay file
-- carries the same pre-check/DROP/catalog-post-check core, is idempotent
-- (no-op where the policy is already gone), and omits the behavioural JWT
-- section (already evidenced; ids do not belong in a migration file).
-- Rollback (policy recreation) exists but RE-OPENS THE LEAK:
-- rollback/20260712063000_f3_..._rollback.sql.do-not-apply.
-- Drift register: supabase/MIGRATION-DRIFT-REGISTER.md entry #1 (ledger row
-- pending the Gate-6 reconciliation plan).
--
-- WHAT / WHY: user_profiles carried a third SELECT policy,
-- "Users can view accessible profiles", whose predicate let ANY member of a
-- legacy organisation read co-members' ENTIRE profile rows (science-POC
-- sensitive columns + phone/address/age/gender PII; 8 viewer->subject pairs,
-- 3 exposed subjects at audit time). Sole code consumer: legacy
-- src/components/Analysis.tsx collaborator-email lookup, which tolerates
-- absent emails by construction (explicit fallback path) — drop-now ruled
-- proportionate. Evidence: parallel-briefs/workspace-lane-evidence/gate0/ +
-- acceptance-evidence/security/F3-CONTAINMENT-2026-07-12.md (behavioural
-- allow/deny verification under simulated JWT context ran at execution).
-- ============================================================================

BEGIN;

DO $$
DECLARE
  v_qual TEXT;
BEGIN
  SELECT qual INTO v_qual
    FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'user_profiles'
     AND policyname = 'Users can view accessible profiles'
     AND cmd = 'SELECT' AND permissive = 'PERMISSIVE';

  IF FOUND THEN
    -- Pre-check: exact predicate shape before dropping (never drop blind).
    IF v_qual NOT LIKE '%organisation_members%' THEN
      RAISE EXCEPTION 'F3 pre-check: policy predicate unexpected — abort: %', v_qual;
    END IF;
    EXECUTE 'DROP POLICY "Users can view accessible profiles" ON public.user_profiles';
    RAISE NOTICE 'F3: policy dropped';
  ELSE
    RAISE NOTICE 'F3: policy already absent (executed 2026-07-12) — no-op replay';
  END IF;
END $$;

-- Post-check (always runs): NO remaining SELECT-capable policy on
-- user_profiles reaches beyond the row owner.
DO $$
DECLARE
  v_bad TEXT;
BEGIN
  SELECT policyname INTO v_bad
    FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'user_profiles'
     AND cmd IN ('SELECT', 'ALL')
     AND qual NOT LIKE '%auth.uid() = id%'
     AND qual NOT LIKE '%id = auth.uid()%'
   LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'F3 post-check: non-self read policy survives on user_profiles: % — abort', v_bad;
  END IF;
END $$;

COMMIT;
