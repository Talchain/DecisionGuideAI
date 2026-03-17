-- ============================================================
-- Olumi Science PoC Schema — Additive Migration
-- Target: Staging Supabase
-- Date: 1 March 2026
--
-- Adds:
--   1. last_turn_nonce column on scenarios (turn ordering)
--   2. Science columns on user_profiles (coaching, consent)
--   3. turn_observations table (per-turn observability)
--   4. purge_old_observations() retention helper
--
-- Additive only — no existing tables, columns, policies, or
-- RPCs are modified (ALTERs on scenarios and user_profiles
-- add new columns only; nothing dropped or renamed).
-- ============================================================


-- ============================================================
-- 1. Add last_turn_nonce to scenarios
-- ============================================================
-- CEE rejects orchestrator requests where turn_nonce <= last_turn_nonce,
-- preventing out-of-order turn processing.

ALTER TABLE scenarios
  ADD COLUMN IF NOT EXISTS last_turn_nonce INTEGER NOT NULL DEFAULT 0;


-- ============================================================
-- 2. Add science columns to user_profiles
-- ============================================================
-- user_profiles already exists (id UUID PK → auth.users(id)).
-- RLS is already enabled with appropriate policies.
-- updated_at trigger (handle_updated_at_user_profiles) already exists.
-- Adding coaching preferences, adaptive layer fields, and research consent.

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS coaching_style TEXT NOT NULL DEFAULT 'socratic'
    CHECK (coaching_style IN ('direct', 'socratic', 'supportive'));

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS calibration_tendency TEXT NOT NULL DEFAULT 'unknown'
    CHECK (calibration_tendency IN ('overconfident', 'underconfident', 'well_calibrated', 'unknown'));

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS bias_susceptibility JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS challenge_tolerance TEXT NOT NULL DEFAULT 'medium'
    CHECK (challenge_tolerance IN ('low', 'medium', 'high'));

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS decisions_completed INTEGER NOT NULL DEFAULT 0;

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS research_consent BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS consent_version TEXT;


-- ============================================================
-- 3. Create turn_observations table
-- ============================================================
-- Per-turn observability data written by CEE via service role key.
-- No raw user message text stored — only classified metadata.

CREATE TABLE IF NOT EXISTS turn_observations (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id                 UUID NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  turn_id                     TEXT NOT NULL UNIQUE,
  turn_sequence               INTEGER NOT NULL GENERATED ALWAYS AS IDENTITY,
  stage                       TEXT NOT NULL,
  substate                    TEXT,
  stage_source                TEXT NOT NULL DEFAULT 'inferred'
                              CHECK (stage_source IN ('explicit_event', 'inferred')),
  intent_classification       TEXT
                              CHECK (intent_classification IN ('explain', 'recommend', 'act', 'conversational')),
  progress_kind               TEXT
                              CHECK (progress_kind IN ('changed_model', 'ran_analysis', 'added_evidence', 'committed', 'none')),
  decision_archetype          TEXT,
  archetype_confidence        TEXT
                              CHECK (archetype_confidence IN ('high', 'medium', 'low')),
  -- If there's no archetype, there must be no confidence
  CONSTRAINT chk_archetype_confidence
    CHECK (decision_archetype IS NOT NULL OR archetype_confidence IS NULL),
  triggers_fired              TEXT[] NOT NULL DEFAULT '{}',
  triggers_suppressed         TEXT[] NOT NULL DEFAULT '{}',
  dsk_claims_used             JSONB NOT NULL DEFAULT '[]'::jsonb,
  techniques_used             JSONB NOT NULL DEFAULT '[]'::jsonb,
  scope_violations            TEXT[] NOT NULL DEFAULT '{}',
  phrasing_violations         TEXT[] NOT NULL DEFAULT '{}',
  rewrite_applied             BOOLEAN NOT NULL DEFAULT false,
  specialist_contributions    JSONB NOT NULL DEFAULT '[]'::jsonb,
  specialist_disagreement     JSONB,
  user_acted_on_intervention  BOOLEAN,
  experiment_id               TEXT,
  experiment_variant          TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Prevent duplicate turn sequences within a scenario
  CONSTRAINT uq_scenario_turn_sequence UNIQUE (scenario_id, turn_sequence)
);

-- Enable RLS
ALTER TABLE turn_observations ENABLE ROW LEVEL SECURITY;

-- =================================================================
-- INTENTIONAL: No user-facing RLS policies on turn_observations.
-- CEE writes via service role key (bypasses RLS).
-- Analytics access: add read-only policies for a dedicated role when needed.
-- Do NOT add auth.uid()-based policies — this is operational data, not user data.
-- =================================================================

-- Indexes
CREATE INDEX idx_turn_obs_scenario_created
  ON turn_observations (scenario_id, created_at);

-- idx_turn_obs_scenario_sequence: redundant — covered by UNIQUE (scenario_id, turn_sequence)
-- idx_turn_obs_turn_id: redundant — covered by UNIQUE on turn_id

CREATE INDEX idx_turn_obs_experiment
  ON turn_observations (experiment_id)
  WHERE experiment_id IS NOT NULL;


-- ============================================================
-- 4. Retention helper function
-- ============================================================

CREATE OR REPLACE FUNCTION purge_old_observations(p_retention_days INTEGER DEFAULT 90)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM turn_observations
  WHERE created_at < now() - (p_retention_days || ' days')::interval;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

-- Lock down: only service role / admin can execute
REVOKE ALL ON FUNCTION purge_old_observations(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION purge_old_observations(INTEGER) TO service_role;
