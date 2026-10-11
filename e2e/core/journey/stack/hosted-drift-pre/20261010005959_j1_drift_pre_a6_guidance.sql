-- j1-requires-migration: 20261010010000
-- J1 hosted drift immediately before A6; local stack ONLY.
-- Last replayed guidance: CEE 20261004142707_agent_guidance_answer_history.sql:8
-- lacks the deployed Run-delivery fact gate. Last replayed if_latest:
-- CEE 20261007090000_agent_answer_conditional_append.sql:22 has extra body comments.
-- Exact deployed definitions/owner/ACL copied from CEE:
-- scripts/phase2/fixtures/a6-live-with_guidance.sql:4 and a6-live-if_latest.sql:4.
-- Only CREATE becomes CREATE OR REPLACE; every body byte is retained.
-- with_offers already matches the deployed body and is only asserted, not replaced.
-- MD5 = hashlib.md5(body.encode('utf-8')).hexdigest(); body is exactly between
-- its AS dollar-quote delimiters, including leading/trailing newlines.
-- Runner wraps this whole pre-shim in one transaction and fails closed on error.

DO $j1_guard$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    WHERE p.oid = to_regprocedure('public.append_agent_answer_with_guidance(uuid,text,text,text,text,boolean,integer,integer,jsonb,jsonb,text,jsonb,jsonb,text,text,jsonb)')
      AND md5(p.prosrc) = '9800e1937c6cf9aa028f1f0fe2dd7287' AND length(p.prosrc) = 3337
  ) THEN
    RAISE EXCEPTION 'J1 pre-A6 source guard: append_agent_answer_with_guidance body missing or changed';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    WHERE p.oid = to_regprocedure('public.append_agent_answer_if_latest(uuid,uuid,text,text,text,text,boolean,integer,integer,jsonb,jsonb,text,jsonb,jsonb,text,text,jsonb,jsonb,text)')
      AND md5(p.prosrc) = 'e994d7ada7edab2b933fc610976321bc' AND length(p.prosrc) = 2377
  ) THEN
    RAISE EXCEPTION 'J1 pre-A6 source guard: append_agent_answer_if_latest body missing or changed';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    WHERE p.oid = to_regprocedure('public.append_agent_answer_with_offers(uuid,text,text,text,text,boolean,integer,integer,jsonb,jsonb,text,jsonb,jsonb,text,text,jsonb,jsonb,text)')
      AND md5(p.prosrc) = 'ea9988e21459581bdf18097534a6e373' AND length(p.prosrc) = 3623
  ) THEN
    RAISE EXCEPTION 'J1 pre-A6 source guard: append_agent_answer_with_offers body missing or changed';
  END IF;
END;
$j1_guard$;

