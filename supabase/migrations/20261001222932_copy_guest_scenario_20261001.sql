-- copy_guest_scenario: a signed-in user's OWN copy of a guest decision (graph only).
--
-- WHY A COPY AND NOT A CLAIM (DL 380e54, ACCOUNTS B3). A guest scenario's UUID is
-- a bearer capability: whoever holds it can read it as a guest (CEE
-- `proxy-v5-turn.ts`, `ownership-authority.ts`). Nothing proves that the person
-- signing in is the guest who built it, so ownership must never MOVE
-- (`claim_guest_scenario` would move it). A copy grants nothing the id did not
-- already grant: the guest row is never written, and the copy is a NEW row owned
-- by the caller.
--
-- WHAT IS COPIED (DL condition 1, #85 5942022182): `graph` and `title`, nothing
-- else. Every other column takes its never-run default: stage 'frame',
-- analysis_status 'none', every analysis/run pointer and summary NULL, events
-- '[]', graph_identity_hash NULL (CEE treats a NULL anchor as a legacy row and
-- stamps it on its first write). Turns and facts stay with the guest row. The
-- copy has no Run, and the UI says so ("Run again"), so no result is ever shown
-- that this row did not compute.
--
-- SIZE CAP (DL condition 3): a source graph over 1 MiB of JSON is refused
-- (CG413). The largest live graph is 209,028 bytes (p99 114,963; 18,210 rows,
-- read 1 Oct 2026), so the cap never refuses a real model.
--
-- IDEMPOTENT per (source, user) (DL condition 2): `source_scenario_id` records where the copy came
-- from, and a transaction-scoped advisory lock serialises two concurrent calls, so
-- a retry or a second tab returns the SAME copy. `duplicate_scenario` can never
-- create a row with a guest source (it requires the caller to own the source), so
-- the key is unambiguous.
--
-- DDL: one new function, nothing else. No table, column or RLS change.
--
-- Called ONLY by CEE (service_role) after it has verified the user's JWT; the user
-- id comes from the token's `sub`, never from the request body.

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

  -- FOR SHARE: the graph copied is one committed state of the source, never a
  -- write in flight.
  SELECT s.user_id, s.title, s.graph
    INTO v_owner, v_title, v_graph
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

  INSERT INTO public.scenarios (user_id, title, graph, source_scenario_id)
  VALUES (p_user_id, v_title, v_graph, p_source_scenario_id)
  RETURNING id INTO v_new;

  RETURN pg_catalog.jsonb_build_object('scenario_id', v_new, 'created', true);
END;
$function$;

REVOKE ALL ON FUNCTION public.copy_guest_scenario(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.copy_guest_scenario(uuid, uuid) TO service_role;
