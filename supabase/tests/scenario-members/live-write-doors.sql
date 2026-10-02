-- Live bodies of every Supabase write door a member could reach, verbatim from pg_get_functiondef (read 2 Oct 2026):
-- apply_patch_and_log, append_scenario_event, create_shared_snapshot, duplicate_scenario. Not edited.
CREATE OR REPLACE FUNCTION public.append_scenario_event(p_scenario_id uuid, p_event_id text, p_event_type text, p_details jsonb DEFAULT '{}'::jsonb, p_hashes jsonb DEFAULT NULL::jsonb, p_turn_id text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.apply_patch_and_log(p_scenario_id uuid, p_graph jsonb, p_event_id text, p_event_type text, p_details jsonb DEFAULT '{}'::jsonb, p_hashes jsonb DEFAULT NULL::jsonb, p_turn_id text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.create_shared_snapshot(p_scenario_id uuid, p_graph jsonb, p_analysis jsonb DEFAULT NULL::jsonb, p_brief_text text DEFAULT NULL::text, p_graph_hash text DEFAULT NULL::text, p_seed bigint DEFAULT NULL::bigint, p_expires_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
DECLARE
  v_id   UUID;
  v_slug TEXT;
BEGIN
  -- Value-level guards (typed errors before constraint noise).
  IF p_graph IS NULL OR jsonb_typeof(p_graph) <> 'object' THEN
    RAISE EXCEPTION 'create_shared_snapshot: p_graph must be a JSON object'
      USING ERRCODE = '22023';
  END IF;
  IF p_analysis IS NOT NULL AND jsonb_typeof(p_analysis) <> 'object' THEN
    RAISE EXCEPTION 'create_shared_snapshot: p_analysis must be a JSON object when supplied'
      USING ERRCODE = '22023';
  END IF;
  IF p_expires_at IS NOT NULL
     AND (NOT isfinite(p_expires_at) OR p_expires_at <= now()) THEN
    RAISE EXCEPTION 'create_shared_snapshot: p_expires_at must be a finite future timestamp'
      USING ERRCODE = '22023';
  END IF;
  -- Size caps (adversarial-review F1): the read side serves this payload to
  -- anon, so without a cap any authenticated account could use the product
  -- origin as an anonymous content host (storage + egress abuse). The caps
  -- are generous multiples of real snapshot sizes — per the ruling the
  -- content is the sharer's own, so we cap size, never content.
  IF pg_column_size(p_graph) > 2097152 THEN
    RAISE EXCEPTION 'create_shared_snapshot: p_graph exceeds the 2 MiB share limit'
      USING ERRCODE = '22023';
  END IF;
  IF p_analysis IS NOT NULL AND pg_column_size(p_analysis) > 2097152 THEN
    RAISE EXCEPTION 'create_shared_snapshot: p_analysis exceeds the 2 MiB share limit'
      USING ERRCODE = '22023';
  END IF;
  IF p_brief_text IS NOT NULL AND length(p_brief_text) > 100000 THEN
    RAISE EXCEPTION 'create_shared_snapshot: p_brief_text exceeds the 100,000-character share limit'
      USING ERRCODE = '22023';
  END IF;

  -- Ownership: caller must own the scenario. Same not-found/not-owned
  -- collapse as create_shared_brief (no existence oracle for scenario
  -- ids the caller does not own).
  IF NOT EXISTS (
    SELECT 1 FROM public.scenarios
    WHERE id = p_scenario_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'create_shared_snapshot: scenario not found or not owned by caller'
      USING ERRCODE = 'SS403';
  END IF;

  v_slug := encode(gen_random_bytes(16), 'hex');

  INSERT INTO public.shared_snapshots (
    scenario_id, user_id, graph, analysis, brief_text, graph_hash, seed,
    slug, expires_at
  ) VALUES (
    p_scenario_id, auth.uid(), p_graph, p_analysis, p_brief_text,
    p_graph_hash, p_seed, v_slug, p_expires_at
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'id',         v_id,
    'slug',       v_slug,
    'expires_at', to_jsonb(p_expires_at)
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.duplicate_scenario(p_scenario_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
AS $function$ DECLARE v_new_id UUID; BEGIN INSERT INTO scenarios (user_id, title, scenario_schema_version, stage, graph, framing, source_scenario_id) SELECT auth.uid(), COALESCE(title, 'Untitled decision') || ' (copy)', scenario_schema_version, 'frame', graph, framing, p_scenario_id FROM scenarios WHERE id = p_scenario_id AND user_id = auth.uid() RETURNING id INTO v_new_id; IF v_new_id IS NULL THEN RAISE EXCEPTION 'Scenario not found or not owned by user'; END IF; RETURN v_new_id; END; $function$
;