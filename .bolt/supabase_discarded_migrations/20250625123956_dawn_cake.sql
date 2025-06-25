/*
  # Fix infinite recursion in organisations RLS policies

  1. Problem
    - The SELECT policy on organisations table references organisation_members
    - This creates circular dependency causing infinite recursion

  2. Solution
    - Simplify the SELECT policy to avoid circular references
    - Use direct ownership check for basic access
    - Create separate policies for member access if needed

  3. Changes
    - Drop existing problematic policies
    - Create new simplified policies
    - Ensure no circular dependencies
*/

-- Drop existing policies that cause recursion
DROP POLICY IF EXISTS "Users can view their organizations" ON organisations;
DROP POLICY IF EXISTS "Users can create organizations" ON organisations;
DROP POLICY IF EXISTS "Owners can update their organizations" ON organisations;
DROP POLICY IF EXISTS "Owners can delete their organizations" ON organisations;

-- Create new simplified policies without circular dependencies

-- SELECT: Users can view organizations they own
CREATE POLICY "Users can view owned organizations"
  ON organisations
  FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid());

-- INSERT: Users can create organizations (they become the owner)
CREATE POLICY "Users can create organizations"
  ON organisations
  FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

-- UPDATE: Only owners can update their organizations
CREATE POLICY "Owners can update organizations"
  ON organisations
  FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- DELETE: Only owners can delete their organizations
CREATE POLICY "Owners can delete organizations"
  ON organisations
  FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());

-- Create a separate policy for member access that doesn't cause recursion
-- This will be handled through a function that doesn't trigger policy recursion
CREATE OR REPLACE FUNCTION get_user_organisations()
RETURNS TABLE (
  id uuid,
  name text,
  slug text,
  description text,
  owner_id uuid,
  settings jsonb,
  created_at timestamptz,
  updated_at timestamptz,
  is_owner boolean,
  is_member boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    o.id,
    o.name,
    o.slug,
    o.description,
    o.owner_id,
    o.settings,
    o.created_at,
    o.updated_at,
    (o.owner_id = auth.uid()) as is_owner,
    (EXISTS (
      SELECT 1 FROM organisation_members om 
      WHERE om.organisation_id = o.id 
      AND om.user_id = auth.uid()
    )) as is_member
  FROM organisations o
  WHERE o.owner_id = auth.uid()
     OR EXISTS (
       SELECT 1 FROM organisation_members om 
       WHERE om.organisation_id = o.id 
       AND om.user_id = auth.uid()
     );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_user_organisations() TO authenticated;