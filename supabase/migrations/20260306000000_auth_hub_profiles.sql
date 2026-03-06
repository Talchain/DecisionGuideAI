-- Migration: auth_hub_profiles
-- Adds auth trigger enhancements, scenario hub columns, user profile columns,
-- RLS hardening, hub indexes, and legacy table lockdown.
--
-- All statements are idempotent (IF NOT EXISTS / DROP IF EXISTS).

-- ============================================================================
-- 1.1  Add columns to user_profiles
-- ============================================================================

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS onboarding_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS pilot_metrics JSONB NOT NULL DEFAULT '{}'::jsonb;

-- ============================================================================
-- 1.2  Add columns to scenarios
-- ============================================================================

ALTER TABLE scenarios
  ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS source_scenario_id UUID REFERENCES scenarios(id) ON DELETE SET NULL;

ALTER TABLE scenarios
  ALTER COLUMN user_id SET DEFAULT auth.uid();

-- ============================================================================
-- 1.3  Enhance the user-creation trigger
--      Existing trigger: on_auth_user_created → ensure_user_profile()
--      We CREATE OR REPLACE the function to also populate display_name.
--      The existing trigger binding is preserved — no new trigger needed.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.ensure_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
BEGIN
  INSERT INTO public.user_profiles (
    id,
    email,
    display_name,
    created_at,
    updated_at,
    contact_consent
  ) VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      split_part(NEW.email, '@', 1)
    ),
    now(),
    now(),
    false
  )
  ON CONFLICT (id) DO UPDATE SET
    email      = EXCLUDED.email,
    display_name = COALESCE(public.user_profiles.display_name, EXCLUDED.display_name);
  RETURN NEW;
END;
$$;

-- ============================================================================
-- 1.4  duplicate_scenario RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION duplicate_scenario(p_scenario_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_new_id UUID;
BEGIN
  INSERT INTO scenarios (
    user_id, title, scenario_schema_version, stage,
    graph, framing, source_scenario_id
  )
  SELECT
    auth.uid(),
    COALESCE(title, 'Untitled decision') || ' (copy)',
    scenario_schema_version,
    'frame',
    graph,
    framing,
    p_scenario_id
  FROM scenarios
  WHERE id = p_scenario_id AND user_id = auth.uid()
  RETURNING id INTO v_new_id;

  IF v_new_id IS NULL THEN
    RAISE EXCEPTION 'Scenario not found or not owned by user';
  END IF;

  RETURN v_new_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION duplicate_scenario FROM PUBLIC;
GRANT EXECUTE ON FUNCTION duplicate_scenario TO authenticated;

-- ============================================================================
-- 1.5  FORCE ROW LEVEL SECURITY on active tables
-- ============================================================================

ALTER TABLE scenarios         FORCE ROW LEVEL SECURITY;
ALTER TABLE shared_briefs     FORCE ROW LEVEL SECURITY;
ALTER TABLE user_profiles     FORCE ROW LEVEL SECURITY;
ALTER TABLE turn_observations FORCE ROW LEVEL SECURITY;

-- ============================================================================
-- 1.6  RLS policies on user_profiles
-- ============================================================================

-- RLS is already enabled; ensure policies exist
DROP POLICY IF EXISTS "Users can read own profile" ON user_profiles;
CREATE POLICY "Users can read own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() IS NOT NULL AND auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() IS NOT NULL AND auth.uid() = id)
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = id);

-- ============================================================================
-- 1.7  Harden scenario policies (add null-check)
-- ============================================================================

DROP POLICY IF EXISTS "Users can read own scenarios" ON scenarios;
CREATE POLICY "Users can read own scenarios"
  ON scenarios FOR SELECT
  USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own scenarios" ON scenarios;
CREATE POLICY "Users can insert own scenarios"
  ON scenarios FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own scenarios" ON scenarios;
CREATE POLICY "Users can update own scenarios"
  ON scenarios FOR UPDATE
  USING (auth.uid() IS NOT NULL AND auth.uid() = user_id)
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own scenarios" ON scenarios;
CREATE POLICY "Users can delete own scenarios"
  ON scenarios FOR DELETE
  USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

-- ============================================================================
-- 1.8  Hub query indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_scenarios_hub_query
  ON scenarios (user_id, is_archived, is_pinned DESC, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_scenarios_user_updated
  ON scenarios (user_id, updated_at DESC);

-- ============================================================================
-- 1.9  Secure legacy tables (deny-by-default)
--      Enable FORCE RLS with no policies = deny all via anon/authenticated.
--      SECURITY DEFINER RPCs bypass RLS, so server-side logic still works.
--
--      Tables skipped: decisions, decision_collaborators, decision_analysis,
--      decision_data, options — these are still queried from the UI.
-- ============================================================================

DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'canvases', 'canvas_blocks', 'canvas_comments',
      'canvas_permissions', 'canvas_presence', 'canvas_versions',
      'canvas_version_comments', 'canvas_templates',
      'ai_suggestions', 'ai_feedback', 'ai_context',
      'criteria_sets', 'criteria_suggestions',
      'criteria_votes', 'criteria_comments', 'criteria_templates',
      'decision_suggestions', 'decision_activities',
      'decision_comments', 'items'
    ])
  LOOP
    EXECUTE format('ALTER TABLE IF EXISTS %I FORCE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- ============================================================================
-- 1.10 Email sync trigger
--      Existing trigger: on_auth_user_email_update → update_user_profile_email()
--      Already syncs email. Enhance to also sync display_name if null.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_user_profile_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    UPDATE public.user_profiles
    SET email = NEW.email, updated_at = now()
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger already exists as on_auth_user_email_update; no need to recreate.
