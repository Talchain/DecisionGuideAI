-- RLS audit hardening for external pilot readiness
-- Fixes identified during pre-pilot security audit (2026-03-07)
-- All changes are idempotent (safe to run multiple times)

-- ============================================================
-- F3 (P1): Revoke anon grants on scenarios and shared_briefs
-- Defence in depth — RLS prevents anon access, but grants
-- should not exist per principle of least privilege.
-- REVOKE is idempotent (no error if privilege not held).
-- ============================================================
REVOKE ALL ON scenarios FROM anon;
REVOKE ALL ON shared_briefs FROM anon;

-- ============================================================
-- F1 (P2): Restrict policy roles from {public} to authenticated
-- Current policies apply to all roles; should be authenticated
-- only. DROP + CREATE is the only way to change the TO clause.
-- Using DROP IF EXISTS for idempotency.
-- ============================================================

-- --- scenarios: SELECT ---
DROP POLICY IF EXISTS "Users can read own scenarios" ON scenarios;
CREATE POLICY "Users can read own scenarios"
  ON scenarios FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- --- scenarios: INSERT ---
DROP POLICY IF EXISTS "Users can insert own scenarios" ON scenarios;
CREATE POLICY "Users can insert own scenarios"
  ON scenarios FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- --- scenarios: UPDATE (WITH CHECK prevents user_id reassignment) ---
DROP POLICY IF EXISTS "Users can update own scenarios" ON scenarios;
CREATE POLICY "Users can update own scenarios"
  ON scenarios FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- --- scenarios: DELETE ---
DROP POLICY IF EXISTS "Users can delete own scenarios" ON scenarios;
CREATE POLICY "Users can delete own scenarios"
  ON scenarios FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- --- shared_briefs: SELECT ---
DROP POLICY IF EXISTS "Users can read own shared briefs" ON shared_briefs;
CREATE POLICY "Users can read own shared briefs"
  ON shared_briefs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================
-- Record in migration history
-- ============================================================
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES ('20260307000000', 'rls_audit_hardening', ARRAY['-- Applied via Management API'])
ON CONFLICT (version) DO NOTHING;
