-- ============================================================================
-- WORKSPACE & IDENTITY — M2: SCENARIO SCOPING (S-2)
-- ============================================================================
-- AUTHORED AS CODE — NOT YET EXECUTED. Depends on M1 (same batch, ordered).
-- Execution blocked until the drift register precedes it (Gate-1 verdict).
-- Contract: docs/specs/workspace-identity-schema-contract-v1.md v1.2 §2.
-- Authored AGAINST LIVE STATE (Gate-1 verdict instruction): live scenarios
-- carry ~611 guest rows with user_id NULL — the checked-in 2026-02 schema's
-- NOT NULL is long superseded; all counts below are dynamic.
--
-- Adds: scenarios.workspace_id (FK ON DELETE SET NULL — records-outlive-
-- container doctrine, contract §1.6) · UNIQUE(id, workspace_id) composite-FK
-- target for M6 child tables · at-birth stamping trigger (WS020 abort) ·
-- immutability trigger (WS010/WS011; sentinel-guarded value→NULL; claim-shape
-- NULL→value) · owned-row backfill (dynamic, orphan-tolerant).
-- Scenarios RLS: BYTE-UNCHANGED (ratified P3 posture — cutover is later).
-- Classification: REVERSIBLE pre-cutover (rollback file present).
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
  'W&I M2: tenancy at birth (trigger-stamped). NULL = guest/unscoped. Immutable once set (WS010/WS011); ON DELETE SET NULL = records-outlive-container.';

-- ---------------------------------------------------------------------------
-- 2. Backfill BEFORE the immutability trigger exists (its NULL→value updates
--    are exactly what the trigger will forbid afterwards). Owned rows whose
--    owner still exists get their personal workspace (M1 guarantees one per
--    auth user). Orphans (owner deleted — user_id has no FK since guest-mode
--    migration) stay NULL and are counted, not aborted: they are retained
--    authorship history, the same class the claim flow re-scopes.
-- ---------------------------------------------------------------------------
UPDATE public.scenarios s
   SET workspace_id = w.id
  FROM public.workspaces w
 WHERE w.created_by = s.user_id AND w.is_personal
   AND s.user_id IS NOT NULL AND s.workspace_id IS NULL;

-- ---------------------------------------------------------------------------
-- 3. Stamping trigger (BEFORE INSERT) — contract §2
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
    -- A non-guest user without a personal workspace is an invariant breach,
    -- never a silent NULL (contract v1.1 fix).
    RAISE EXCEPTION 'scenarios: no personal workspace for user % — provisioning invariant breached', NEW.user_id
      USING ERRCODE = 'WS020';
  END IF;
  NEW.workspace_id := v_ws;            -- caller-supplied values overridden in MVP
  RETURN NEW;
END $$;
ALTER FUNCTION public.scenarios_stamp_workspace() OWNER TO wsid_definer;

CREATE TRIGGER scenarios_stamp_workspace
  BEFORE INSERT ON public.scenarios
  FOR EACH ROW EXECUTE FUNCTION public.scenarios_stamp_workspace();

-- ---------------------------------------------------------------------------
-- 4. Immutability trigger (BEFORE UPDATE) — contract §2 (v1.2 erratum applied:
--    FK SET NULL referential actions DO fire row triggers, so value→NULL is
--    sentinel-recognised, not assumed invisible)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.scenarios_workspace_immutable()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public AS $$
BEGIN
  IF NEW.workspace_id IS NOT DISTINCT FROM OLD.workspace_id THEN
    RETURN NEW;
  END IF;
  -- value → NULL: only the account-deletion path (FK SET NULL under sentinel)
  IF OLD.workspace_id IS NOT NULL AND NEW.workspace_id IS NULL THEN
    IF coalesce(current_setting('app.wsid_deletion', true), '') = 'on' THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'scenarios: workspace_id is immutable once set (transfer RPC deferred)'
      USING ERRCODE = 'WS010';
  END IF;
  -- value → different value: forbidden until the transfer RPC exists
  IF OLD.workspace_id IS NOT NULL THEN
    RAISE EXCEPTION 'scenarios: workspace_id is immutable once set (transfer RPC deferred)'
      USING ERRCODE = 'WS010';
  END IF;
  -- NULL → value: ONLY the claim shape — user_id transitions NULL→non-NULL in
  -- the same statement AND the target is the claimer''s personal workspace.
  IF OLD.user_id IS NULL AND NEW.user_id IS NOT NULL
     AND NEW.workspace_id = (SELECT id FROM public.workspaces
                             WHERE created_by = NEW.user_id AND is_personal) THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'scenarios: workspace_id may only be set by the claim flow'
    USING ERRCODE = 'WS011';
END $$;
ALTER FUNCTION public.scenarios_workspace_immutable() OWNER TO wsid_definer;

CREATE TRIGGER scenarios_workspace_immutable
  BEFORE UPDATE ON public.scenarios
  FOR EACH ROW EXECUTE FUNCTION public.scenarios_workspace_immutable();

-- NOTE (cross-repo, recorded): claim_guest_scenario (CEE-homed migration) gains
-- its workspace-stamping statement in its next amendment — the sanctioned
-- NULL→value writer. Until then guest claims set user_id only and the scenario
-- stays unscoped; the claim-shape rule above already admits the amended form.
-- RLS on scenarios: deliberately untouched (P3; policy-count asserted below).

-- ---------------------------------------------------------------------------
-- 5. In-transaction verification — COMMIT only on pass
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_owned    BIGINT;
  v_stamped  BIGINT;
  v_orphans  BIGINT;
  v_guests   BIGINT;
  v_policies BIGINT;
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

  -- Orphans (owner account no longer exists) are tolerated but must equal the
  -- unstamped remainder exactly — anything else means the backfill missed rows.
  IF v_orphans <> (SELECT count(*) FROM public.scenarios s
                    WHERE s.user_id IS NOT NULL
                      AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = s.user_id)) THEN
    RAISE EXCEPTION 'M2 verify: unstamped owned rows are not all owner-orphans (unstamped=%, orphans expected from auth.users diff)', v_orphans;
  END IF;

  IF (SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
      WHERE c.relname = 'scenarios' AND NOT t.tgisinternal
        AND t.tgname IN ('scenarios_stamp_workspace','scenarios_workspace_immutable')) <> 2 THEN
    RAISE EXCEPTION 'M2 verify: trigger pair missing';
  END IF;

  -- Scenarios RLS byte-unchanged: same four owner-only policies as Gate-0.
  SELECT count(*) INTO v_policies FROM pg_policies WHERE tablename = 'scenarios';
  IF v_policies <> 4 THEN
    RAISE EXCEPTION 'M2 verify: scenarios policy count changed (%; expected 4 untouched owner-only policies)', v_policies;
  END IF;

  RAISE NOTICE 'M2 verify PASS: owned=% stamped=% owner-orphans(left NULL)=% guests(unscoped)=%',
    v_owned, v_stamped, v_orphans, v_guests;
END $$;

COMMIT;
