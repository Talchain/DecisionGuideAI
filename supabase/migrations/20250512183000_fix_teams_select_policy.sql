-- 20250512183000_fix_teams_select_policy.sql

-- ensure RLS is on
ALTER TABLE public.teams
  ENABLE ROW LEVEL SECURITY;

-- drop any old/select policies that reference team_members
DROP POLICY IF EXISTS "Allow read all teams" ON public.teams;
DROP POLICY IF EXISTS "Select own teams"     ON public.teams;
DROP POLICY IF EXISTS "Users can view teams they are members of" ON public.teams;

-- only allow users to see the teams _they_ created
CREATE POLICY "Select own teams"
  ON public.teams
  FOR SELECT
  USING (created_by = auth.uid());

-- you can still keep INSERT/UPDATE/DELETE policies as before, e.g.:
-- INSERT only if created_by = auth.uid()
DROP POLICY IF EXISTS "Allow insert own teams" ON public.teams;
CREATE POLICY "Allow insert own teams"
  ON public.teams
  FOR INSERT
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "Allow update own teams" ON public.teams;
CREATE POLICY "Allow update own teams"
  ON public.teams
  FOR UPDATE
  USING (created_by = auth.uid());

DROP POLICY IF EXISTS "Allow delete own teams" ON public.teams;
CREATE POLICY "Allow delete own teams"
  ON public.teams
  FOR DELETE
  USING (created_by = auth.uid());