-- duplicate_scenario: the copy keeps its source's brief and the name the user sees (SD-1, J11a/J11b; DL 0df0e1 6 Oct).
--
-- WHAT THE USER SAW (J1 J11, 5 Oct). "Duplicate" on a decision listed as "monthly recurring revenue" made a card called
-- "Untitled decision (copy)", which opened without the brief it was built from (no brief, so CEE's "what you gave me"
-- read `unavailable`). Two defects in this function:
--   · the name: `COALESCE(title, 'Untitled decision') || ' (copy)'`. Most rows have no title; the UI names them from
--     the model (`scenarioDisplayTitle`: framing title, then the goal, then the question), so the copy got a name the
--     user never saw on the source.
--   · the brief: `brief_text` (CEE migration 20260502120000) was never copied.
--
-- THE FIX.
--   · `p_title` (optional): the caller sends the name it shows for the source, plus " (copy)". The UI's
--     `scenarioDisplayTitle` stays the ONE naming rule; SQL does not re-derive a name from the graph. Absent or blank,
--     the old rule stands, byte for byte, so every existing caller (staging and production UI, which send only
--     `p_scenario_id`) gets exactly what it got before.
--   · `brief_text` is copied with `graph` and `framing`. Nothing else changes: stage 'frame', and every Run, version,
--     summary and conversation column takes its never-run default, as before. The copy has no Run of its own.
--   · `SET search_path = ''` (the house pattern, `copy_guest_scenario`), so every name is schema-qualified.
--
-- ⚠ SIGNATURE. Adding a parameter makes a NEW function in Postgres, and two overloads would make the one-argument call
-- ambiguous. So the one-argument form is DROPPED and the two-argument form CREATED in this one migration (one
-- transaction). PostgREST resolves `rpc('duplicate_scenario', { p_scenario_id })` to it by name, with the default.
-- Still ONE writer of `scenarios.graph` under this name: the writer count does not grow.
--
-- PRE-CHECK (DL, before applying to the shared project; it is production's database too):
--   SELECT pg_get_functiondef(p.oid), p.proacl FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--    WHERE n.nspname = 'public' AND p.proname = 'duplicate_scenario';
--   Expect exactly one row, args `p_scenario_id uuid`, body = 20260306000000_auth_hub_profiles.sql §1.4. Anything else:
--   stop, the rollback below would not restore it.
-- ROLLBACK: rollback/20261006020000_duplicate_scenario_keeps_brief_and_name_rollback.sql.do-not-apply

DROP FUNCTION IF EXISTS public.duplicate_scenario(uuid);

CREATE FUNCTION public.duplicate_scenario(p_scenario_id uuid, p_title text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_new_id uuid;
  v_title  text := NULLIF(pg_catalog.btrim(p_title), '');
BEGIN
  INSERT INTO public.scenarios (
    user_id, title, scenario_schema_version, stage,
    graph, framing, brief_text, source_scenario_id
  )
  SELECT
    auth.uid(),
    COALESCE(v_title, COALESCE(s.title, 'Untitled decision') || ' (copy)'),
    s.scenario_schema_version,
    'frame',
    s.graph,
    s.framing,
    s.brief_text,
    p_scenario_id
  FROM public.scenarios s
  WHERE s.id = p_scenario_id AND s.user_id = auth.uid()
  RETURNING id INTO v_new_id;

  IF v_new_id IS NULL THEN
    RAISE EXCEPTION 'Scenario not found or not owned by user';
  END IF;

  RETURN v_new_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.duplicate_scenario(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.duplicate_scenario(uuid, text) TO authenticated, service_role;