CREATE OR REPLACE FUNCTION public.append_agent_answer_with_guidance(p_scenario_id uuid, p_turn_id text, p_turn_class text, p_handler_id text, p_request_hash text, p_response_emitted boolean, p_llm_calls_used integer, p_duration_ms integer, p_handler_facts jsonb, p_graph jsonb, p_brief_text text, p_pending_actions jsonb, p_coaching_state jsonb, p_user_message text, p_assistant_message text, p_agent_guidance jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_id UUID;
  v_existing UUID;
  v_existing_hash TEXT;
  v_entry RECORD;
BEGIN
  -- This wrapper may only append a visible Agent answer. It cannot acquire a
  -- graph, handler, brief or pre-dispatch coaching write authority.
  IF p_turn_class IS DISTINCT FROM 'direct_answer' OR p_handler_id IS NOT NULL
    OR p_request_hash IS NULL OR p_request_hash NOT LIKE 'agent_turn:%'
    OR p_turn_id IS NULL OR p_turn_id LIKE '%:claim'
    OR p_response_emitted IS DISTINCT FROM TRUE OR p_graph IS NOT NULL
    OR p_brief_text IS NOT NULL OR p_coaching_state IS NOT NULL
    OR NOT (CASE
      -- 0.79 SD-1: '[]' as before, or the ONE fact a guidance answer may carry: the Run delivery it
      -- showed, in the store's serialised shape (handler_id = action_type = payload.fact_type).
      -- CASE fixes the evaluation order and maps every NULL to FALSE, so NULL and non-arrays still raise.
      WHEN p_handler_facts IS NULL THEN FALSE
      WHEN p_handler_facts = '[]'::jsonb THEN TRUE
      WHEN jsonb_typeof(p_handler_facts) <> 'array' THEN FALSE
      WHEN jsonb_array_length(p_handler_facts) <> 1 THEN FALSE
      WHEN jsonb_typeof(p_handler_facts->0) <> 'object' THEN FALSE
      ELSE COALESCE(
        (p_handler_facts->0->>'handler_id') = 'run_delivery'
        AND (p_handler_facts->0->>'action_type') = 'run_delivery'
        AND jsonb_typeof(p_handler_facts->0->'payload') = 'object'
        AND (p_handler_facts->0->'payload'->>'fact_type') = 'run_delivery', FALSE)
    END) THEN
    RAISE EXCEPTION 'guidance requires a final non-graph Agent answer';
  END IF;
  IF p_agent_guidance IS NULL OR jsonb_typeof(p_agent_guidance) <> 'object'
    OR p_agent_guidance->'version' IS DISTINCT FROM '1'::jsonb
    OR jsonb_typeof(p_agent_guidance->'entries') IS DISTINCT FROM 'object'
    OR (p_agent_guidance - 'version' - 'entries') <> '{}'::jsonb THEN
    RAISE EXCEPTION 'invalid guidance envelope';
  END IF;
  IF (SELECT count(*) FROM jsonb_object_keys(p_agent_guidance->'entries')) > 3 THEN
    RAISE EXCEPTION 'guidance event cap exceeded';
  END IF;
  FOR v_entry IN SELECT key, value FROM jsonb_each(p_agent_guidance->'entries') LOOP
    IF v_entry.key !~ '^(RC-WIDEN|RC-WHAT-CHANGES|RC-PREMORTEM|RC-COACH-EDITS|RC-STRENGTHEN-ITEM:[0-9a-f]{12})$'
      OR jsonb_typeof(v_entry.value) <> 'object'
      OR jsonb_typeof(v_entry.value->'status') IS DISTINCT FROM 'string'
      OR (v_entry.value->>'status') NOT IN ('offered', 'pressed', 'completed', 'dismissed')
      OR jsonb_typeof(v_entry.value->'state_key_hash') IS DISTINCT FROM 'string'
      OR (v_entry.value->>'state_key_hash') !~ '^[0-9a-f]{12}$'
      OR (v_entry.value - 'status' - 'state_key_hash') <> '{}'::jsonb THEN
      RAISE EXCEPTION 'invalid content-free guidance event';
    END IF;
  END LOOP;

  -- Same lock order as the existing appends. All v2 callers take FOR SHARE on
  -- this row; FOR UPDATE serialises insertion with this exact-id existence
  -- check. Thus a concurrent retry can never replace the first answer's events.
  PERFORM 1 FROM public.scenarios WHERE id = p_scenario_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'scenario % not found', p_scenario_id; END IF;
  SELECT id, request_hash INTO v_existing, v_existing_hash FROM public.v5_conversation_turns
    WHERE scenario_id = p_scenario_id AND turn_id = p_turn_id;

  v_id := public.append_turn_atomic_v2(
    p_scenario_id, p_turn_id, p_turn_class, p_handler_id, p_request_hash,
    p_response_emitted, p_llm_calls_used, p_duration_ms, p_handler_facts,
    p_graph, p_brief_text, p_pending_actions, p_coaching_state,
    p_user_message, p_assistant_message
  );
  IF v_existing IS NULL THEN
    UPDATE public.v5_conversation_turns SET agent_guidance = p_agent_guidance
      WHERE id = v_id AND scenario_id = p_scenario_id AND turn_id = p_turn_id
        AND request_hash = p_request_hash;
    IF NOT FOUND THEN RAISE EXCEPTION 'guidance answer row not found'; END IF;
  END IF;
  RETURN jsonb_build_object('id', v_id,
    'replayed_prior_turn', v_existing IS NOT NULL AND v_existing_hash IS NOT DISTINCT FROM p_request_hash,
    'prior_turn_conflict', v_existing IS NOT NULL AND v_existing_hash IS DISTINCT FROM p_request_hash);
END;
$function$;
ALTER FUNCTION public.append_agent_answer_with_guidance(uuid,text,text,text,text,boolean,integer,integer,jsonb,jsonb,text,jsonb,jsonb,text,text,jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.append_agent_answer_with_guidance(uuid,text,text,text,text,boolean,integer,integer,jsonb,jsonb,text,jsonb,jsonb,text,text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.append_agent_answer_with_guidance(uuid,text,text,text,text,boolean,integer,integer,jsonb,jsonb,text,jsonb,jsonb,text,text,jsonb) TO service_role;

CREATE OR REPLACE FUNCTION "public"."append_agent_answer_if_latest"("p_expected_latest_row_id" "uuid", "p_scenario_id" "uuid", "p_turn_id" "text", "p_turn_class" "text", "p_handler_id" "text", "p_request_hash" "text", "p_response_emitted" boolean, "p_llm_calls_used" integer, "p_duration_ms" integer, "p_handler_facts" "jsonb", "p_graph" "jsonb", "p_brief_text" "text", "p_pending_actions" "jsonb", "p_coaching_state" "jsonb", "p_user_message" "text", "p_assistant_message" "text", "p_agent_guidance" "jsonb", "p_suggested_actions" "jsonb", "p_suggested_actions_run_key" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
DECLARE
  v_latest UUID;
BEGIN
  IF p_turn_class IS DISTINCT FROM 'direct_answer' OR p_handler_id IS NOT NULL
    OR p_request_hash IS NULL OR p_request_hash NOT LIKE 'agent_turn:%'
    OR p_turn_id IS NULL OR p_turn_id LIKE '%:claim'
    OR p_response_emitted IS DISTINCT FROM TRUE OR p_graph IS NOT NULL
    OR p_brief_text IS NOT NULL OR p_coaching_state IS NOT NULL THEN
    RAISE EXCEPTION 'conditional append requires a final non-graph Agent answer';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_scenario_id::text, 0));
  SELECT id INTO v_latest FROM public.v5_conversation_turns
    WHERE scenario_id = p_scenario_id AND turn_id NOT LIKE '%:claim'
    ORDER BY created_at DESC LIMIT 1;
  IF v_latest IS DISTINCT FROM p_expected_latest_row_id THEN
    RETURN jsonb_build_object('status', 'latest_moved');
  END IF;

  IF p_suggested_actions IS NOT NULL THEN
    RETURN public.append_agent_answer_with_offers(
      p_scenario_id, p_turn_id, p_turn_class, p_handler_id, p_request_hash,
      p_response_emitted, p_llm_calls_used, p_duration_ms, p_handler_facts,
      p_graph, p_brief_text, p_pending_actions, p_coaching_state,
      p_user_message, p_assistant_message, p_agent_guidance,
      p_suggested_actions, p_suggested_actions_run_key
    );
  ELSIF p_agent_guidance IS NOT NULL THEN
    RETURN public.append_agent_answer_with_guidance(
      p_scenario_id, p_turn_id, p_turn_class, p_handler_id, p_request_hash,
      p_response_emitted, p_llm_calls_used, p_duration_ms, p_handler_facts,
      p_graph, p_brief_text, p_pending_actions, p_coaching_state,
      p_user_message, p_assistant_message, p_agent_guidance
    );
  ELSE
    RETURN to_jsonb(public.append_turn_atomic_v2(
      p_scenario_id, p_turn_id, p_turn_class, p_handler_id, p_request_hash,
      p_response_emitted, p_llm_calls_used, p_duration_ms, p_handler_facts,
      p_graph, p_brief_text, p_pending_actions, p_coaching_state,
      p_user_message, p_assistant_message
    ));
  END IF;
END;
$$;
ALTER FUNCTION public.append_agent_answer_if_latest(uuid,uuid,text,text,text,text,boolean,integer,integer,jsonb,jsonb,text,jsonb,jsonb,text,text,jsonb,jsonb,text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.append_agent_answer_if_latest(uuid,uuid,text,text,text,text,boolean,integer,integer,jsonb,jsonb,text,jsonb,jsonb,text,text,jsonb,jsonb,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.append_agent_answer_if_latest(uuid,uuid,text,text,text,text,boolean,integer,integer,jsonb,jsonb,text,jsonb,jsonb,text,text,jsonb,jsonb,text) TO service_role;

DO $j1_guard$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    WHERE p.oid = to_regprocedure('public.append_agent_answer_with_guidance(uuid,text,text,text,text,boolean,integer,integer,jsonb,jsonb,text,jsonb,jsonb,text,text,jsonb)')
      AND md5(p.prosrc) = '9bc227a08d12cc216c9365f668fb6709' AND length(p.prosrc) = 4204
  ) THEN
    RAISE EXCEPTION 'J1 pre-A6 deployed guard: append_agent_answer_with_guidance body missing or changed';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    WHERE p.oid = to_regprocedure('public.append_agent_answer_if_latest(uuid,uuid,text,text,text,text,boolean,integer,integer,jsonb,jsonb,text,jsonb,jsonb,text,text,jsonb,jsonb,text)')
      AND md5(p.prosrc) = '7d038f624e222134c7ac58c8db79281e' AND length(p.prosrc) = 1994
  ) THEN
    RAISE EXCEPTION 'J1 pre-A6 deployed guard: append_agent_answer_if_latest body missing or changed';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    WHERE p.oid = to_regprocedure('public.append_agent_answer_with_offers(uuid,text,text,text,text,boolean,integer,integer,jsonb,jsonb,text,jsonb,jsonb,text,text,jsonb,jsonb,text)')
      AND md5(p.prosrc) = 'ea9988e21459581bdf18097534a6e373' AND length(p.prosrc) = 3623
  ) THEN
    RAISE EXCEPTION 'J1 pre-A6 deployed guard: append_agent_answer_with_offers body missing or changed';
  END IF;
END;
$j1_guard$;

-- Mark the functions this shim prepared: schema-assert.sql checks production's post-migration body ONLY on these
-- (the comment survives the migration's CREATE OR REPLACE; an older pinned tuple never runs this shim).
COMMENT ON FUNCTION public.append_agent_answer_with_guidance(uuid,text,text,text,text,boolean,integer,integer,jsonb,jsonb,text,jsonb,jsonb,text,text,jsonb) IS 'j1:deployed-parity';
COMMENT ON FUNCTION public.append_agent_answer_with_offers(uuid,text,text,text,text,boolean,integer,integer,jsonb,jsonb,text,jsonb,jsonb,text,text,jsonb,jsonb,text) IS 'j1:deployed-parity';
COMMENT ON FUNCTION public.append_agent_answer_if_latest(uuid,uuid,text,text,text,text,boolean,integer,integer,jsonb,jsonb,text,jsonb,jsonb,text,text,jsonb,jsonb,text) IS 'j1:deployed-parity';
