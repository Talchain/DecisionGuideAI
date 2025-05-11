/*
  # Fix Infinite Recursion in Collaborators Policies
  
  1. Changes
    - Drop existing policies with recursion issues
    - Create new simplified policies
    - Add helper function for safe collaborator access 

  2. Security
    - Enable RLS
    - Maintain proper ownership checks
    - Use SECURITY DEFINER function for critical operations
*/

-- Drop all existing policies on decision_collaborators to start clean
DO $$ 
BEGIN
  EXECUTE (
    SELECT string_agg(
      format('DROP POLICY IF EXISTS %I ON public.decision_collaborators', policyname),
      '; '
    )
    FROM pg_policies 
    WHERE tablename = 'decision_collaborators' 
    AND schemaname = 'public'
  );
END $$;

-- Create function to check if user has permission to access collaborator data
CREATE OR REPLACE FUNCTION public.can_access_decision(decision_id_param uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    -- Check if user owns the decision
    SELECT 1 FROM decisions
    WHERE id = decision_id_param
    AND user_id = auth.uid()
  );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.can_access_decision TO authenticated;

-- Create simplified policies with proper guards against recursion
CREATE POLICY "Select collaborators for owners"
  ON public.decision_collaborators
  FOR SELECT
  TO authenticated
  USING (can_access_decision(decision_id));

CREATE POLICY "Select collaborators as participant" 
  ON public.decision_collaborators
  FOR SELECT 
  TO authenticated
  USING (
    user_id = auth.uid() AND 
    status = 'active'
  );

-- Add insert policy for owners
CREATE POLICY "Insert collaborators for owners"
  ON public.decision_collaborators
  FOR INSERT
  TO authenticated
  WITH CHECK (can_access_decision(decision_id));

-- Add update policy for owners
CREATE POLICY "Update collaborators for owners"
  ON public.decision_collaborators
  FOR UPDATE
  TO authenticated
  USING (can_access_decision(decision_id))
  WITH CHECK (can_access_decision(decision_id));

-- Add delete policy for owners
CREATE POLICY "Delete collaborators for owners"
  ON public.decision_collaborators
  FOR DELETE
  TO authenticated
  USING (can_access_decision(decision_id));

-- Add policy for collaborators to update themselves (e.g., accept invitation)
CREATE POLICY "Collaborators can update own record"
  ON public.decision_collaborators
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Ensure RLS is enabled
ALTER TABLE public.decision_collaborators ENABLE ROW LEVEL SECURITY;

-- Add comment explaining policy pattern
COMMENT ON TABLE public.decision_collaborators IS 
'Stores participant access and roles for collaborative decisions.
Uses non-recursive policies to prevent infinite recursion issues.';