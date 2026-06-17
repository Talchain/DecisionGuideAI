-- ============================================================================
-- !!! DRAFT COLLABORATION CUTOVER — DO NOT APPLY — BLOCKED !!!
-- ============================================================================
-- File: 20260617000001_scenarios_workspace_cutover_draft.sql
-- Lane: Collaboration MVP infrastructure acceleration (DDL + static validation)
-- Design input: DRAFT tenancy/collaboration spec v1.7 (PR #190), a DRAFT validation
--               baseline, not a banked/approved spec. See
--               docs/audits/collab-foundation-blocker-checklist-v1.md.
--
-- THIS FILE IS:
--   * draft only;
--   * NOT for canonical application (never apply to etmmuzwxtcjipwphdola);
--   * NOT for merge or deploy;
--   * rehearsal-only when explicitly approved;
--   * the destructive tenancy cutover, BLOCKED until ALL of these gates close:
--       - the V5 single-user golden journey is clean on staging;
--       - the deployed VITE_SUPABASE_URL is confirmed;
--       - a rehearsal Supabase environment (or approved clone) exists;
--       - cross-repo CEE service-role workspace-resolution is verified in
--         olumi-assistants-service (append_turn_atomic, ensure_scenario_exists,
--         store_draft_graph);
--       - the behavioural SEC/TEN matrix is executable and green.
--
-- THIS IS END-STATE DDL FOR REVIEW AND STATIC VALIDATION ONLY.
-- It is NOT the real application sequence. The real migration MUST follow the
-- v1.7 §20 phased process: expand -> backfill -> assert -> switch -> rehearse,
-- and only then consider canonical application. Do NOT let this become a future
-- single-shot destructive cutover. The statements below show the END STATE, not
-- an apply-now script.
--
-- The `_draft` suffix is NOT sufficient protection: Supabase migration tooling
-- applies files by timestamp order, and this file lives under supabase/migrations/.
-- The abort guard below makes accidental whole-file application fail safely.
-- ============================================================================

DO $$ BEGIN
  RAISE EXCEPTION 'DRAFT collaboration migration — must not be applied; see header and gates';
END $$;

-- ============================================================================
-- END-STATE DDL (unreachable past the guard above when applied as a transaction).
-- For review and static-contract validation only.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Expand: scenarios gains workspace_id and a composite key target so child rows
-- can enforce (scenario_id, workspace_id) consistency via composite FK (§9).
-- Phased process (v1.7 §20): this is the EXPAND step only. Backfill, assert, and
-- the RLS switch are separate, rehearsed steps — not a single shot.
-- ----------------------------------------------------------------------------

ALTER TABLE scenarios
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES workspaces(id);

ALTER TABLE scenarios
  ADD CONSTRAINT scenarios_id_workspace_unique UNIQUE (id, workspace_id);

-- ----------------------------------------------------------------------------
-- Child workspace_id consistency (§9) for existing child tables.
-- Each child derives workspace_id server-side from its parent scenario; the
-- composite FK (scenario_id, workspace_id) -> scenarios(id, workspace_id) makes
-- a parent/child mismatch impossible. workspace_id is NOT trusted from the client.
-- (Collaboration-surface child tables — element_comments, scenario_edit_locks,
-- patch_suggestions — are OUT OF SCOPE for this lane.)
-- ----------------------------------------------------------------------------

ALTER TABLE conversation_turns
  ADD COLUMN IF NOT EXISTS workspace_id uuid,
  ADD CONSTRAINT conversation_turns_workspace_consistency
    FOREIGN KEY (scenario_id, workspace_id) REFERENCES scenarios(id, workspace_id);

ALTER TABLE scenario_snapshots
  ADD COLUMN IF NOT EXISTS workspace_id uuid,
  ADD CONSTRAINT scenario_snapshots_workspace_consistency
    FOREIGN KEY (scenario_id, workspace_id) REFERENCES scenarios(id, workspace_id);

ALTER TABLE shared_briefs
  ADD COLUMN IF NOT EXISTS workspace_id uuid,
  ADD CONSTRAINT shared_briefs_workspace_consistency
    FOREIGN KEY (scenario_id, workspace_id) REFERENCES scenarios(id, workspace_id);

ALTER TABLE v5_conversation_turns
  ADD COLUMN IF NOT EXISTS workspace_id uuid,
  ADD CONSTRAINT v5_conversation_turns_workspace_consistency
    FOREIGN KEY (scenario_id, workspace_id) REFERENCES scenarios(id, workspace_id);

ALTER TABLE v5_handler_facts
  ADD COLUMN IF NOT EXISTS workspace_id uuid,
  ADD CONSTRAINT v5_handler_facts_workspace_consistency
    FOREIGN KEY (scenario_id, workspace_id) REFERENCES scenarios(id, workspace_id);

-- ----------------------------------------------------------------------------
-- workspace_id immutability (§10): once set, workspace_id may change only through
-- a dedicated transfer RPC, never a generic UPDATE. Trigger skeleton; the
-- implementation lane completes and tests it. user_id/author columns are retained
-- as authorship attribution.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION enforce_workspace_id_immutable()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = pg_catalog, public
AS $$
BEGIN
  IF OLD.workspace_id IS NOT NULL AND NEW.workspace_id IS DISTINCT FROM OLD.workspace_id THEN
    RAISE EXCEPTION 'workspace_id is immutable; use the dedicated transfer RPC';
  END IF;
  RETURN NEW;
END;
$$;
-- Triggers binding this function to scenarios and child tables are added in the
-- implementation lane (one CREATE TRIGGER per workspace-linked table).

-- ----------------------------------------------------------------------------
-- Switch: membership-based RLS replaces single-user auth.uid() = user_id on the
-- workspace-shared tables. THIS IS THE DESTRUCTIVE STEP. In the real process it
-- runs only after expand + backfill + assert pass on the rehearsal environment.
-- Per-user tables (conversation_turns, v5_conversation_turns, v5_handler_facts)
-- keep per-user RLS within the workspace (SEC-10) and are not shown switching here.
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Users can read own scenarios" ON scenarios;
CREATE POLICY "members_read_workspace_scenarios" ON scenarios
  FOR SELECT TO authenticated USING (is_workspace_member(workspace_id));

-- (INSERT/UPDATE/DELETE membership policies and the per-RPC guarded paths follow
-- the v1.7 §11/§15 matrix; shown abbreviated here as end-state intent.)

-- ----------------------------------------------------------------------------
-- H-1+ hardening (§13) for the two CEE per-user tables. These currently lack
-- FORCE RLS, target role `public` in their SELECT policy, and grant anon DML.
-- ----------------------------------------------------------------------------

ALTER TABLE v5_conversation_turns FORCE ROW LEVEL SECURITY;
ALTER TABLE v5_handler_facts FORCE ROW LEVEL SECURITY;

REVOKE ALL ON v5_conversation_turns FROM anon;
REVOKE ALL ON v5_handler_facts FROM anon;

DROP POLICY IF EXISTS "select_own_v5_conversation_turns" ON v5_conversation_turns;
CREATE POLICY "select_own_v5_conversation_turns" ON v5_conversation_turns
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "select_own_v5_handler_facts" ON v5_handler_facts;
CREATE POLICY "select_own_v5_handler_facts" ON v5_handler_facts
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- CEE service-role paths — CROSS-REPO BLOCKER, NOT SOLVED HERE.
-- append_turn_atomic, ensure_scenario_exists, and store_draft_graph bypass RLS
-- and write scenarios/child rows with the service-role key. They MUST derive
-- workspace_id server-side (verifying membership, never trusting a client value),
-- including during the migration window. Their bodies live in olumi-assistants-service,
-- NOT this repo, so this cutover cannot proceed until that cross-repo verification
-- is complete (v1.7 §15.1, §20). This comment is the explicit blocker marker.
-- ----------------------------------------------------------------------------

-- ============================================================================
-- END of cutover draft. END-STATE DDL ONLY. NOT APPLIED. BLOCKED. NOT FOR MERGE/DEPLOY.
-- ============================================================================
