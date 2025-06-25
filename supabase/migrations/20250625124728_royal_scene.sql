/*
  # Fix get_user_organisations function
  
  1. Changes
    - Drop existing function first to avoid the "cannot change return type" error
    - Recreate the function with the correct return type
    - Add proper ordering by created_at
  
  2. Security
    - Maintain SECURITY DEFINER to ensure function runs with proper permissions
*/

-- First drop the existing function to avoid the error
DROP FUNCTION IF EXISTS get_user_organisations();

-- Recreate the function with the correct return type
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
  role text,
  is_owner boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Return organisations where user is owner
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
    'owner'::text as role,
    true as is_owner
  FROM organisations o
  WHERE o.owner_id = auth.uid()
  
  UNION ALL
  
  -- Return organisations where user is a member
  SELECT 
    o.id,
    o.name,
    o.slug,
    o.description,
    o.owner_id,
    o.settings,
    o.created_at,
    o.updated_at,
    om.role,
    false as is_owner
  FROM organisations o
  JOIN organisation_members om ON om.organisation_id = o.id
  WHERE om.user_id = auth.uid()
  
  ORDER BY created_at DESC;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_user_organisations() TO authenticated;