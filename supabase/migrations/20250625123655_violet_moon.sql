/*
  # Fix infinite recursion in organisation_members RLS policies

  1. Problem
    - Multiple SELECT policies on organisation_members table create circular dependencies
    - When inserting a new member, policies try to check membership which triggers recursion

  2. Solution
    - Remove conflicting policies that cause recursion
    - Simplify policies to avoid circular dependencies
    - Ensure organization owners can manage members without recursion
*/

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Members can view organization members" ON organisation_members;
DROP POLICY IF EXISTS "Users can view members of their organizations" ON organisation_members;
DROP POLICY IF EXISTS "Users can view their own membership" ON organisation_members;

-- Create simplified, non-recursive policies
CREATE POLICY "Users can view their own membership"
  ON organisation_members
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Organization owners can view all members"
  ON organisation_members
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organisations 
      WHERE organisations.id = organisation_members.organisation_id 
      AND organisations.owner_id = auth.uid()
    )
  );

-- Ensure the existing "Organization owners can manage members" policy is correct
-- This should already exist and be working for INSERT/UPDATE/DELETE operations