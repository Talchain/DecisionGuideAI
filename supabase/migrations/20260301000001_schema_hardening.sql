-- ============================================================
-- Science PoC Schema Hardening — Additive Constraints
-- Target: Staging Supabase
-- Date: 1 March 2026
--
-- Tightens constraints on tables from 20260301000000_science_poc_schema.sql:
--   1. Consent consistency on user_profiles
--   2. Stage enum on turn_observations
--   3. Substate enum on turn_observations
--
-- Additive only — no columns, tables, or policies modified.
-- ============================================================


-- ============================================================
-- 1. Consent consistency: research_consent = true requires a consent_version
-- ============================================================

ALTER TABLE public.user_profiles
  ADD CONSTRAINT chk_user_profiles_consent_version
  CHECK (research_consent = false OR consent_version IS NOT NULL);


-- ============================================================
-- 2. Stage must match the canonical set from scenarios.stage CHECK
-- ============================================================

ALTER TABLE public.turn_observations
  ADD CONSTRAINT chk_turn_observations_stage
  CHECK (stage IN ('frame', 'ideate', 'evaluate', 'decide', 'optimise'));


-- ============================================================
-- 3. Substate restricted to known values (or NULL)
-- ============================================================

ALTER TABLE public.turn_observations
  ADD CONSTRAINT chk_turn_observations_substate
  CHECK (substate IS NULL OR substate IN ('needs_run', 'has_run', 'ready_to_commit', 'committed'));
