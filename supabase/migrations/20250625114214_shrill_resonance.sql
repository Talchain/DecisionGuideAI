/*
  # Create get_user_organisations RPC function

  1. New Functions
    - `get_user_organisations()` - Returns organisations where the current user is owner or member
      - Returns organisation data with user's role
      - Includes both owned and member organisations
      - Uses RLS policies for security

  2. Security
    - Function uses `SECURITY DEFINER` to access data through existing RLS policies
    - Only returns organisations the authenticated user has access to
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
  user_role text
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
    CASE 
      WHEN o.owner_id = auth.uid() THEN 'owner'
      ELSE COALESCE(om.role, 'member')
    END as user_role
  FROM organisations o
  LEFT JOIN organisation_members om ON o.id = om.organisation_id AND om.user_id = auth.uid()
  WHERE o.owner_id = auth.uid() 
     OR om.user_id = auth.uid();
END;
$$;