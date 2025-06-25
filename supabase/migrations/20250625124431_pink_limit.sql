/*
  # Fix get_user_organisations function

  1. Changes
    - Drop existing function first to avoid return type conflict
    - Recreate function with updated return type and implementation
    - Grant execute permission to authenticated users
*/

-- First drop the existing function to avoid the return type conflict
DROP FUNCTION IF EXISTS get_user_organisations();

-- Create the function with the new return type
CREATE FUNCTION get_user_organisations()
RETURNS TABLE (
  id uuid,
  name text,
  slug text,
  description text,
  owner_id uuid,
  settings jsonb,
  created_at timestamptz,
  updated_at timestamptz,
  user_role text
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Return organisations where user is owner or member
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
    CASE 
      WHEN o.owner_id = auth.uid() THEN 'owner'
      ELSE COALESCE(om.role, 'member')
    END as user_role
  FROM organisations o
  LEFT JOIN organisation_members om ON o.id = om.organisation_id AND om.user_id = auth.uid()
  WHERE o.owner_id = auth.uid() 
     OR om.user_id = auth.uid()
  ORDER BY o.created_at DESC;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_user_organisations() TO authenticated;