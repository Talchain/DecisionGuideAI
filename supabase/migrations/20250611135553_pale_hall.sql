/*
  # Fix RLS policies for criteria_sets table

  1. Security Updates
    - Drop existing restrictive INSERT policy
    - Create new INSERT policy that properly handles both personal and team criteria sets
    - Ensure users can create personal criteria sets and team admins can create team criteria sets
    - Update other policies to be more permissive for authenticated users

  2. Policy Changes
    - INSERT: Allow authenticated users to create personal criteria sets, and team admins to create team criteria sets
    - SELECT: Allow users to view their own criteria sets and team criteria sets they have access to
    - UPDATE/DELETE: Allow owners and team admins to modify criteria sets
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can create criteria sets" ON criteria_sets;
DROP POLICY IF EXISTS "Users can view own criteria sets" ON criteria_sets;
DROP POLICY IF EXISTS "Users can update own criteria sets" ON criteria_sets;
DROP POLICY IF EXISTS "Users can delete own criteria sets" ON criteria_sets;

-- Create new INSERT policy that handles both personal and team criteria sets
CREATE POLICY "Enable insert for authenticated users" ON criteria_sets
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Allow personal criteria sets (team_id is null and user owns it)
    (team_id IS NULL AND user_id = auth.uid())
    OR
    -- Allow team criteria sets if user is team admin
    (team_id IS NOT NULL AND user_id = auth.uid() AND EXISTS (
      SELECT 1 FROM team_members 
      WHERE team_id = criteria_sets.team_id 
      AND user_id = auth.uid() 
      AND role = 'admin'
    ))
  );

-- Create SELECT policy for viewing criteria sets
CREATE POLICY "Enable read for own and team criteria sets" ON criteria_sets
  FOR SELECT
  TO authenticated
  USING (
    -- Own criteria sets
    user_id = auth.uid()
    OR
    -- Team criteria sets where user is a member
    (team_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM team_members 
      WHERE team_id = criteria_sets.team_id 
      AND user_id = auth.uid()
    ))
  );

-- Create UPDATE policy
CREATE POLICY "Enable update for owners and team admins" ON criteria_sets
  FOR UPDATE
  TO authenticated
  USING (
    -- Own criteria sets
    user_id = auth.uid()
    OR
    -- Team criteria sets where user is admin
    (team_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM team_members 
      WHERE team_id = criteria_sets.team_id 
      AND user_id = auth.uid() 
      AND role = 'admin'
    ))
  )
  WITH CHECK (
    -- Same conditions for WITH CHECK
    user_id = auth.uid()
    OR
    (team_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM team_members 
      WHERE team_id = criteria_sets.team_id 
      AND user_id = auth.uid() 
      AND role = 'admin'
    ))
  );

-- Create DELETE policy
CREATE POLICY "Enable delete for owners and team admins" ON criteria_sets
  FOR DELETE
  TO authenticated
  USING (
    -- Own criteria sets
    user_id = auth.uid()
    OR
    -- Team criteria sets where user is admin
    (team_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM team_members 
      WHERE team_id = criteria_sets.team_id 
      AND user_id = auth.uid() 
      AND role = 'admin'
    ))
  );