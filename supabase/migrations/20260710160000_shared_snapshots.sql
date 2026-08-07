-- ============================================================
-- Collaboration v0 — `shared_snapshots`: read-only snapshot share links
-- (ROADMAP 3.3 v0, design: parallel-briefs/COLLAB-V0-DESIGN-2026-07-10.md,
--  orchestrator rulings 2026-07-10: DGAI home · share the LATEST analysis
--  ("what's on screen") · verbatim graph, conditions: content-only payload
--  + unguessable & revocable token.)
--
-- ⚠️  AUTHORED AS CODE — NOT YET EXECUTED. Authored by the Platform
--     workstream (A3); reviewed by the orchestrator; merged by the
--     Experience workstream (A2 — repo owner); EXECUTION is Paul-gated.
--     Update this header with the execution date + evidence pointer when
--     applied.
--
-- Target: Staging Supabase
-- Date authored: 2026-07-10
-- Date executed: (pending)
--
-- What this creates (all additive; NO existing table is touched):
--   1. `shared_snapshots` — an immutable, self-contained copy of a
--      scenario's canvas state (graph + latest analysis + brief text)
--      taken AT SHARE TIME, addressed by an unguessable server-minted
--      slug. A later edit to the scenario never mutates what was shared.
--   2. `create_shared_snapshot(...)` RPC — owner-only share creation.
--      CLIENT-supplied payload (the create_snapshot precedent): the UI
--      passes exactly what is on screen, so the viewer renders exactly
--      what the sharer saw (scenarios.analysis is legacy/unreliable as a
--      server-side source; the canvas results store is the truth).
--   3. `get_shared_snapshot_by_slug(p_slug)` RPC — the ONLY public read
--      path (anon + authenticated). Returns CONTENT-ONLY fields — never
--      id, scenario_id, user_id, or any owner identifier (ruling
--      condition 1; the shared_briefs anti-leak posture).
--
-- Token + revocation (ruling condition 2):
--   - slug = encode(gen_random_bytes(16), 'hex') — 128-bit, server-minted
--     inside the RPC; the client can never choose or predict it.
--   - Revocation = owner deletes the row (owner-scoped DELETE policy — a
--     deliberate addition over the shared_briefs precedent, which has no
--     revocation UX). Re-sharing mints a fresh slug.
--   - Optional expiry via `expires_at` (must be finite and in the future
--     at creation; the public read filters expired rows).
--   - Possession-of-slug = read (unlisted-link model): identical posture
--     to the LIVE shared_briefs /brief/:slug feature.
--
-- Lifecycle: shares CASCADE on scenario deletion (deliberate CONTRAST
-- with decision_records' no-FK ruling): deleting a scenario is the
-- user's "remove my content" act — outstanding share links MUST die with
-- it. Records preserve the user's own calibration history; shares expose
-- content to third parties. Different doctrine on purpose.
--
-- A4 checklist applied (the 20260710113000_v5_decision_records lesson set):
--   - ENABLE + FORCE ROW LEVEL SECURITY (shared_briefs has ENABLE only —
--     FORCE added here per the scenario_snapshots/model_versions posture).
--   - Owner-only SELECT + owner-only DELETE policies; NO INSERT/UPDATE
--     policies for any JWT role (creation only via the RPC; rows are
--     immutable once minted).
--   - REVOKE ALL on the table FROM PUBLIC, anon, authenticated; then
--     GRANT SELECT, DELETE back to authenticated only (policy-scoped).
--   - Both functions: SECURITY DEFINER + pinned search_path + explicit
--     REVOKE FROM PUBLIC/anon (+ authenticated where applicable) then
--     targeted GRANTs. Supabase default privileges auto-GRANT EXECUTE on
--     new public functions — the explicit revokes are load-bearing.
--   - DISTINCT function names, never overloads.
--   - VALUE-level parameter guards (the #406 round-2 lesson): typed
--     errors before constraint noise; jsonb object-ness enforced.
--
-- Distinct SQLSTATEs raised here (app maps each to a typed result):
--   SS403 — scenario not found or not owned by the caller.
--   22023 — invalid parameter value (guards).
--
-- Verification (run after the separately-approved execution):
--   SELECT relrowsecurity, relforcerowsecurity FROM pg_class
--     WHERE relname = 'shared_snapshots';                 -- t, t
--   SELECT has_function_privilege('anon',
--     'public.get_shared_snapshot_by_slug(text)', 'EXECUTE');   -- true
--   SELECT has_function_privilege('anon',
--     'public.create_shared_snapshot(uuid, jsonb, jsonb, text, text, bigint, timestamptz)',
--     'EXECUTE');                                         -- false
--   SELECT has_function_privilege('authenticated',
--     'public.create_shared_snapshot(uuid, jsonb, jsonb, text, text, bigint, timestamptz)',
--     'EXECUTE');                                         -- true
--   (Grant-layer verification against the LIVE pg_proc/proacl, not this file.)
--   LIVE anon-read check (the #406 checklist item-8 class assumption —
--   FORCE RLS means the definer role must effectively bypass RLS, proven
--   on this database by the model_versions/scenario_snapshots precedents;
--   verify it holds for the anon path): as anon, call
--     select get_shared_snapshot_by_slug('<a-freshly-minted-slug>');
--   → must return the content payload, and NULL for a deleted/expired slug.
-- ============================================================

-- ------------------------------------------------------------
-- 1. The share table. Immutable content copy; owner metadata kept
--    server-side only (never returned by the public read).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shared_snapshots (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- CASCADE is deliberate here (contrast decision_records — see header).
  scenario_id  UUID NOT NULL REFERENCES public.scenarios(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES auth.users(id),
  -- Content payload (what the anon viewer renders). Verbatim graph per
  -- ruling; analysis/brief optional-forward (a share is valid without a
  -- completed analysis).
  graph        JSONB NOT NULL,
  analysis     JSONB,
  brief_text   TEXT,
  graph_hash   TEXT,
  seed         BIGINT,
  -- 128-bit server-minted share token (see header).
  slug         TEXT UNIQUE NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at   TIMESTAMPTZ,
  CONSTRAINT ss_graph_shape CHECK (jsonb_typeof(graph) = 'object'),
  CONSTRAINT ss_analysis_shape CHECK (
    analysis IS NULL OR jsonb_typeof(analysis) = 'object'
  )
);

COMMENT ON TABLE public.shared_snapshots IS
  'Collaboration v0 (ROADMAP 3.3): immutable read-only snapshot shares. '
  'Content copied at share time; addressed by an unguessable 128-bit '
  'server-minted slug; revoked by owner row-delete; dies with the '
  'scenario (CASCADE — deliberate contrast with decision_records). '
  'Public reads ONLY via get_shared_snapshot_by_slug, which returns '
  'content fields only (never ids/owner).';

CREATE INDEX IF NOT EXISTS shared_snapshots_owner_idx
  ON public.shared_snapshots (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS shared_snapshots_scenario_idx
  ON public.shared_snapshots (scenario_id);

-- ------------------------------------------------------------
-- 2. RLS — ENABLE + FORCE; owner-only SELECT (list your shares) and
--    owner-only DELETE (revocation). No INSERT/UPDATE for any JWT role.
-- ------------------------------------------------------------
ALTER TABLE public.shared_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_snapshots FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS select_own_shared_snapshots ON public.shared_snapshots;
CREATE POLICY select_own_shared_snapshots ON public.shared_snapshots
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS delete_own_shared_snapshots ON public.shared_snapshots;
CREATE POLICY delete_own_shared_snapshots ON public.shared_snapshots
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

REVOKE ALL ON public.shared_snapshots FROM PUBLIC, anon, authenticated;
GRANT SELECT, DELETE ON public.shared_snapshots TO authenticated;
GRANT ALL ON public.shared_snapshots TO service_role;

-- ------------------------------------------------------------
-- 3. create_shared_snapshot — owner-only share creation.
--    Client payload (create_snapshot precedent): the UI passes what is
--    on screen. Ownership checked against the scenarios row; slug minted
--    server-side; returns { id, slug, expires_at } for the share URL
--    (${origin}/#/shared/:slug — viewer contract with A2).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_shared_snapshot(
  p_scenario_id UUID,
  p_graph       JSONB,
  p_analysis    JSONB DEFAULT NULL,
  p_brief_text  TEXT DEFAULT NULL,
  p_graph_hash  TEXT DEFAULT NULL,
  p_seed        BIGINT DEFAULT NULL,
  p_expires_at  TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
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
$$;

-- ------------------------------------------------------------
-- 4. get_shared_snapshot_by_slug — the ONLY public read path.
--    CONTENT-ONLY return (ruling condition 1): no id, no scenario_id,
--    no user_id, no owner identifiers of any kind. NULL for unknown,
--    revoked (deleted) or expired slugs — indistinguishable by design.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_shared_snapshot_by_slug(p_slug TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF p_slug IS NULL OR p_slug = '' THEN
    RETURN NULL;
  END IF;

  -- Deliberately NO jsonb_strip_nulls here: it recurses into the payload
  -- and would silently mutate shared user content (an explicit null inside
  -- graph/analysis is the sharer's data, not an absent field). Absent
  -- optional columns therefore surface as JSON null keys — the viewer
  -- treats null and absent identically.
  SELECT jsonb_build_object(
    'graph',      ss.graph,
    'analysis',   ss.analysis,
    'brief_text', ss.brief_text,
    'graph_hash', ss.graph_hash,
    'seed',       ss.seed,
    'created_at', to_jsonb(ss.created_at),
    'expires_at', to_jsonb(ss.expires_at)
  ) INTO v_result
  FROM public.shared_snapshots ss
  WHERE ss.slug = p_slug
    AND (ss.expires_at IS NULL OR ss.expires_at > now());

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN v_result;
END;
$$;

-- ------------------------------------------------------------
-- 5. Function grants — explicit per function (Supabase default
--    privileges auto-GRANT EXECUTE to anon/authenticated).
-- ------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.create_shared_snapshot(
  uuid, jsonb, jsonb, text, text, bigint, timestamptz
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_shared_snapshot(
  uuid, jsonb, jsonb, text, text, bigint, timestamptz
) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_shared_snapshot_by_slug(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_shared_snapshot_by_slug(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_shared_snapshot_by_slug(text) TO authenticated;
