-- Invite a colleague to a decision: VIEWER access (ACCOUNTS, DL 380e54 GO #85 5947426886; lease 5947474393).
--
-- WHAT IT ADDS. An owner shares a decision with a colleague's email. A signed-in user whose CONFIRMED email matches
-- sees it under "Shared with me" and can open it READ-ONLY. CEE serves the model and latest Run to a member through
-- the graph-read route only (`is_scenario_member`, service_role). Every write door stays owner-only.
--
-- WHAT IT DELIBERATELY DOES NOT DO.
--   * No RLS change on `scenarios`: a member cannot read or write the row through Supabase. The canvas renders
--     from CEE's graph read.
--   * No row deletes: revoking sets `revoked_at`.
--   * No account oracle: `share_scenario` answers the same whether or not the email has an account, and members
--     are keyed by email, so a share made before someone has an account starts working when they get one.
--
-- MEMBERSHIP RESOLVES BY EMAIL AT READ TIME, against `auth.users` with `email_confirmed_at` set. Consequence,
-- written down rather than discovered: if a member changes their sign-in email, the share follows the address it
-- was sent to, not the person. The owner can share again with the new address.
--
-- DDL: one new table (RLS on, no policies, no grants to anon/authenticated) and six new functions. Nothing
-- existing is altered.

CREATE TABLE public.scenario_members (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id uuid NOT NULL REFERENCES public.scenarios(id) ON DELETE CASCADE,
  email       text NOT NULL CHECK (email = lower(btrim(email)) AND email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  role        text NOT NULL DEFAULT 'viewer' CHECK (role = 'viewer'),
  invited_by  uuid NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  revoked_at  timestamptz
);
CREATE UNIQUE INDEX scenario_members_active_uniq ON public.scenario_members (scenario_id, email) WHERE revoked_at IS NULL;
CREATE INDEX scenario_members_email_active ON public.scenario_members (email) WHERE revoked_at IS NULL;
ALTER TABLE public.scenario_members ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.scenario_members FROM PUBLIC, anon, authenticated;

-- The caller's confirmed email, or NULL. One definition, used by every function below.
CREATE OR REPLACE FUNCTION public._scenario_member_email(p_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT lower(btrim(u.email)) FROM auth.users u WHERE u.id = p_user_id AND u.email_confirmed_at IS NOT NULL
$function$;

-- Owner shares with an email. Idempotent. The answer never reveals whether the email has an account.
CREATE OR REPLACE FUNCTION public.share_scenario(p_scenario_id uuid, p_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_caller uuid := auth.uid();
  v_email  text := lower(btrim(coalesce(p_email, '')));
  v_active integer;
BEGIN
  IF v_caller IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.scenarios s WHERE s.id = p_scenario_id AND s.user_id = v_caller
  ) THEN
    RAISE EXCEPTION 'share_scenario: scenario not found or not owned by caller' USING ERRCODE = 'SM403';
  END IF;
  IF v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
    RAISE EXCEPTION 'share_scenario: not an email address' USING ERRCODE = 'SM400';
  END IF;
  IF v_email = public._scenario_member_email(v_caller) THEN
    RAISE EXCEPTION 'share_scenario: that is your own address' USING ERRCODE = 'SM400';
  END IF;
  -- Serialise shares of one decision, so the cap and the idempotent insert are race-safe.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('share_scenario:' || p_scenario_id::text, 0));
  IF EXISTS (SELECT 1 FROM public.scenario_members m WHERE m.scenario_id = p_scenario_id AND m.email = v_email AND m.revoked_at IS NULL) THEN
    RETURN pg_catalog.jsonb_build_object('shared', true);
  END IF;
  SELECT count(*) INTO v_active FROM public.scenario_members m WHERE m.scenario_id = p_scenario_id AND m.revoked_at IS NULL;
  IF v_active >= 25 THEN
    RAISE EXCEPTION 'share_scenario: this decision is shared with the maximum number of people' USING ERRCODE = 'SM429';
  END IF;
  INSERT INTO public.scenario_members (scenario_id, email, invited_by) VALUES (p_scenario_id, v_email, v_caller);
  RETURN pg_catalog.jsonb_build_object('shared', true);
END;
$function$;

-- Owner revokes. Sets revoked_at; nothing is deleted.
CREATE OR REPLACE FUNCTION public.unshare_scenario(p_scenario_id uuid, p_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_caller uuid := auth.uid();
  v_n      integer;
BEGIN
  IF v_caller IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.scenarios s WHERE s.id = p_scenario_id AND s.user_id = v_caller
  ) THEN
    RAISE EXCEPTION 'unshare_scenario: scenario not found or not owned by caller' USING ERRCODE = 'SM403';
  END IF;
  UPDATE public.scenario_members m SET revoked_at = now()
    WHERE m.scenario_id = p_scenario_id AND m.email = lower(btrim(coalesce(p_email, ''))) AND m.revoked_at IS NULL;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN pg_catalog.jsonb_build_object('revoked', v_n > 0);
END;
$function$;

-- Owner lists who a decision is shared with.
CREATE OR REPLACE FUNCTION public.list_scenario_members(p_scenario_id uuid)
RETURNS TABLE (email text, created_at timestamptz)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.scenarios s WHERE s.id = p_scenario_id AND s.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'list_scenario_members: scenario not found or not owned by caller' USING ERRCODE = 'SM403';
  END IF;
  RETURN QUERY
    SELECT m.email, m.created_at FROM public.scenario_members m
    WHERE m.scenario_id = p_scenario_id AND m.revoked_at IS NULL
    ORDER BY m.created_at, m.email;
END;
$function$;

-- "Shared with me": decisions shared with the caller's confirmed email, never the caller's own.
CREATE OR REPLACE FUNCTION public.list_shared_scenarios()
RETURNS TABLE (scenario_id uuid, title text, updated_at timestamptz, shared_at timestamptz, owner_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT s.id, s.title, s.updated_at, m.created_at, nullif(btrim(p.display_name), '')
  FROM public.scenario_members m
  JOIN public.scenarios s ON s.id = m.scenario_id
  LEFT JOIN public.user_profiles p ON p.id = s.user_id
  WHERE m.revoked_at IS NULL
    AND m.email = public._scenario_member_email(auth.uid())
    AND s.user_id IS DISTINCT FROM auth.uid()
    AND s.user_id IS NOT NULL
  ORDER BY s.updated_at DESC, s.id
$function$;

-- What the caller may do with a decision: 'owner' | 'viewer' | 'none'. The UI's read-only switch.
CREATE OR REPLACE FUNCTION public.scenario_access(p_scenario_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN 'none'
    WHEN EXISTS (SELECT 1 FROM public.scenarios s WHERE s.id = p_scenario_id AND s.user_id = auth.uid()) THEN 'owner'
    WHEN EXISTS (
      SELECT 1 FROM public.scenario_members m JOIN public.scenarios s ON s.id = m.scenario_id
      WHERE m.scenario_id = p_scenario_id AND m.revoked_at IS NULL AND s.user_id IS NOT NULL
        AND m.email = public._scenario_member_email(auth.uid())
    ) THEN 'viewer'
    ELSE 'none'
  END
$function$;

-- CEE's READ grant for the graph-read route ONLY (service_role; the user id is CEE's verified JWT sub).
CREATE OR REPLACE FUNCTION public.is_scenario_member(p_scenario_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.scenario_members m JOIN public.scenarios s ON s.id = m.scenario_id
    WHERE m.scenario_id = p_scenario_id AND m.revoked_at IS NULL AND s.user_id IS NOT NULL
      AND p_user_id IS NOT NULL AND m.email = public._scenario_member_email(p_user_id)
  )
$function$;

REVOKE ALL ON FUNCTION public._scenario_member_email(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.share_scenario(uuid, text) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.unshare_scenario(uuid, text) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.list_scenario_members(uuid) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.list_shared_scenarios() FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.scenario_access(uuid) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.is_scenario_member(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.share_scenario(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unshare_scenario(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_scenario_members(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_shared_scenarios() TO authenticated;
GRANT EXECUTE ON FUNCTION public.scenario_access(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_scenario_member(uuid, uuid) TO service_role;
