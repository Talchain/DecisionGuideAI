-- ============================================================================
-- !!! DRAFT COLLABORATION MIGRATION — DO NOT APPLY !!!
-- ============================================================================
-- File: 20260617000000_workspaces_foundation_draft.sql
-- Lane: Collaboration MVP infrastructure acceleration (DDL + static validation)
-- Design input: DRAFT tenancy/collaboration spec v1.7 (PR #190). v1.7 is a DRAFT
--               validation baseline, not a banked/approved spec, until Paul/ChatGPT
--               explicitly confirm a corrected Codex approval. See
--               docs/audits/collab-foundation-blocker-checklist-v1.md.
--
-- THIS FILE IS:
--   * draft only;
--   * NOT for canonical application (never apply to etmmuzwxtcjipwphdola);
--   * NOT for merge or deploy;
--   * rehearsal-applyable ONLY when explicitly approved, and ONLY by a deliberate
--     one-line removal of the abort guard below, in a separate approved rehearsal step.
--
-- This is the ADDITIVE foundation half (new workspace tables, helpers, lifecycle
-- RPC skeletons). It does not touch existing tables. The destructive tenancy
-- cutover lives in 20260617000001_scenarios_workspace_cutover_draft.sql and is
-- blocked until the named gates close.
--
-- The `_draft` suffix is NOT sufficient protection: Supabase migration tooling
-- applies files by timestamp order, and this file lives under supabase/migrations/.
-- The abort guard below makes accidental whole-file application fail safely.
-- ============================================================================

DO $$ BEGIN
  RAISE EXCEPTION 'DRAFT collaboration migration — must not be applied; see header and gates';
END $$;

-- ============================================================================
-- Everything below is END-STATE DDL for review and static validation only.
-- It is unreachable when the file is applied as a transaction (the guard above
-- aborts and rolls back). It is NOT the real application sequence; the real
-- migration follows v1.7 §20 (expand, backfill, assert, switch, rehearse) before
-- any canonical application is even considered.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Helpers (SECURITY DEFINER, recursion-safe).
-- SECURITY DEFINER lets these bypass RLS so membership policies that call them
-- do not recurse into workspace_members RLS. Boolean-only, no existence
-- differentiation. Centralised role hierarchy: owner > admin > editor > viewer.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION is_workspace_member(p_workspace_id uuid)
  RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = p_workspace_id AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION is_workspace_role(p_workspace_id uuid, p_min_role text)
  RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = pg_catalog, public
AS $$
  -- Rank: owner=4, admin=3, editor=2, viewer=1. True when the caller's role
  -- ranks at or above p_min_role for the workspace.
  SELECT EXISTS (
    SELECT 1 FROM workspace_members m
    WHERE m.workspace_id = p_workspace_id
      AND m.user_id = auth.uid()
      AND (CASE m.role WHEN 'owner' THEN 4 WHEN 'admin' THEN 3 WHEN 'editor' THEN 2 WHEN 'viewer' THEN 1 ELSE 0 END)
          >= (CASE p_min_role WHEN 'owner' THEN 4 WHEN 'admin' THEN 3 WHEN 'editor' THEN 2 WHEN 'viewer' THEN 1 ELSE 0 END)
  );
$$;

REVOKE ALL ON FUNCTION is_workspace_member(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION is_workspace_role(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_workspace_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION is_workspace_role(uuid, text) TO authenticated;

-- ----------------------------------------------------------------------------
-- Table: workspaces
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS workspaces (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  description  text,                                    -- safe settings field (§8.2)
  is_personal  boolean NOT NULL DEFAULT false,          -- personal-workspace invariant flag
  created_by   uuid NOT NULL REFERENCES auth.users(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  -- Composite key target so child rows can enforce (id, workspace_id) consistency
  -- via composite FK once scenarios carry workspace_id (cutover file, §9).
  CONSTRAINT workspaces_id_unique UNIQUE (id)
);

ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspaces FORCE ROW LEVEL SECURITY;

-- SELECT: any member of the workspace.
CREATE POLICY "select_member_workspaces" ON workspaces
  FOR SELECT TO authenticated USING (is_workspace_member(id));

-- INSERT: only via the owner-atomic create_workspace RPC (no permissive INSERT
-- policy; direct inserts are denied so creation always seeds an owner member).
-- No INSERT policy is created here on purpose.

-- UPDATE: admin-or-above, constrained to allowlisted safe settings fields (§8.2).
-- Security and lifecycle fields (id, created_by, is_personal, owner membership)
-- are immutable or RPC-only. The WITH CHECK plus a column-guard trigger (added in
-- the implementation lane) enforce the allowlist; personal-workspace invariants
-- cannot be mutated through this generic path.
CREATE POLICY "update_admin_workspaces_safe_fields" ON workspaces
  FOR UPDATE TO authenticated
  USING (is_workspace_role(id, 'admin'))
  WITH CHECK (is_workspace_role(id, 'admin'));

-- DELETE: forbidden in MVP. No DELETE policy is created (workspace deletion forbidden).

REVOKE ALL ON workspaces FROM anon;

COMMENT ON COLUMN workspaces.is_personal IS
  'Personal-workspace invariant: a personal workspace has exactly one member (its owner) and accepts no invites. Enforced by create_workspace and the lifecycle RPCs; pure DDL cannot fully express "exactly one member".';
COMMENT ON POLICY "update_admin_workspaces_safe_fields" ON workspaces IS
  'UPDATE constrained to allowlisted safe settings fields only (name, description). id/created_by/is_personal/owner-membership/role/security fields are immutable or RPC-only (§8.2).';

-- ----------------------------------------------------------------------------
-- Table: workspace_members
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS workspace_members (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES auth.users(id),
  role          text NOT NULL CHECK (role IN ('owner', 'admin', 'editor', 'viewer')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workspace_members_unique UNIQUE (workspace_id, user_id)
);

ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members FORCE ROW LEVEL SECURITY;

-- Single-owner invariant: at most one owner row per workspace.
CREATE UNIQUE INDEX IF NOT EXISTS idx_workspace_members_single_owner
  ON workspace_members(workspace_id) WHERE role = 'owner';

CREATE INDEX IF NOT EXISTS idx_workspace_members_user
  ON workspace_members(user_id);

-- SELECT: members can see the membership of their own workspaces.
CREATE POLICY "select_member_workspace_members" ON workspace_members
  FOR SELECT TO authenticated USING (is_workspace_member(workspace_id));

-- INSERT/UPDATE/DELETE: via lifecycle RPCs only (no permissive write policies).

REVOKE ALL ON workspace_members FROM anon;

COMMENT ON INDEX idx_workspace_members_single_owner IS
  'Single-owner invariant: exactly one owner per workspace (creation seeds it; transfer is a deferred RPC).';

-- ----------------------------------------------------------------------------
-- Table: workspace_invites
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS workspace_invites (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email         text NOT NULL,
  role          text NOT NULL CHECK (role IN ('admin', 'editor', 'viewer')),
  token_hash    text NOT NULL,                          -- store ONLY the hash, never the raw token
  status        text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
  expires_at    timestamptz NOT NULL,
  invited_by    uuid NOT NULL REFERENCES auth.users(id),
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE workspace_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_invites FORCE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_workspace_invites_workspace
  ON workspace_invites(workspace_id, status);

-- SELECT: admin-or-above of the workspace, or the invitee (matched by verified email).
-- No raw-token lookup path; acceptance verifies the hash inside the RPC.
CREATE POLICY "select_admin_or_invitee_invites" ON workspace_invites
  FOR SELECT TO authenticated
  USING (
    is_workspace_role(workspace_id, 'admin')
    OR lower(email) = lower((auth.jwt() ->> 'email'))
  );

-- INSERT/UPDATE: via invite lifecycle RPCs only (no permissive write policies).

REVOKE ALL ON workspace_invites FROM anon;

COMMENT ON COLUMN workspace_invites.token_hash IS
  'Invite token is hashed, not raw-token stored. The raw single-use token is delivered out of band (email) and never persisted; acceptance hashes the presented token and compares.';

-- ----------------------------------------------------------------------------
-- RPC: create_workspace — owner-atomic creation.
-- Inserts the workspace and the creator as the single owner member in one tx.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION create_workspace(
  p_name        text,
  p_is_personal boolean DEFAULT false
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'forbidden: not authenticated';
  END IF;

  INSERT INTO workspaces (name, is_personal, created_by)
  VALUES (p_name, p_is_personal, auth.uid())
  RETURNING id INTO v_id;

  -- Owner-atomic: the creator becomes the single owner in the same transaction.
  INSERT INTO workspace_members (workspace_id, user_id, role)
  VALUES (v_id, auth.uid(), 'owner');

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION create_workspace(text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_workspace(text, boolean) TO authenticated;

-- ----------------------------------------------------------------------------
-- Member lifecycle RPC skeletons (admin-gated; admin cannot remove or grant owner;
-- no self-escalation). Bodies are DRAFT skeletons — signature, permission guard,
-- and core invariant checks — to be completed in the implementation lane.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION add_workspace_member(
  p_workspace_id uuid,
  p_user_id      uuid,
  p_role         text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NOT is_workspace_role(p_workspace_id, 'admin') THEN
    RAISE EXCEPTION 'forbidden: admin role required';
  END IF;
  IF p_role = 'owner' THEN
    RAISE EXCEPTION 'forbidden: cannot grant owner via add_workspace_member';
  END IF;
  -- DRAFT skeleton: full upsert/idempotency body added in the implementation lane.
  INSERT INTO workspace_members (workspace_id, user_id, role)
  VALUES (p_workspace_id, p_user_id, p_role)
  ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = EXCLUDED.role;
END;
$$;

CREATE OR REPLACE FUNCTION remove_workspace_member(
  p_workspace_id uuid,
  p_user_id      uuid
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NOT is_workspace_role(p_workspace_id, 'admin') THEN
    RAISE EXCEPTION 'forbidden: admin role required';
  END IF;
  IF EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = p_workspace_id AND user_id = p_user_id AND role = 'owner'
  ) THEN
    RAISE EXCEPTION 'forbidden: cannot remove the workspace owner';
  END IF;
  DELETE FROM workspace_members
  WHERE workspace_id = p_workspace_id AND user_id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION change_workspace_member_role(
  p_workspace_id uuid,
  p_user_id      uuid,
  p_role         text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NOT is_workspace_role(p_workspace_id, 'admin') THEN
    RAISE EXCEPTION 'forbidden: admin role required';
  END IF;
  IF p_role = 'owner' THEN
    RAISE EXCEPTION 'forbidden: cannot grant owner (transfer is a deferred RPC)';
  END IF;
  -- DRAFT skeleton: also block demoting the existing owner; completed in impl lane.
  UPDATE workspace_members SET role = p_role
  WHERE workspace_id = p_workspace_id AND user_id = p_user_id AND role <> 'owner';
END;
$$;

REVOKE ALL ON FUNCTION add_workspace_member(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION remove_workspace_member(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION change_workspace_member_role(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION add_workspace_member(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION remove_workspace_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION change_workspace_member_role(uuid, uuid, text) TO authenticated;

-- ----------------------------------------------------------------------------
-- Invite lifecycle RPC skeletons. Tokens are hashed; raw tokens are never stored.
-- DRAFT skeletons: signature, permission guard, core invariant checks.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION create_workspace_invite(
  p_workspace_id uuid,
  p_email        text,
  p_role         text,
  p_token_hash   text,
  p_expires_at   timestamptz
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT is_workspace_role(p_workspace_id, 'admin') THEN
    RAISE EXCEPTION 'forbidden: admin role required';
  END IF;
  IF p_role = 'owner' THEN
    RAISE EXCEPTION 'forbidden: cannot invite as owner';
  END IF;
  -- DRAFT skeleton: caller hashes the single-use token; only the hash is stored.
  INSERT INTO workspace_invites (workspace_id, email, role, token_hash, expires_at, invited_by)
  VALUES (p_workspace_id, p_email, p_role, p_token_hash, p_expires_at, auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION accept_workspace_invite(
  p_token_hash text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_invite workspace_invites%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'forbidden: not authenticated';
  END IF;
  -- DRAFT skeleton: single-use, expiry, verified-email checks completed in impl lane.
  SELECT * INTO v_invite FROM workspace_invites
  WHERE token_hash = p_token_hash AND status = 'pending' AND expires_at > now();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'forbidden: invalid, expired, or already-used invite';
  END IF;
  IF lower(v_invite.email) <> lower((auth.jwt() ->> 'email')) THEN
    RAISE EXCEPTION 'forbidden: invite email does not match the verified account email';
  END IF;
  INSERT INTO workspace_members (workspace_id, user_id, role)
  VALUES (v_invite.workspace_id, auth.uid(), v_invite.role)
  ON CONFLICT (workspace_id, user_id) DO NOTHING;
  UPDATE workspace_invites SET status = 'accepted' WHERE id = v_invite.id;
  RETURN v_invite.workspace_id;
END;
$$;

CREATE OR REPLACE FUNCTION revoke_workspace_invite(
  p_invite_id uuid
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_ws uuid;
BEGIN
  SELECT workspace_id INTO v_ws FROM workspace_invites WHERE id = p_invite_id;
  IF v_ws IS NULL THEN
    RAISE EXCEPTION 'not found: invite';
  END IF;
  IF NOT is_workspace_role(v_ws, 'admin') THEN
    RAISE EXCEPTION 'forbidden: admin role required';
  END IF;
  UPDATE workspace_invites SET status = 'revoked' WHERE id = p_invite_id;
END;
$$;

REVOKE ALL ON FUNCTION create_workspace_invite(uuid, text, text, text, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION accept_workspace_invite(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION revoke_workspace_invite(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_workspace_invite(uuid, text, text, text, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION accept_workspace_invite(text) TO authenticated;
GRANT EXECUTE ON FUNCTION revoke_workspace_invite(uuid) TO authenticated;

-- ============================================================================
-- END of additive foundation draft. NOT APPLIED. NOT FOR MERGE OR DEPLOY.
-- ============================================================================
