-- ============================================================
-- Olumi Scenario Schema v2.0 â Complete Migration
-- Target: Staging Supabase
-- Date: 26 February 2026
-- ============================================================

-- 1. Scenarios table
CREATE TABLE IF NOT EXISTS scenarios (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   UUID NOT NULL REFERENCES auth.users(id),
  title                     TEXT,
  scenario_schema_version   INTEGER NOT NULL DEFAULT 1,
  stage                     TEXT NOT NULL DEFAULT 'frame'
                            CHECK (stage IN ('frame', 'ideate', 'evaluate', 'decide', 'optimise')),
  graph                     JSONB,
  framing                   JSONB,
  analysis_status           TEXT NOT NULL DEFAULT 'none'
                            CHECK (analysis_status IN ('none', 'running', 'ready', 'failed')),
  analysis                  JSONB,
  analysis_error            JSONB,
  analysis_provenance       JSONB,
  events                    JSONB NOT NULL DEFAULT '[]'::jsonb,
  event_seq                 INTEGER NOT NULL DEFAULT 0,
  brief                     JSONB,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scenarios_user_id ON scenarios(user_id);
CREATE INDEX IF NOT EXISTS idx_scenarios_updated_at ON scenarios(updated_at DESC);

ALTER TABLE scenarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own scenarios"
  ON scenarios FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own scenarios"
  ON scenarios FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own scenarios"
  ON scenarios FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own scenarios"
  ON scenarios FOR DELETE USING (auth.uid() = user_id);

-- 2. Shared briefs table
CREATE TABLE IF NOT EXISTS shared_briefs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id     UUID NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id),
  brief           JSONB NOT NULL,
  graph_hash      TEXT NOT NULL,
  seed_used       INTEGER NOT NULL,
  response_hash   TEXT NOT NULL,
  slug            TEXT UNIQUE NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at      TIMESTAMPTZ
);

ALTER TABLE shared_briefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own shared briefs"
  ON shared_briefs FOR SELECT
  USING (auth.uid() = user_id);

-- 3. Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER scenarios_updated_at
  BEFORE UPDATE ON scenarios
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 4. RPCs (all SECURITY DEFINER with locked search_path)
-- ============================================================

-- 4a. Core event append with idempotency
CREATE OR REPLACE FUNCTION append_scenario_event(
  p_scenario_id UUID,
  p_event_id    TEXT,
  p_event_type  TEXT,
  p_details     JSONB DEFAULT '{}'::jsonb,
  p_hashes      JSONB DEFAULT NULL,
  p_turn_id     TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_scenario   scenarios%ROWTYPE;
  v_new_seq    INTEGER;
  v_event      JSONB;
BEGIN
  SELECT * INTO v_scenario
  FROM scenarios
  WHERE id = p_scenario_id AND user_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Scenario not found or not owned by user';
  END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_scenario.events) AS e
    WHERE e->>'event_id' = p_event_id
  ) THEN
    RETURN (
      SELECT e FROM jsonb_array_elements(v_scenario.events) AS e
      WHERE e->>'event_id' = p_event_id
    );
  END IF;

  v_new_seq := v_scenario.event_seq + 1;

  v_event := jsonb_build_object(
    'event_id',   p_event_id,
    'event_type', p_event_type,
    'seq',        v_new_seq,
    'timestamp',  to_jsonb(now()),
    'details',    p_details
  );

  IF p_turn_id IS NOT NULL THEN
    v_event := v_event || jsonb_build_object('turn_id', p_turn_id);
  END IF;
  IF p_hashes IS NOT NULL THEN
    v_event := v_event || jsonb_build_object('hashes', p_hashes);
  END IF;

  UPDATE scenarios
  SET events    = events || jsonb_build_array(v_event),
      event_seq = v_new_seq,
      updated_at = now()
  WHERE id = p_scenario_id;

  RETURN v_event;
END;
$$;

