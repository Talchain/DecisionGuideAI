-- =============================================================================
-- Thread Persistence -- Track 2 of 3
--
-- Run in Supabase SQL Editor.
-- Requires: scenarios table from Scenario Schema v2 (20260226000000).
--
-- Adds:
-- 1. thread JSONB column on scenarios
-- 2. append_thread_entries RPC (idempotent, server-assigned seq/timestamp)
-- 3. update_thread_block_state RPC (in-place block state mutation)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Add thread column
-- ---------------------------------------------------------------------------

ALTER TABLE scenarios
  ADD COLUMN IF NOT EXISTS thread JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN scenarios.thread IS
  'Persisted conversation thread entries (Track 2). JSONB array of ThreadEntry objects.';

-- ---------------------------------------------------------------------------
-- 2. append_thread_entries — batch-append with idempotency
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION append_thread_entries(
  p_scenario_id UUID,
  p_entries     JSONB   -- Array of ThreadEntry objects (without seq/timestamp)
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_scenario    scenarios%ROWTYPE;
  v_entry       JSONB;
  v_entry_id    TEXT;
  v_new_seq     INTEGER;
  v_now         TIMESTAMPTZ := now();
  v_result      JSONB := '[]'::jsonb;
  v_existing    JSONB;
BEGIN
  -- Lock the row for atomic seq assignment
  SELECT * INTO v_scenario
  FROM scenarios
  WHERE id = p_scenario_id AND user_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Scenario not found or not owned by user';
  END IF;

  v_new_seq := v_scenario.event_seq;

  FOR v_entry IN SELECT * FROM jsonb_array_elements(p_entries) LOOP
    v_entry_id := v_entry->>'entry_id';

    -- Idempotency: if entry_id already exists, return the existing entry
    SELECT e INTO v_existing
    FROM jsonb_array_elements(v_scenario.thread) AS e
    WHERE e->>'entry_id' = v_entry_id;

    IF v_existing IS NOT NULL THEN
      v_result := v_result || jsonb_build_array(v_existing);
      CONTINUE;
    END IF;

    -- Assign server seq and timestamp
    v_new_seq := v_new_seq + 1;

    v_entry := v_entry || jsonb_build_object(
      'seq',       v_new_seq,
      'timestamp', to_jsonb(v_now)
    );

    -- Append to thread array in memory (for subsequent duplicate checks)
    v_scenario.thread := v_scenario.thread || jsonb_build_array(v_entry);
    v_result := v_result || jsonb_build_array(v_entry);
  END LOOP;

  -- Single UPDATE with all new entries
  UPDATE scenarios
  SET thread     = v_scenario.thread,
      event_seq  = v_new_seq,
      updated_at = v_now
  WHERE id = p_scenario_id;

  RETURN v_result;
END;
$$;

-- Grant to authenticated users only
REVOKE ALL ON FUNCTION append_thread_entries(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION append_thread_entries(UUID, JSONB) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. update_thread_block_state — in-place block state mutation
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION update_thread_block_state(
  p_scenario_id UUID,
  p_entry_id    TEXT,
  p_block_id    TEXT,
  p_new_state   TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_thread      JSONB;
  v_updated     JSONB := '[]'::jsonb;
  v_entry       JSONB;
  v_blocks      JSONB;
  v_new_blocks  JSONB;
  v_block       JSONB;
  v_found_entry BOOLEAN := FALSE;
  v_found_block BOOLEAN := FALSE;
BEGIN
  -- Lock the row
  SELECT thread INTO v_thread
  FROM scenarios
  WHERE id = p_scenario_id AND user_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Scenario not found or not owned by user';
  END IF;

  -- Walk thread entries, find matching entry_id, then matching block_id
  FOR v_entry IN SELECT * FROM jsonb_array_elements(v_thread) LOOP
    IF v_entry->>'entry_id' = p_entry_id THEN
      v_found_entry := TRUE;
      v_blocks := COALESCE(v_entry->'blocks', '[]'::jsonb);
      v_new_blocks := '[]'::jsonb;

      FOR v_block IN SELECT * FROM jsonb_array_elements(v_blocks) LOOP
        IF v_block->>'block_id' = p_block_id THEN
          v_found_block := TRUE;
          v_block := v_block || jsonb_build_object(
            'state', p_new_state,
            'state_changed_at', to_jsonb(now())
          );
        END IF;
        v_new_blocks := v_new_blocks || jsonb_build_array(v_block);
      END LOOP;

      v_entry := jsonb_set(v_entry, '{blocks}', v_new_blocks);
    END IF;
    v_updated := v_updated || jsonb_build_array(v_entry);
  END LOOP;

  IF NOT v_found_entry THEN
    RAISE EXCEPTION 'Thread entry % not found', p_entry_id;
  END IF;

  IF NOT v_found_block THEN
    RAISE EXCEPTION 'Block % not found in entry %', p_block_id, p_entry_id;
  END IF;

  UPDATE scenarios
  SET thread     = v_updated,
      updated_at = now()
  WHERE id = p_scenario_id;
END;
$$;

-- Grant to authenticated users only
REVOKE ALL ON FUNCTION update_thread_block_state(UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION update_thread_block_state(UUID, TEXT, TEXT, TEXT) TO authenticated;
