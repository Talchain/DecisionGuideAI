-- BIL Phase 1: conversation_turns — normalised, append-only audit trail
-- Additive to existing scenarios.thread JSONB column (Track 2).
-- Both systems are active during transition; cleanup is a future migration.
--
-- Append-only by design: no UPDATE policy. Cascade from scenarios handles cleanup.
-- All changes are idempotent (safe to run multiple times).

-- ============================================================
-- Table: conversation_turns
-- ============================================================

CREATE TABLE IF NOT EXISTS conversation_turns (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id          uuid NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  user_id              uuid NOT NULL REFERENCES auth.users(id),
  snapshot_id          uuid REFERENCES scenario_snapshots(id),
  analysis_snapshot_id uuid REFERENCES scenario_snapshots(id),
  role                 text NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content              text,
  structured_blocks    jsonb,
  client_turn_id       text,  -- caller-provided idempotency key
  created_at           timestamptz NOT NULL DEFAULT now()
  -- No updated_at: append-only
);

ALTER TABLE conversation_turns ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_turns FORCE ROW LEVEL SECURITY;

-- RLS: users can only see and create their own turns
-- No UPDATE or DELETE policy — append-only
CREATE POLICY "select_own_turns" ON conversation_turns
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_turns" ON conversation_turns
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Index: efficient chronological lookup per scenario
CREATE INDEX IF NOT EXISTS idx_turns_scenario
  ON conversation_turns(scenario_id, created_at ASC);

-- Idempotency: prevent duplicate writes with the same client_turn_id per scenario
CREATE UNIQUE INDEX IF NOT EXISTS idx_turns_idempotency
  ON conversation_turns(scenario_id, client_turn_id) WHERE client_turn_id IS NOT NULL;

-- Revoke anon grants (defence in depth)
REVOKE ALL ON conversation_turns FROM anon;

-- ============================================================
-- RPC: insert_conversation_turn
-- ============================================================
-- Validates scenario ownership before inserting. Uses ON CONFLICT DO NOTHING
-- for idempotent writes when client_turn_id is provided.

CREATE OR REPLACE FUNCTION insert_conversation_turn(
  p_scenario_id          uuid,
  p_role                 text,
  p_content              text DEFAULT NULL,
  p_structured_blocks    jsonb DEFAULT NULL,
  p_snapshot_id          uuid DEFAULT NULL,
  p_analysis_snapshot_id uuid DEFAULT NULL,
  p_client_turn_id       text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_id uuid;
BEGIN
  -- Ownership check: caller must own the scenario
  IF NOT EXISTS (
    SELECT 1 FROM scenarios WHERE id = p_scenario_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'forbidden: scenario not owned by caller';
  END IF;

  INSERT INTO conversation_turns
    (scenario_id, user_id, role, content, structured_blocks, snapshot_id, analysis_snapshot_id, client_turn_id)
  VALUES
    (p_scenario_id, auth.uid(), p_role, p_content, p_structured_blocks, p_snapshot_id, p_analysis_snapshot_id, p_client_turn_id)
  ON CONFLICT (scenario_id, client_turn_id) WHERE client_turn_id IS NOT NULL
  DO NOTHING
  RETURNING id INTO v_id;

  -- v_id is NULL if ON CONFLICT skipped the insert (idempotent)
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION insert_conversation_turn FROM PUBLIC;
GRANT EXECUTE ON FUNCTION insert_conversation_turn TO authenticated;
