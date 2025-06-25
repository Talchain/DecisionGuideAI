/*
  # Fix ambiguous role column in get_organisation_members function

  1. Updates
    - Fix the get_organisation_members RPC function to resolve ambiguous "role" column reference
    - Explicitly qualify the role column with table aliases to avoid ambiguity

  2. Changes
    - Update the SELECT statement to use qualified column names
    - Ensure proper table aliasing for clarity
*/

-- Drop the existing function if it exists
DROP FUNCTION IF EXISTS get_organisation_members(uuid);

-- Recreate the function with proper column qualification
CREATE OR REPLACE FUNCTION get_organisation_members(org_id uuid)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  organisation_id uuid,
  role text,
  created_at timestamptz,
  email text,
  first_name text,
  last_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    om.id,
    om.user_id,
    om.organisation_id,
    om.role,  -- Explicitly reference organisation_members.role
    om.created_at,
    COALESCE(u.email, '') as email,
    COALESCE(up.first_name, '') as first_name,
    COALESCE(up.last_name, '') as last_name
  FROM organisation_members om
  LEFT JOIN auth.users u ON om.user_id = u.id
  LEFT JOIN user_profiles up ON om.user_id = up.id
  WHERE om.organisation_id = org_id
  ORDER BY om.created_at ASC;
END;
$$;