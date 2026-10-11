-- SOURCE PROPOSAL ONLY: DL reviews/applies; never applied by this lane.
-- Checked atomic guest copy; same transaction, same replay key and owner.
-- Legacy callers with both trailing NULLs are unchecked by design. The CEE
-- controlled door ALWAYS supplies both. CG412 = checked source graph/revision/
-- guest status changed (or incomplete binding); CEE maps it to existing 409.
-- Prerequisite: public.scenarios.revision and its existing revision trigger.
-- No table, trigger, RLS or data changes. Legacy API/defaults/refusals preserved.
-- DROP+CREATE in one transaction avoids an ambiguous PostgREST overload.
-- DEPLOY: DB migration FIRST, then CEE; rollback CEE first, then DB.
-- PRE-CHECK (DL runs live; this lane cannot):
-- SELECT pg_catalog.pg_get_functiondef(p.oid), p.proacl,
--        pg_catalog.pg_get_function_arguments(p.oid)
-- FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
-- WHERE n.nspname='public' AND p.proname='copy_guest_scenario';
-- Expected exactly ONE row: p_source_scenario_id uuid, p_user_id uuid;
-- body = 20261001222932_copy_guest_scenario_20261001.sql. Otherwise STOP.

BEGIN;
DROP FUNCTION public.copy_guest_scenario(uuid, uuid);

CREATE FUNCTION public.copy_guest_scenario(
  p_source_scenario_id uuid, p_user_id uuid,
  p_checked_source_graph jsonb DEFAULT NULL, p_checked_source_revision bigint DEFAULT NULL
)
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
  v_revision   bigint;
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
  SELECT s.user_id, s.title, s.graph, s.revision
    INTO v_owner, v_title, v_graph, v_revision
    FROM public.scenarios s
    WHERE s.id = p_source_scenario_id
    FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'copy_guest_scenario: source not found' USING ERRCODE = 'CG404';
  END IF;
  -- CHECKED_SOURCE_BINDING: replay has already returned; this locked state is
  -- the only state an INSERT below can copy. A partial binding is never legacy.
  IF p_checked_source_graph IS NOT NULL OR p_checked_source_revision IS NOT NULL THEN
    IF p_checked_source_graph IS NULL OR p_checked_source_revision IS NULL
       OR v_graph IS DISTINCT FROM p_checked_source_graph
       OR v_revision IS DISTINCT FROM p_checked_source_revision
       OR v_owner IS NOT NULL THEN
      RAISE EXCEPTION 'copy_guest_scenario: checked source changed' USING ERRCODE = 'CG412';
    END IF;
  END IF;
  -- END_CHECKED_SOURCE_BINDING
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

REVOKE ALL ON FUNCTION public.copy_guest_scenario(uuid, uuid, jsonb, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.copy_guest_scenario(uuid, uuid, jsonb, bigint) TO service_role;

COMMIT;
