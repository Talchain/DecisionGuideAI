-- ============================================================================
-- WORKSPACE & IDENTITY — M2: SCENARIO SCOPING (S-2)  [rev 2]
-- ============================================================================
-- AUTHORED AS CODE — NOT YET EXECUTED. Depends on M1 (same batch, ordered).
-- Execution blocked until the drift register precedes it + rehearsal (M1 hdr).
-- Contract: docs/specs/workspace-identity-schema-contract-v1.md v1.2+ §2.
-- Authored AGAINST LIVE STATE: ~611 guest rows with user_id NULL; dynamic
-- counts throughout.
--
-- rev 2 (external review round 3 + automated finding):
--   * P0 CLAIM FIX: the UPDATE trigger now AUTO-STAMPS workspace_id when
--     user_id transitions NULL→non-NULL. The previous rev required the claim
--     writer to set workspace_id in the same statement — but the live
--     claim_guest_scenario updates user_id ONLY, which would have left every
--     post-M2 claim PERMANENTLY unscoped (the claim-shape predicate can never
--     be satisfied by a later statement). Now: today's claim works unmodified
--     and stamping is atomic; the CEE-side amendment becomes defence-in-depth,
--     not a hard dependency.
--   * Owner-orphan rows (user_id set, owner's auth account gone) are NOT
--     claim-flow class — they cannot be claimed (claim requires user_id NULL)
--     and account deletion CREATES more of them (workspace SET NULL + soft
--     authorship retained). Left NULL here unchanged, but their lifecycle
--     (quarantine/destroy/tombstone/transfer/retain-under-non-user-subject)
--     is ROUTED as CQ-17 — not inferred inside a migration.
--   * Scenarios-RLS assertion upgraded from policy COUNT to a canonical
--     FINGERPRINT of (policyname|cmd|roles|qual|with_check) — computed from
--     the Gate-0 live catalog. Abort on ANY drift, not just count changes.
--   * Trigger functions get explicit PUBLIC/anon EXECUTE revokes.
--   * value→NULL requires the SUBJECT-SCOPED deletion sentinel (M1 rev 2).
--     Sentinel integrity assumption (contract-noted): JWT roles cannot run
--     multi-statement transactions through PostgREST, so they cannot pair
--     set_config with a DML statement.
-- Classification: REVERSIBLE pre-cutover (rollback file, refusal-guarded).
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Column + composite-FK target + index
-- ---------------------------------------------------------------------------
ALTER TABLE public.scenarios
  ADD COLUMN workspace_id UUID NULL
  REFERENCES public.workspaces(id) ON DELETE SET NULL;

ALTER TABLE public.scenarios
  ADD CONSTRAINT scenarios_id_workspace_key UNIQUE (id, workspace_id);

CREATE INDEX scenarios_workspace_idx
  ON public.scenarios (workspace_id) WHERE workspace_id IS NOT NULL;

COMMENT ON COLUMN public.scenarios.workspace_id IS
  'W&I M2: tenancy at birth (INSERT trigger) and at claim (UPDATE trigger auto-stamp). NULL = guest/unscoped or owner-orphan (CQ-17). Immutable otherwise (WS010/WS011); ON DELETE SET NULL = records-outlive-container.';

-- ---------------------------------------------------------------------------
-- 2. Backfill BEFORE the guard trigger exists (its NULL→value rule would
--    forbid these very updates). Owned rows whose owner still exists get the
--    owner's personal workspace (M1 guarantees one per auth user).
--    Owner-ORPHAN rows (authorship uuid no longer in auth.users — user_id has
--    had no FK since the guest-mode migration) stay NULL: their lifecycle is
--    CQ-17, a Paul ruling, not a migration inference.
-- ---------------------------------------------------------------------------
UPDATE public.scenarios s
   SET workspace_id = w.id
  FROM public.workspaces w
 WHERE w.created_by = s.user_id AND w.is_personal
   AND s.user_id IS NOT NULL AND s.workspace_id IS NULL;

-- ---------------------------------------------------------------------------
-- 3. Stamping trigger (BEFORE INSERT)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.scenarios_stamp_workspace()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public AS $$
DECLARE
  v_ws UUID;
BEGIN
  IF NEW.user_id IS NULL THEN
    NEW.workspace_id := NULL;          -- guest: unscoped until claim
    RETURN NEW;
  END IF;
  SELECT id INTO v_ws FROM public.workspaces
   WHERE created_by = NEW.user_id AND is_personal;
  IF v_ws IS NULL THEN
    RAISE EXCEPTION 'scenarios: no personal workspace for user % — provisioning invariant breached', NEW.user_id
      USING ERRCODE = 'WS020';
  END IF;
  NEW.workspace_id := v_ws;            -- caller-supplied values overridden in MVP
  RETURN NEW;
END $$;
ALTER FUNCTION public.scenarios_stamp_workspace() OWNER TO wsid_definer;
REVOKE ALL ON FUNCTION public.scenarios_stamp_workspace() FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER scenarios_stamp_workspace
  BEFORE INSERT ON public.scenarios
  FOR EACH ROW EXECUTE FUNCTION public.scenarios_stamp_workspace();

-- ---------------------------------------------------------------------------
-- 4. Guard trigger (BEFORE UPDATE): claim auto-stamp + immutability
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.scenarios_workspace_immutable()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public AS $$
DECLARE
  v_ws UUID;
BEGIN
  -- CLAIM (user_id NULL → non-NULL): AUTO-STAMP the claimer's personal
  -- workspace (rev 2 — the live claim writer sets user_id only; requiring it
  -- to also set workspace_id would strand every claim as unscoped forever).
  IF OLD.user_id IS NULL AND NEW.user_id IS NOT NULL THEN
    SELECT id INTO v_ws FROM public.workspaces
     WHERE created_by = NEW.user_id AND is_personal;
    IF v_ws IS NULL THEN
      RAISE EXCEPTION 'scenarios: no personal workspace for claimer % — provisioning invariant breached', NEW.user_id
        USING ERRCODE = 'WS020';
    END IF;
    IF NEW.workspace_id IS NOT NULL AND NEW.workspace_id <> v_ws THEN
      RAISE EXCEPTION 'scenarios: claim may only scope to the claimer''s personal workspace'
        USING ERRCODE = 'WS011';
    END IF;
    NEW.workspace_id := v_ws;
    RETURN NEW;
  END IF;

  -- NON-CLAIM updates: workspace_id is immutable.
  IF NEW.workspace_id IS NOT DISTINCT FROM OLD.workspace_id THEN
    RETURN NEW;
  END IF;
  IF OLD.workspace_id IS NOT NULL AND NEW.workspace_id IS NULL THEN
    -- Only the account-deletion path (FK SET NULL under the SUBJECT-scoped
    -- sentinel — FK referential actions DO fire row triggers).
    IF coalesce(current_setting('app.wsid_deletion', true), '') <> '' THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'scenarios: workspace_id is immutable once set (transfer RPC deferred)'
      USING ERRCODE = 'WS010';
  END IF;
  IF OLD.workspace_id IS NOT NULL THEN
    RAISE EXCEPTION 'scenarios: workspace_id is immutable once set (transfer RPC deferred)'
      USING ERRCODE = 'WS010';
  END IF;
  RAISE EXCEPTION 'scenarios: workspace_id may only be set at birth or claim'
    USING ERRCODE = 'WS011';
END $$;
ALTER FUNCTION public.scenarios_workspace_immutable() OWNER TO wsid_definer;
REVOKE ALL ON FUNCTION public.scenarios_workspace_immutable() FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER scenarios_workspace_immutable
  BEFORE UPDATE ON public.scenarios
  FOR EACH ROW EXECUTE FUNCTION public.scenarios_workspace_immutable();

-- NOTE (cross-repo, recorded): claim_guest_scenario (CEE-homed) needs NO
-- change for stamping to work (the trigger stamps). Its future amendment may
-- add an explicit workspace_id for defence-in-depth; the trigger accepts
-- exactly the personal-workspace value and rejects anything else.
-- RLS on scenarios: deliberately untouched (P3; fingerprint-asserted below).

-- ---------------------------------------------------------------------------
-- 5. In-transaction verification — COMMIT only on pass
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_owned    BIGINT;
  v_stamped  BIGINT;
  v_orphans  BIGINT;
  v_guests   BIGINT;
  v_fp       TEXT;
BEGIN
  SELECT count(*) FILTER (WHERE user_id IS NOT NULL),
         count(*) FILTER (WHERE user_id IS NOT NULL AND workspace_id IS NOT NULL),
         count(*) FILTER (WHERE user_id IS NOT NULL AND workspace_id IS NULL),
         count(*) FILTER (WHERE user_id IS NULL)
    INTO v_owned, v_stamped, v_orphans, v_guests
    FROM public.scenarios;

  IF EXISTS (SELECT 1 FROM public.scenarios WHERE user_id IS NULL AND workspace_id IS NOT NULL) THEN
    RAISE EXCEPTION 'M2 verify: guest row acquired a workspace_id';
  END IF;

  -- Unstamped owned rows must be exactly the owner-orphans (CQ-17 class).
  IF v_orphans <> (SELECT count(*) FROM public.scenarios s
                    WHERE s.user_id IS NOT NULL
                      AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = s.user_id)) THEN
    RAISE EXCEPTION 'M2 verify: unstamped owned rows are not all owner-orphans';
  END IF;

  IF (SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = 'scenarios' AND NOT t.tgisinternal
        AND t.tgenabled = 'O'
        AND t.tgname IN ('scenarios_stamp_workspace','scenarios_workspace_immutable')) <> 2 THEN
    RAISE EXCEPTION 'M2 verify: trigger pair missing or disabled';
  END IF;

  -- Scenarios RLS fingerprint: canonical digest of the FOUR owner-only
  -- policies exactly as captured in the Gate-0 live catalog
  -- (parallel-briefs/workspace-lane-evidence/gate0/db-catalog-2026-07-11.json).
  -- ANY drift in name/cmd/roles/USING/WITH CHECK aborts — count alone proved
  -- nothing (review round 3).
  SELECT md5(string_agg(policyname || '|' || cmd || '|' || roles::text || '|'
                        || coalesce(qual, '') || '|' || coalesce(with_check, ''),
                        E'\n' ORDER BY policyname))
    INTO v_fp
    FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'scenarios';
  IF v_fp IS DISTINCT FROM '9fc10354ad48a5e8adaef51cce11a4b9' THEN
    RAISE EXCEPTION 'M2 verify: scenarios policy-set fingerprint drifted (got %) — P3 byte-unchanged promise would be false; investigate before executing', v_fp;
  END IF;

  RAISE NOTICE 'M2 verify PASS: owned=% stamped=% owner-orphans(NULL, CQ-17)=% guests(unscoped)=%',
    v_owned, v_stamped, v_orphans, v_guests;
END $$;

COMMIT;
