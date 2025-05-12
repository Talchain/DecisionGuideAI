/*
  # MVP Teams with Simplified RLS
  
  1. Changes
    - Enable RLS on teams table
    - Drop any existing policies
    - Create new policies for CRUD operations
    - Restrict all operations to team creators only
    
  2. Security
    - All operations require authentication
    - Users can only access teams they created
    - No team member access yet (MVP)
*/

-- Enable RLS on teams
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies
DROP POLICY IF EXISTS "Select own teams" ON public.teams;
DROP POLICY IF EXISTS "Insert own teams" ON public.teams;
DROP POLICY IF EXISTS "Update own teams" ON public.teams;
DROP POLICY IF EXISTS "Delete own teams" ON public.teams;

-- Only creators may read their own teams
CREATE POLICY "Select own teams"
  ON public.teams
  FOR SELECT
  USING (created_by = auth.uid());

-- Only creators may insert
CREATE POLICY "Insert own teams"
  ON public.teams
  FOR INSERT
  WITH CHECK (created_by = auth.uid());

-- Only creators may update
CREATE POLICY "Update own teams"
  ON public.teams
  FOR UPDATE
  USING (created_by = auth.uid());

-- Only creators may delete
CREATE POLICY "Delete own teams"
  ON public.teams
  FOR DELETE
  USING (created_by = auth.uid());