-- BIL Phase 1: scenario_snapshots — immutable truth store
-- Captures graph + analysis state at a point in time. Linked to conversation
-- turns so each assistant response references the exact state it was based on.
--
-- Immutable by design: no UPDATE policy. Cascade from scenarios handles cleanup.
-- All changes are idempotent (safe to run multiple times).

-- ============================================================
-- Table: scenario_snapshots
-- ============================================================

CREATE TABLE IF NOT EXISTS scenario_snapshots (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id      uuid NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  user_id          uuid NOT NULL REFERENCES auth.users(id),
  graph            jsonb NOT NULL,
  analysis         jsonb,
  brief_text       text,
  brief_hash       text,
  seed             bigint,
  quality_mode     text,
  graph_hash       text,
  created_at       timestamptz NOT NULL DEFAULT now()
  -- No updated_at: snapshots are immutable by design
);

ALTER TABLE scenario_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenario_snapshots FORCE ROW LEVEL SECURITY;

-- RLS: users can only see and create their own snapshots
-- No UPDATE or DELETE policy — immutable; cascade from scenarios handles cleanup
CREATE POLICY "select_own_snapshots" ON scenario_snapshots
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_snapshots" ON scenario_snapshots
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Index: efficient lookup by scenario, most recent first
CREATE INDEX IF NOT EXISTS idx_snapshots_scenario
  ON scenario_snapshots(scenario_id, created_at DESC);

-- Revoke anon grants (defence in depth — RLS already prevents access)
REVOKE ALL ON scenario_snapshots FROM anon;

-- ============================================================
-- RPC: create_snapshot
-- ============================================================
-- Takes snapshot parameters and verifies scenario ownership before inserting.
-- Returns the snapshot UUID. SECURITY DEFINER so the function runs with
-- elevated privileges while RLS + explicit ownership check protect the data.

CREATE OR REPLACE FUNCTION create_snapshot(
  p_scenario_id   uuid,
  p_graph         jsonb,
  p_graph_hash    text,
  p_analysis      jsonb DEFAULT NULL,
  p_brief_text    text DEFAULT NULL,
  p_brief_hash    text DEFAULT NULL,
  p_seed          bigint DEFAULT NULL,
  p_quality_mode  text DEFAULT NULL
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

  INSERT INTO scenario_snapshots
    (scenario_id, user_id, graph, analysis, brief_text, brief_hash, seed, quality_mode, graph_hash)
  VALUES
    (p_scenario_id, auth.uid(), p_graph, p_analysis, p_brief_text, p_brief_hash, p_seed, p_quality_mode, p_graph_hash)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION create_snapshot FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_snapshot TO authenticated;
