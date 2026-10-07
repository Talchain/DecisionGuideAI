-- copy_guest_scenario v2: the copy carries the guest's brief, name and conversation (S-G slice 2; DL 0fd71f ruling (a),
-- 7 Oct 2026, which reverses DL condition 1 of 1 Oct for these columns only).
--
-- WHAT THE USER SAW. Signing in copied a guest decision into the account as its model and title only: the copy opened
-- with an empty chat and no brief, so everything the user had said and been told was gone at the moment they committed
-- by signing in (Paul's prod test, 7 Oct; S-G design `output/dl-0df0e1/inflight/S-G-guest-continuity-design-20261007.md`).
--
-- WHAT v2 COPIES, in ONE transaction with the new row (so no reader can see the copy without its conversation):
--   · scenarios: `graph`, `title` (as v1), plus `brief_text` and `framing` (as `duplicate_scenario` does since 6 Oct).
--   · v5_conversation_turns: every guest turn except claim markers (`turn_id LIKE '%:claim'`), RE-KEYED to the copy:
--       new `id`; `scenario_id` = the copy; `user_id` = the caller (as `claim_guest_scenario` set it, and as the RLS
--       policy `auth.uid() = user_id` needs). Kept as written: `turn_id`, `turn_class`, `handler_id`, `request_hash`
--       (CEE's chat read keeps only `agent_turn:` hashes), `response_emitted`, `llm_calls_used`, `duration_ms`,
--       `created_at` (so the UI can tell copied turns from new ones: they precede the copy's own `created_at`),
--       `user_message`, `assistant_message`, `coaching_state` and `agent_guidance` (enum signals and cooldown digests,
--       no figures).
--     Reset, because each names the GUEST scenario or its Run:
--       `pending_actions` → '[]'. Every held item carries its own `scenario_id`; CEE's strict readers would refuse the
--         copy (graph read 503, commits and Run blocked: `supabase-store.ts` `pending_actions_corrupt`). Held
--         proposals from the guest session are not carried; they were tied to the guest's graph hash or had expired.
--       `suggested_actions`, `suggested_actions_run_key` → NULL. The key hashes the guest's Run; CEE restores none on
--         another scenario.
--       `model_version_mutation_id`, `model_version_created` → NULL (together, per `v5_turn_model_version_marker_ck`).
--   · NOT copied, unchanged from v1: the Run (analysis columns, `v5_handler_facts`), model versions, the turn fence,
--     `rolling_summary`, `graph_identity_hash` (CEE stamps it on its first write). The copy has no Run, and the UI says
--     "Run again to see results here" and puts the copied turns under "From before you signed in".
--
-- UNCHANGED FROM v1: the signature, SECURITY DEFINER with `search_path = ''`, service_role-only EXECUTE, the refusals
-- (22023 / CG404 / CG409 / CG422 / CG413), the 1 MiB graph cap, and idempotency per (source, user) under the advisory
-- lock. A replay returns the existing copy and copies NOTHING again.
--
-- PRE-CHECK (DL, before applying; the shared project is production's database too):
--   SELECT pg_get_functiondef(p.oid), p.proacl FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--    WHERE n.nspname = 'public' AND p.proname = 'copy_guest_scenario';
--   Expect exactly one row, args `p_source_scenario_id uuid, p_user_id uuid`, body = 20261001222932_copy_guest_scenario
--   _20261001.sql, EXECUTE = {postgres, service_role}. Anything else: stop, the rollback would not restore it.
--   SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'v5_conversation_turns'
--    ORDER BY ordinal_position;
--   Expect the 20 columns named above (and below). A column not named here is NOT copied (it takes its default); add it
--   to this file first if it must travel.
-- ROLLBACK: rollback/20261007120145_copy_guest_scenario_v2_carries_the_conversation_rollback.sql.do-not-apply
-- DDL: this function only. No table, column, index or RLS change.

CREATE OR REPLACE FUNCTION public.copy_guest_scenario(p_source_scenario_id uuid, p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_existing   uuid;
  v_owner      uuid;
  v_title      text;
  v_graph      jsonb;
  v_framing    jsonb;
  v_brief_text text;
  v_new        uuid;
BEGIN
  IF p_source_scenario_id IS NULL THEN
    RAISE EXCEPTION 'copy_guest_scenario: p_source_scenario_id is required' USING ERRCODE = '22023';
  END IF;
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'copy_guest_scenario: p_user_id is required' USING ERRCODE = '22023';
  END IF;
  -- scenarios.user_id has no FK to auth.users (guest relaxation), so this is the
  -- only thing stopping a copy owned by an id that can never sign in.
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'copy_guest_scenario: p_user_id is not a known auth user' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('copy_guest_scenario:' || p_source_scenario_id::text || ':' || p_user_id::text, 0)
  );

  SELECT s.id INTO v_existing
    FROM public.scenarios s
    WHERE s.source_scenario_id = p_source_scenario_id AND s.user_id = p_user_id
    ORDER BY s.created_at, s.id
    LIMIT 1;
  IF FOUND THEN
    RETURN pg_catalog.jsonb_build_object('scenario_id', v_existing, 'created', false);
  END IF;

  -- FOR SHARE: the graph and the turns copied are one committed state of the source, never a write in flight.
  SELECT s.user_id, s.title, s.graph, s.framing, s.brief_text
    INTO v_owner, v_title, v_graph, v_framing, v_brief_text
    FROM public.scenarios s
    WHERE s.id = p_source_scenario_id
    FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'copy_guest_scenario: source not found' USING ERRCODE = 'CG404';
  END IF;
  IF v_owner IS NOT NULL THEN
    RAISE EXCEPTION 'copy_guest_scenario: source is not a guest scenario' USING ERRCODE = 'CG409';
  END IF;
  IF v_graph IS NULL OR pg_catalog.jsonb_typeof(v_graph) <> 'object' THEN
    RAISE EXCEPTION 'copy_guest_scenario: source has no model to copy' USING ERRCODE = 'CG422';
  END IF;
  IF pg_catalog.octet_length(v_graph::text) > 1048576 THEN
    RAISE EXCEPTION 'copy_guest_scenario: source model is too large to copy' USING ERRCODE = 'CG413';
  END IF;

  INSERT INTO public.scenarios (user_id, title, graph, framing, brief_text, source_scenario_id)
  VALUES (p_user_id, v_title, v_graph, v_framing, v_brief_text, p_source_scenario_id)
  RETURNING id INTO v_new;

  -- The conversation, re-keyed to the copy (see the header for every column).
  INSERT INTO public.v5_conversation_turns (
    scenario_id, user_id, turn_id, turn_class, handler_id, request_hash, response_emitted, llm_calls_used, duration_ms,
    created_at, user_message, assistant_message, coaching_state, agent_guidance,
    pending_actions, suggested_actions, suggested_actions_run_key, model_version_mutation_id, model_version_created
  )
  SELECT
    v_new, p_user_id, t.turn_id, t.turn_class, t.handler_id, t.request_hash, t.response_emitted, t.llm_calls_used,
    t.duration_ms, t.created_at, t.user_message, t.assistant_message, t.coaching_state, t.agent_guidance,
    '[]'::jsonb, NULL, NULL, NULL, NULL
  FROM public.v5_conversation_turns t
  WHERE t.scenario_id = p_source_scenario_id
    AND t.turn_id NOT LIKE '%:claim'
  ORDER BY t.created_at, t.turn_id;

  RETURN pg_catalog.jsonb_build_object('scenario_id', v_new, 'created', true);
END;
$function$;

REVOKE ALL ON FUNCTION public.copy_guest_scenario(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.copy_guest_scenario(uuid, uuid) TO service_role;
