-- SOURCE PROPOSAL ONLY: DL reviews/applies; never applied by this lane.
-- ADDITIVE: public.copy_guest_scenario(uuid,uuid) is NEVER dropped or altered.
-- Legacy two-argument callers remain unchecked by design; CEE NEVER calls them.
-- Checked args are ALL required, no defaults; any SQL NULL -> 22023 before reads.
-- CG412 = locked graph/revision/guest status differs; CEE uses existing 409.
-- Equal JSON VALUE; stored representation of an equal value is copied.
-- Identity hashes are value-based; JS cannot emit 1.0, so text equality is wrong.
-- Replay is recovery of the original destination identity (created:false), NOT
-- attestation of the newly checked source. Same legacy advisory key/replay row.
-- Prerequisite: public.scenarios.revision and its existing revision trigger.
-- DEPLOY: DB FIRST (additive: nothing existing changes), then CEE.
-- ROLLBACK: CEE FIRST, then drop ONLY the new checked function.
-- PRE-CHECK / POST-CHECK (DL runs live; this lane cannot):
-- SELECT p.oid, pg_catalog.pg_get_function_arguments(p.oid), p.proacl,
--        pg_catalog.md5(p.prosrc), pg_catalog.pg_get_functiondef(p.oid)
-- FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
-- WHERE n.nspname='public' AND p.proname IN
--   ('copy_guest_scenario','copy_guest_scenario_checked');
-- Legacy: exactly ONE uuid,uuid row; body md5 BEFORE/AFTER =
-- 135dd0df039e3ad513eb289eff06bd50 (baseline 20261001222932), same OID/ACL.
-- Checked: zero rows BEFORE; one uuid,uuid,jsonb,bigint row AFTER, no defaults,
-- SECURITY DEFINER, empty search_path, EXECUTE only owner + service_role.

BEGIN;
CREATE FUNCTION public.copy_guest_scenario_checked(
  p_source_scenario_id uuid, p_user_id uuid,
  p_checked_source_graph jsonb, p_checked_source_revision bigint
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
  -- REQUIRED_CHECKED_ARGUMENTS: reject every NULL before reads or replay.
  IF p_source_scenario_id IS NULL OR p_user_id IS NULL
     OR p_checked_source_graph IS NULL OR p_checked_source_revision IS NULL THEN
    RAISE EXCEPTION 'copy_guest_scenario_checked: all arguments are required' USING ERRCODE = '22023';
  END IF;
  -- END_REQUIRED_CHECKED_ARGUMENTS
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
  -- CHECKED_SOURCE_BINDING: replay has already returned; compare locked values.
  IF v_graph IS DISTINCT FROM p_checked_source_graph
     OR v_revision IS DISTINCT FROM p_checked_source_revision
     OR v_owner IS NOT NULL THEN
    RAISE EXCEPTION 'copy_guest_scenario: checked source changed' USING ERRCODE = 'CG412';
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

REVOKE ALL ON FUNCTION public.copy_guest_scenario_checked(uuid, uuid, jsonb, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.copy_guest_scenario_checked(uuid, uuid, jsonb, bigint) TO service_role;

COMMIT;
