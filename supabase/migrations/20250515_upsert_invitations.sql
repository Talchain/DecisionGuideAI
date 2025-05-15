-- 20250515_upsert_invitations.sql
-- Upsert into invitations instead of erroring on duplicate email
BEGIN;

-- 1) Drop old function if exists
DROP FUNCTION IF EXISTS public.manage_team_invite(uuid, text, uuid, text);

-- 2) Recreate with upsert logic
CREATE OR REPLACE FUNCTION public.manage_team_invite(
  p_team_id    uuid,
  p_email      text,
  p_inviter_id uuid,
  p_role       text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.invitations (team_id, email, invited_by, role, status)
  VALUES (p_team_id, p_email, p_inviter_id, p_role, 'pending')
  ON CONFLICT (email) DO
    UPDATE SET
      team_id    = EXCLUDED.team_id,
      invited_by = EXCLUDED.invited_by,
      role       = EXCLUDED.role,
      status     = 'pending',
      invited_at = now();
END;
$$;

COMMIT;