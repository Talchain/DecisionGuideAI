-- 20250515_fix_invitations_unique.sql
-- Drop the old single-column unique constraint...
ALTER TABLE public.invitations
  DROP CONSTRAINT IF EXISTS invitations_email_key;

-- And replace with a composite unique index on (team_id, email)
CREATE UNIQUE INDEX IF NOT EXISTS invitations_team_email_key
  ON public.invitations(team_id, lower(email));