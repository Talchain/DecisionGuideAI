/*
  # Create get_user_organisations RPC function

  1. New Functions
    - `get_user_organisations` - Returns organisations where the user is either owner or member
  
  2. Security
    - Function uses security definer to access organisation data
    - Returns only organisations the authenticated user has access to
*/

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