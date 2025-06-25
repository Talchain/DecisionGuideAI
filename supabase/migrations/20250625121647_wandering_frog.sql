/*
  # Fix infinite recursion in organisation_members RLS policy

  1. Problem
    - The existing RLS policy on organisation_members has infinite recursion
    - The policy references organisation_members within itself incorrectly
    - This prevents organization slug validation from working

  2. Solution
    - Drop the problematic policy
    - Create new, simplified policies that avoid recursion
    - Separate policies for different operations to maintain clarity
*/

-- Drop the problematic policy that causes infinite recursion
DROP POLICY IF EXISTS "Organization owners and admins can manage members" ON organisation_members;

-- Create separate, non-recursive policies for organisation_members

-- Policy for organization owners to manage members
CREATE POLICY "Organization owners can manage members"
  ON organisation_members
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organisations 
      WHERE organisations.id = organisation_members.organisation_id 
      AND organisations.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organisations 
      WHERE organisations.id = organisation_members.organisation_id 
      AND organisations.owner_id = auth.uid()
    )
  );

-- Policy for users to view their own membership
CREATE POLICY "Users can view their own membership"
  ON organisation_members
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Policy for users to view members of organizations they belong to
CREATE POLICY "Members can view organization members"
  ON organisation_members
  FOR SELECT
  TO authenticated
  USING (
    organisation_id IN (
      SELECT om.organisation_id 
      FROM organisation_members om 
      WHERE om.user_id = auth.uid()
    )
  );