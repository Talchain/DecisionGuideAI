/*
  # Fix infinite recursion in organisations RLS policies
  
  1. Changes
    - Drop existing policies that cause recursion
    - Create simplified policies without circular dependencies
    - Add a security definer function for safe member access
  
  2. Security
    - Maintains proper access control while avoiding policy recursion
    - Uses SECURITY DEFINER function to safely handle member access
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

-- First drop the existing function if it exists
DROP FUNCTION IF EXISTS get_user_organisations();

-- Create a separate function for member access that doesn't cause recursion
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