-- 4b. Atomic graph update + event
CREATE OR REPLACE FUNCTION apply_patch_and_log(
  p_scenario_id UUID,
  p_graph       JSONB,
  p_event_id    TEXT,
  p_event_type  TEXT,
  p_details     JSONB DEFAULT '{}'::jsonb,
  p_hashes      JSONB DEFAULT NULL,
  p_turn_id     TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_event JSONB;
BEGIN
  IF p_graph IS NOT NULL THEN
    UPDATE scenarios
    SET graph = p_graph
    WHERE id = p_scenario_id AND user_id = auth.uid();

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Scenario not found or not owned by user';
    END IF;
  END IF;

  v_event := append_scenario_event(
    p_scenario_id, p_event_id, p_event_type, p_details, p_hashes, p_turn_id
  );

  RETURN v_event;
END;
$$;

-- 4c. Atomic analysis storage + event (provenance built server-side)
CREATE OR REPLACE FUNCTION store_analysis_and_log(
  p_scenario_id   UUID,
  p_analysis      JSONB,
  p_graph_hash    TEXT,
  p_seed_used     INTEGER,
  p_response_hash TEXT,
  p_event_id      TEXT,
  p_details       JSONB DEFAULT '{}'::jsonb,
  p_turn_id       TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_event      JSONB;
  v_hashes     JSONB;
  v_provenance JSONB;
BEGIN
  v_provenance := jsonb_build_object(
    'graph_hash',    p_graph_hash,
    'seed_used',     p_seed_used,
    'response_hash', p_response_hash,
    'analysed_at',   to_jsonb(now())
  );

  UPDATE scenarios
  SET analysis            = p_analysis,
      analysis_status     = 'ready',
      analysis_error      = NULL,
      analysis_provenance = v_provenance
  WHERE id = p_scenario_id AND user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Scenario not found or not owned by user';
  END IF;

  v_hashes := jsonb_build_object(
    'graph_hash',    p_graph_hash,
    'response_hash', p_response_hash
  );

  v_event := append_scenario_event(
    p_scenario_id, p_event_id, 'analysis_run', p_details, v_hashes, p_turn_id
  );

  RETURN v_event;
END;
$$;

-- 4d. Atomic analysis failure + event
CREATE OR REPLACE FUNCTION store_analysis_failure(
  p_scenario_id  UUID,
  p_error        JSONB,
  p_event_id     TEXT,
  p_turn_id      TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_event   JSONB;
  v_details JSONB;
BEGIN
  UPDATE scenarios
  SET analysis_status = 'failed',
      analysis_error  = p_error || jsonb_build_object('at', to_jsonb(now()))
  WHERE id = p_scenario_id AND user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Scenario not found or not owned by user';
  END IF;

  v_details := jsonb_build_object(
    'error_code', p_error->>'code',
    'message',    p_error->>'message'
  );

  v_event := append_scenario_event(
    p_scenario_id, p_event_id, 'analysis_failed', v_details, NULL, p_turn_id
  );

  RETURN v_event;
END;
$$;

-- 4e. Atomic brief storage + event
CREATE OR REPLACE FUNCTION store_brief_and_log(
  p_scenario_id UUID,
  p_brief       JSONB,
  p_event_id    TEXT,
  p_turn_id     TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_event JSONB;
BEGIN
  UPDATE scenarios
  SET brief = p_brief
  WHERE id = p_scenario_id AND user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Scenario not found or not owned by user';
  END IF;

  v_event := append_scenario_event(
    p_scenario_id, p_event_id, 'brief_generated',
    jsonb_build_object('brief_id', p_brief->>'id'), NULL, p_turn_id
  );

  RETURN v_event;
END;
$$;

-- 4f. Atomic stage transition + event
CREATE OR REPLACE FUNCTION set_stage_and_log(
  p_scenario_id UUID,
  p_new_stage   TEXT,
  p_event_id    TEXT,
  p_turn_id     TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_old_stage TEXT;
  v_event     JSONB;
  v_details   JSONB;
BEGIN
  SELECT stage INTO v_old_stage
  FROM scenarios
  WHERE id = p_scenario_id AND user_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Scenario not found or not owned by user';
  END IF;

  IF p_new_stage NOT IN ('frame', 'ideate', 'evaluate', 'decide', 'optimise') THEN
    RAISE EXCEPTION 'Invalid stage: %', p_new_stage;
  END IF;

  IF v_old_stage = p_new_stage THEN
    RETURN jsonb_build_object('no_op', true, 'stage', v_old_stage);
  END IF;

  UPDATE scenarios
  SET stage = p_new_stage
  WHERE id = p_scenario_id;

  v_details := jsonb_build_object(
    'from', v_old_stage,
    'to',   p_new_stage
  );

  v_event := append_scenario_event(
    p_scenario_id, p_event_id, 'stage_changed', v_details, NULL, p_turn_id
  );

  RETURN v_event;
END;
$$;

-- 4g. Create shared brief with ownership verification (slug generated server-side)
CREATE OR REPLACE FUNCTION create_shared_brief(
  p_scenario_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_scenario   scenarios%ROWTYPE;
  v_shared_id  UUID;
  v_slug       TEXT;
BEGIN
  SELECT * INTO v_scenario
  FROM scenarios
  WHERE id = p_scenario_id AND user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Scenario not found or not owned by user';
  END IF;

  IF v_scenario.brief IS NULL THEN
    RAISE EXCEPTION 'No brief to share â generate a brief first';
  END IF;

  IF v_scenario.analysis_provenance IS NULL THEN
    RAISE EXCEPTION 'No analysis provenance â run analysis first';
  END IF;

  v_slug := encode(gen_random_bytes(16), 'hex');

  INSERT INTO shared_briefs (
    scenario_id, user_id, brief,
    graph_hash, seed_used, response_hash,
    slug
  ) VALUES (
    p_scenario_id,
    auth.uid(),
    v_scenario.brief,
    v_scenario.analysis_provenance->>'graph_hash',
    (v_scenario.analysis_provenance->>'seed_used')::integer,
    v_scenario.analysis_provenance->>'response_hash',
    v_slug
  )
  RETURNING id INTO v_shared_id;

  RETURN jsonb_build_object(
    'id',   v_shared_id,
    'slug', v_slug
  );
END;
$$;

-- 4h. Public access to shared brief by slug
CREATE OR REPLACE FUNCTION get_shared_brief_by_slug(p_slug TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'brief',         sb.brief,
    'graph_hash',    sb.graph_hash,
    'seed_used',     sb.seed_used,
    'response_hash', sb.response_hash,
    'created_at',    sb.created_at,
    'expires_at',    sb.expires_at
  ) INTO v_result
  FROM shared_briefs sb
  WHERE sb.slug = p_slug
    AND (sb.expires_at IS NULL OR sb.expires_at > now());

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN v_result;
END;
$$;

-- ============================================================
-- 5. Execution grants
-- ============================================================

-- Public-access RPC: executable by anon + authenticated only (for /brief/:slug route)
REVOKE EXECUTE ON FUNCTION get_shared_brief_by_slug(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_shared_brief_by_slug(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION get_shared_brief_by_slug(TEXT) TO authenticated;

-- All mutating RPCs: authenticated only
GRANT EXECUTE ON FUNCTION append_scenario_event(UUID, TEXT, TEXT, JSONB, JSONB, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION apply_patch_and_log(UUID, JSONB, TEXT, TEXT, JSONB, JSONB, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION store_analysis_and_log(UUID, JSONB, TEXT, INTEGER, TEXT, TEXT, JSONB, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION store_analysis_failure(UUID, JSONB, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION store_brief_and_log(UUID, JSONB, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION set_stage_and_log(UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION create_shared_brief(UUID) TO authenticated;

-- Revoke PUBLIC default (prevents anon access via PUBLIC inheritance)
REVOKE EXECUTE ON FUNCTION append_scenario_event(UUID, TEXT, TEXT, JSONB, JSONB, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION apply_patch_and_log(UUID, JSONB, TEXT, TEXT, JSONB, JSONB, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION store_analysis_and_log(UUID, JSONB, TEXT, INTEGER, TEXT, TEXT, JSONB, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION store_analysis_failure(UUID, JSONB, TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION store_brief_and_log(UUID, JSONB, TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION set_stage_and_log(UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION create_shared_brief(UUID) FROM PUBLIC;

-- Explicitly revoke anon from all mutating RPCs (belt-and-suspenders)
REVOKE EXECUTE ON FUNCTION append_scenario_event(UUID, TEXT, TEXT, JSONB, JSONB, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION apply_patch_and_log(UUID, JSONB, TEXT, TEXT, JSONB, JSONB, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION store_analysis_and_log(UUID, JSONB, TEXT, INTEGER, TEXT, TEXT, JSONB, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION store_analysis_failure(UUID, JSONB, TEXT, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION store_brief_and_log(UUID, JSONB, TEXT, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION set_stage_and_log(UUID, TEXT, TEXT, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION create_shared_brief(UUID) FROM anon;
