-- ============================================================================
-- WORKSPACE & IDENTITY — M1: TENANCY CORE (S-1)  [rev 2]
-- ============================================================================
-- AUTHORED AS CODE — NOT YET EXECUTED. Execution is A1/Paul-batched and is
-- BLOCKED until (a) the drift register precedes it and (b) a REHEARSAL run
-- under the real execution role proves clean apply (Gate-1 verdict + external
-- review round 3: the wsid_definer ownership bootstrap depends on executor
-- role mechanics that must be proven, not assumed).
-- Contract of record: docs/specs/workspace-identity-schema-contract-v1.md
-- (v1.2+, PR #264). Authorization: A1-RULING-F3-AND-GATE1-2026-07-12.md.
--
-- rev 2 (external review round 3, all four P0/P1 classes addressed):
--   * ownership BOOTSTRAP: executor joins wsid_definer + schema CREATE grant
--     (PG15: ALTER ... OWNER requires SET ROLE ability + CREATE on schema);
--     CREATE revoked again post-transfer. M5 function replacement works via
--     the retained membership.
--   * C2 completed: the deletion sentinel is SUBJECT-SCOPED (carries the
--     deleted user's uuid, not a boolean) and every guard RE-ASSERTS its
--     invariant against that subject (owner-row removal only for the subject's
--     personal workspace; workspace deletion only for the subject's personal
--     workspace). Rule (contract §1.6): every future ownership writer or
--     transfer RPC takes pg_advisory_xact_lock(hashtext(user_id::text)).
--   * role_rank fail-closed: invalid p_min_role now denies everyone (was:
--     rank 0 authorised every member).
--   * ALL functions (incl. trigger functions) get explicit PUBLIC/anon
--     EXECUTE revokes (PG default-grants EXECUTE to PUBLIC).
--   * verification strengthened: schema-qualified, asserts owners, pinned
--     search_path, trigger enablement, ACL absence — not just counts.
-- Deliberately ABSENT: workspace_invites (P9) · org_id (M3) · orchestration
-- RPC (M5 — the auth.users trigger pair is the enforcement point).
-- Classification: REVERSIBLE (rollback file, refusal-guarded).
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 0. Definer role + ownership bootstrap (contract §5.1a)
--    PG15 mechanics: the executor must be a member of the new owning role to
--    ALTER ... OWNER TO it, and the new owner needs CREATE on the schema at
--    transfer time. NO BYPASSRLS anywhere (PG15 CREATEROLE cannot mint it).
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'wsid_definer') THEN
    CREATE ROLE wsid_definer NOLOGIN;
  END IF;
END $$;
GRANT wsid_definer TO postgres;             -- executor membership (idempotent)
GRANT USAGE, CREATE ON SCHEMA public TO wsid_definer;  -- CREATE revoked in §9

-- ---------------------------------------------------------------------------
-- 1. role_rank — single encoding of the role hierarchy (contract §0)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.role_rank(p_role TEXT)
RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_role WHEN 'owner' THEN 4 WHEN 'admin' THEN 3
                     WHEN 'editor' THEN 2 WHEN 'viewer' THEN 1 ELSE 0 END;
$$;
ALTER FUNCTION public.role_rank(TEXT) OWNER TO wsid_definer;
REVOKE ALL ON FUNCTION public.role_rank(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.role_rank(TEXT) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Tables (contract §1.1 / §1.2)
-- ---------------------------------------------------------------------------
CREATE TABLE public.workspaces (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  is_personal BOOLEAN NOT NULL DEFAULT false,
  created_by  UUID NOT NULL,  -- authorship snapshot; NO FK (records-outlive-accounts);
                              -- lifecycle via the auth.users trigger pair (§1.6)
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.workspaces IS
  'W&I M1 (contract v1.2 §1.1). org_id arrives in M3 atomically with the org spine.';

CREATE UNIQUE INDEX workspaces_one_personal_per_user_idx
  ON public.workspaces (created_by) WHERE is_personal;

CREATE TABLE public.workspace_members (
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role         TEXT NOT NULL CHECK (role IN ('owner','admin','editor','viewer')),
  joined_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id)
);
CREATE UNIQUE INDEX workspace_members_one_owner_idx
  ON public.workspace_members (workspace_id) WHERE role = 'owner';
CREATE INDEX workspace_members_user_idx ON public.workspace_members (user_id);

-- ---------------------------------------------------------------------------
-- 3. Helpers (contract §1.4) — is_workspace_role FAILS CLOSED on invalid
--    p_min_role (rev 2: rank 0 previously authorised every member)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_workspace_member(p_workspace UUID)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public AS $$
  SELECT EXISTS (SELECT 1 FROM public.workspace_members
                 WHERE workspace_id = p_workspace AND user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.is_workspace_role(p_workspace UUID, p_min_role TEXT)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public AS $$
  SELECT public.role_rank(p_min_role) >= 1     -- invalid vocabulary => false for ALL
     AND EXISTS (SELECT 1 FROM public.workspace_members
                 WHERE workspace_id = p_workspace AND user_id = auth.uid()
                   AND public.role_rank(role) >= public.role_rank(p_min_role));
$$;

ALTER FUNCTION public.is_workspace_member(UUID) OWNER TO wsid_definer;
ALTER FUNCTION public.is_workspace_role(UUID, TEXT) OWNER TO wsid_definer;
REVOKE ALL ON FUNCTION public.is_workspace_member(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_workspace_role(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_workspace_member(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_workspace_role(UUID, TEXT) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. RLS: FORCE + deny-by-default; JWT policies + TO wsid_definer policies
-- ---------------------------------------------------------------------------
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces FORCE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members FORCE ROW LEVEL SECURITY;

CREATE POLICY ws_select_member ON public.workspaces
  FOR SELECT TO authenticated USING (public.is_workspace_member(id));
CREATE POLICY ws_update_admin ON public.workspaces
  FOR UPDATE TO authenticated
  USING (public.is_workspace_role(id, 'admin'))
  WITH CHECK (public.is_workspace_role(id, 'admin'));  -- column allowlist via WS001 trigger
CREATE POLICY wm_select_roster ON public.workspace_members
  FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));

CREATE POLICY ws_definer_select ON public.workspaces
  FOR SELECT TO wsid_definer USING (true);
CREATE POLICY ws_definer_insert ON public.workspaces
  FOR INSERT TO wsid_definer WITH CHECK (true);
CREATE POLICY ws_definer_delete ON public.workspaces
  FOR DELETE TO wsid_definer USING (true);       -- WS002 trigger still binds
CREATE POLICY wm_definer_all ON public.workspace_members
  FOR ALL TO wsid_definer USING (true) WITH CHECK (true);  -- WM409/WM410 triggers still bind

-- ---------------------------------------------------------------------------
-- 5. Grants (contract §5.2; explicit revokes are load-bearing — F9)
-- ---------------------------------------------------------------------------
REVOKE ALL ON public.workspaces        FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON public.workspace_members FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, UPDATE ON public.workspaces TO authenticated;
GRANT SELECT ON public.workspaces          TO service_role;
GRANT SELECT ON public.workspace_members   TO authenticated, service_role;
GRANT SELECT, INSERT, DELETE ON public.workspaces        TO wsid_definer;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_members TO wsid_definer;

-- ---------------------------------------------------------------------------
-- 6. Invariant guard triggers. The deletion sentinel `app.wsid_deletion`
--    carries the SUBJECT UUID (rev 2) and every guard re-asserts its
--    invariant against that subject — a transaction-wide boolean authorised
--    too much (review round 3 / A1 condition C2).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.workspaces_update_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.created_by IS DISTINCT FROM OLD.created_by
     OR NEW.is_personal IS DISTINCT FROM OLD.is_personal
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'workspaces: immutable column change rejected'
      USING ERRCODE = 'WS001';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.workspaces_delete_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public AS $$
BEGIN
  -- Re-assert (C2): only the deletion SUBJECT's PERSONAL workspace may go.
  IF NOT (OLD.is_personal
          AND coalesce(current_setting('app.wsid_deletion', true), '')
              = OLD.created_by::text) THEN
    RAISE EXCEPTION 'workspaces: DELETE forbidden outside the account-deletion path (MVP)'
      USING ERRCODE = 'WS002';
  END IF;
  RETURN OLD;
END $$;

CREATE OR REPLACE FUNCTION public.workspace_members_owner_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public AS $$
DECLARE
  v_personal BOOLEAN;
BEGIN
  IF OLD.role = 'owner' THEN
    -- Re-assert (C2): the owner row may only be removed for the deletion
    -- SUBJECT, and only where the workspace is personal. If the workspace row
    -- is already gone mid-cascade, workspaces_delete_guard has ALREADY
    -- asserted personal+subject for it in this same transaction.
    SELECT is_personal INTO v_personal
      FROM public.workspaces WHERE id = OLD.workspace_id;
    IF NOT (coalesce(current_setting('app.wsid_deletion', true), '')
              = OLD.user_id::text
            AND coalesce(v_personal, true)) THEN
      RAISE EXCEPTION 'workspace_members: owner row may not be % (transfer RPC deferred)', lower(TG_OP)
        USING ERRCODE = 'WM409';
    END IF;
  END IF;
  RETURN CASE TG_OP WHEN 'DELETE' THEN OLD ELSE NEW END;
END $$;

CREATE OR REPLACE FUNCTION public.workspace_members_personal_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public AS $$
DECLARE
  v_ws public.workspaces%ROWTYPE;
BEGIN
  SELECT * INTO v_ws FROM public.workspaces WHERE id = NEW.workspace_id;
  IF v_ws.is_personal THEN
    IF TG_OP = 'UPDATE' THEN
      RAISE EXCEPTION 'workspace_members: personal-workspace membership is immutable'
        USING ERRCODE = 'WM410';
    END IF;
    IF NEW.role <> 'owner' OR NEW.user_id <> v_ws.created_by
       OR EXISTS (SELECT 1 FROM public.workspace_members
                  WHERE workspace_id = NEW.workspace_id) THEN
      RAISE EXCEPTION 'workspace_members: personal workspace holds exactly one owner member'
        USING ERRCODE = 'WM410';
    END IF;
  END IF;
  RETURN NEW;
END $$;

ALTER FUNCTION public.workspaces_update_guard() OWNER TO wsid_definer;
ALTER FUNCTION public.workspaces_delete_guard() OWNER TO wsid_definer;
ALTER FUNCTION public.workspace_members_owner_guard() OWNER TO wsid_definer;
ALTER FUNCTION public.workspace_members_personal_guard() OWNER TO wsid_definer;
REVOKE ALL ON FUNCTION public.workspaces_update_guard() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.workspaces_delete_guard() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.workspace_members_owner_guard() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.workspace_members_personal_guard() FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER workspaces_update_guard BEFORE UPDATE ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.workspaces_update_guard();
CREATE TRIGGER workspaces_delete_guard BEFORE DELETE ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.workspaces_delete_guard();
CREATE TRIGGER workspace_members_owner_guard BEFORE UPDATE OR DELETE ON public.workspace_members
  FOR EACH ROW EXECUTE FUNCTION public.workspace_members_owner_guard();
CREATE TRIGGER workspace_members_personal_guard BEFORE INSERT OR UPDATE ON public.workspace_members
  FOR EACH ROW EXECUTE FUNCTION public.workspace_members_personal_guard();

-- ---------------------------------------------------------------------------
-- 7. create_workspace — owner-atomic; authenticated only; takes the SAME
--    advisory lock as the deletion precheck (C2 serialisation rule: every
--    ownership writer locks hashtext(user_id::text)).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_workspace(p_name TEXT)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_id  UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'create_workspace: authentication required' USING ERRCODE = 'WS401';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext(v_uid::text));
  INSERT INTO public.workspaces (name, is_personal, created_by)
  VALUES (btrim(p_name), false, v_uid)
  RETURNING id INTO v_id;
  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (v_id, v_uid, 'owner');
  RETURN jsonb_build_object('workspace_id', v_id, 'name', btrim(p_name), 'role', 'owner');
END $$;
ALTER FUNCTION public.create_workspace(TEXT) OWNER TO wsid_definer;
REVOKE ALL ON FUNCTION public.create_workspace(TEXT) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.create_workspace(TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- 8. Provisioning + account-deletion trigger pair (contract §1.6, C1/C2)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.provision_personal_workspace()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public AS $$
DECLARE
  v_name TEXT;
  v_id   UUID;
BEGIN
  v_name := coalesce(nullif(split_part(coalesce(NEW.email, ''), '@', 1), ''),
                     'Personal workspace');
  INSERT INTO public.workspaces (name, is_personal, created_by)
  VALUES (v_name, true, NEW.id)
  ON CONFLICT (created_by) WHERE is_personal DO NOTHING
  RETURNING id INTO v_id;
  IF v_id IS NOT NULL THEN
    INSERT INTO public.workspace_members (workspace_id, user_id, role)
    VALUES (v_id, NEW.id, 'owner')
    ON CONFLICT (workspace_id, user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
ALTER FUNCTION public.provision_personal_workspace() OWNER TO wsid_definer;
REVOKE ALL ON FUNCTION public.provision_personal_workspace() FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER on_auth_user_created_workspace
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.provision_personal_workspace();

-- C2: BEFORE DELETE — transfer-required refusal (CQ-5 interim) + SUBJECT-SCOPED
-- sentinel so the personal cascade passes the guards for THIS user only.
CREATE OR REPLACE FUNCTION public.auth_users_delete_precheck()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(OLD.id::text));  -- serialise vs create_workspace
  IF EXISTS (SELECT 1
               FROM public.workspace_members m
               JOIN public.workspaces w ON w.id = m.workspace_id
              WHERE m.user_id = OLD.id AND m.role = 'owner' AND NOT w.is_personal) THEN
    RAISE EXCEPTION 'account deletion refused: transfer ownership of shared workspaces first (CQ-5 interim rule)'
      USING ERRCODE = 'WM412';
  END IF;
  PERFORM set_config('app.wsid_deletion', OLD.id::text, true);  -- txn-local, SUBJECT-scoped
  RETURN OLD;
END $$;
ALTER FUNCTION public.auth_users_delete_precheck() OWNER TO wsid_definer;
REVOKE ALL ON FUNCTION public.auth_users_delete_precheck() FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER auth_users_delete_precheck
  BEFORE DELETE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.auth_users_delete_precheck();

-- C1: AFTER DELETE — personal-workspace cleanup. M5 EXTENDS THIS FUNCTION BODY
-- with terminal consent-withdraw events + the severance hook (contract §1.6).
CREATE OR REPLACE FUNCTION public.auth_users_delete_cleanup()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public AS $$
BEGIN
  DELETE FROM public.workspaces WHERE created_by = OLD.id AND is_personal;
  RETURN OLD;
END $$;
ALTER FUNCTION public.auth_users_delete_cleanup() OWNER TO wsid_definer;
REVOKE ALL ON FUNCTION public.auth_users_delete_cleanup() FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER auth_users_delete_cleanup
  AFTER DELETE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.auth_users_delete_cleanup();

-- ---------------------------------------------------------------------------
-- 9. Bootstrap close-out: CREATE was needed only for the ownership transfers.
-- ---------------------------------------------------------------------------
REVOKE CREATE ON SCHEMA public FROM wsid_definer;   -- USAGE retained

-- ---------------------------------------------------------------------------
-- 10. Backfill: one personal workspace per EXISTING auth user (dynamic)
-- ---------------------------------------------------------------------------
INSERT INTO public.workspaces (name, is_personal, created_by)
SELECT coalesce(nullif(split_part(coalesce(u.email, ''), '@', 1), ''), 'Personal workspace'),
       true, u.id
  FROM auth.users u
ON CONFLICT (created_by) WHERE is_personal DO NOTHING;

INSERT INTO public.workspace_members (workspace_id, user_id, role)
SELECT w.id, w.created_by, 'owner'
  FROM public.workspaces w
 WHERE w.is_personal
ON CONFLICT (workspace_id, user_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 11. In-transaction verification (rev 2: owners, search_path, ACLs, trigger
--     enablement — not just counts). COMMIT only on pass.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_users    BIGINT;
  v_personal BIGINT;
  v_owners   BIGINT;
  v_bad      TEXT;
BEGIN
  SELECT count(*) INTO v_users FROM auth.users;
  SELECT count(*) INTO v_personal FROM public.workspaces WHERE is_personal;
  SELECT count(*) INTO v_owners
    FROM public.workspace_members m
    JOIN public.workspaces w ON w.id = m.workspace_id
   WHERE w.is_personal AND m.role = 'owner';
  IF v_personal <> v_users OR v_owners <> v_users THEN
    RAISE EXCEPTION 'M1 verify: personal workspaces (%) / owner rows (%) != auth.users (%)',
      v_personal, v_owners, v_users;
  END IF;

  IF (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname IN ('workspaces','workspace_members')
        AND c.relrowsecurity AND c.relforcerowsecurity) <> 2 THEN
    RAISE EXCEPTION 'M1 verify: ENABLE+FORCE RLS missing';
  END IF;

  IF (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='workspaces') <> 5
     OR (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='workspace_members') <> 2 THEN
    RAISE EXCEPTION 'M1 verify: policy count mismatch';
  END IF;

  -- Every lane function: owner = wsid_definer, search_path pinned (except the
  -- two INVOKER-safe IMMUTABLE utils), no PUBLIC/anon EXECUTE.
  SELECT string_agg(p.proname, ',') INTO v_bad
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname IN ('role_rank','is_workspace_member','is_workspace_role',
       'workspaces_update_guard','workspaces_delete_guard',
       'workspace_members_owner_guard','workspace_members_personal_guard',
       'create_workspace','provision_personal_workspace',
       'auth_users_delete_precheck','auth_users_delete_cleanup')
     AND (p.proowner <> (SELECT oid FROM pg_roles WHERE rolname = 'wsid_definer')
          OR (p.proname <> 'role_rank'
              AND (p.proconfig IS NULL
                   OR NOT EXISTS (SELECT 1 FROM unnest(p.proconfig) cfg
                                  WHERE cfg LIKE 'search_path=%pg_catalog%'))));
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'M1 verify: owner/search_path wrong on: %', v_bad;
  END IF;

  SELECT string_agg(DISTINCT p.proname, ',') INTO v_bad
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace,
         LATERAL aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a
   WHERE n.nspname = 'public'
     AND p.proname IN ('role_rank','is_workspace_member','is_workspace_role',
       'workspaces_update_guard','workspaces_delete_guard',
       'workspace_members_owner_guard','workspace_members_personal_guard',
       'create_workspace','provision_personal_workspace',
       'auth_users_delete_precheck','auth_users_delete_cleanup')
     AND a.grantee::regrole::text IN ('-','anon')   -- '-' = PUBLIC
     AND a.privilege_type = 'EXECUTE';
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'M1 verify: PUBLIC/anon EXECUTE survives on: %', v_bad;
  END IF;

  IF (SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE NOT t.tgisinternal AND t.tgenabled = 'O'
        AND ((n.nspname='public' AND c.relname IN ('workspaces','workspace_members'))
          OR (n.nspname='auth' AND c.relname='users'
              AND t.tgname IN ('on_auth_user_created_workspace',
                               'auth_users_delete_precheck','auth_users_delete_cleanup')))
        AND t.tgname IN ('workspaces_update_guard','workspaces_delete_guard',
              'workspace_members_owner_guard','workspace_members_personal_guard',
              'on_auth_user_created_workspace','auth_users_delete_precheck',
              'auth_users_delete_cleanup')) <> 7 THEN
    RAISE EXCEPTION 'M1 verify: trigger set incomplete or disabled';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.role_table_grants
             WHERE table_schema='public'
               AND table_name IN ('workspaces','workspace_members')
               AND grantee IN ('anon', 'PUBLIC')) THEN
    RAISE EXCEPTION 'M1 verify: anon/PUBLIC table grant leaked';
  END IF;

  RAISE NOTICE 'M1 verify PASS: % users, % personal workspaces, % owner rows',
    v_users, v_personal, v_owners;
END $$;

COMMIT;
