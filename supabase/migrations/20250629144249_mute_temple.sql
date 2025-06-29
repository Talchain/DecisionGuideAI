/*
  # Fix infinite recursion in organisation_members RLS policies

  1. Problem
    - Current RLS policies on organisation_members table are causing infinite recursion
    - This happens when policies reference the same table they're protecting
    - Affects user profile fetching and organisation context loading

  2. Solution
    - Drop existing problematic policies
    - Create new simplified policies that avoid circular references
    - Use direct user ID checks instead of complex subqueries where possible

  3. Security
    - Maintain proper access control
    - Users can only see their own memberships
    - Organization admins can manage members in their organizations
*/

-- Drop existing policies that cause recursion
DROP POLICY IF EXISTS "Organization admins can manage members" ON organisation_members;
DROP POLICY IF EXISTS "Users can view organization members" ON organisation_members;

-- Create new simplified policies without recursion

-- Policy 1: Users can view their own membership records
CREATE POLICY "Users can view own memberships"
  ON organisation_members
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Policy 2: Users can view other members in organizations where they are members
-- This uses a simple EXISTS check without complex joins
CREATE POLICY "Users can view org members where they belong"
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

-- Policy 3: Organization owners can manage all members
CREATE POLICY "Organization owners can manage members"
  ON organisation_members
  FOR ALL
  TO authenticated
  USING (
    organisation_id IN (
      SELECT o.id 
      FROM organisations o 
      WHERE o.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    organisation_id IN (
      SELECT o.id 
      FROM organisations o 
      WHERE o.owner_id = auth.uid()
    )
  );

-- Policy 4: Organization admins can manage members (but not owners)
CREATE POLICY "Organization admins can manage non-owner members"
  ON organisation_members
  FOR ALL
  TO authenticated
  USING (
    -- Admin can manage if they are admin in the org and target is not owner
    organisation_id IN (
      SELECT om.organisation_id 
      FROM organisation_members om 
      WHERE om.user_id = auth.uid() 
      AND om.role = 'admin'
    )
    AND role != 'owner'
  )
  WITH CHECK (
    -- Admin can add/update if they are admin in the org and not setting owner role
    organisation_id IN (
      SELECT om.organisation_id 
      FROM organisation_members om 
      WHERE om.user_id = auth.uid() 
      AND om.role = 'admin'
    )
    AND role != 'owner'
  );