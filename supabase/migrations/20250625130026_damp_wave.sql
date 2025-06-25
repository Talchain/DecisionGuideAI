/*
  # Fix Organization RPC Functions
  
  1. Changes
     - Drop existing functions before recreating them
     - Recreate all organization-related RPC functions with proper return types
     - Grant execute permissions to authenticated users
  
  2. Functions
     - get_organisation_details: Get details for a specific organization
     - get_organisation_members: Get members of an organization
     - get_organisation_teams: Get teams belonging to an organization
     - check_organisation_slug_exists: Check if a slug is already in use
     - track_invitation_status: Log invitation status changes
*/

-- Drop existing functions first to avoid return type errors
DROP FUNCTION IF EXISTS get_organisation_details(uuid);
DROP FUNCTION IF EXISTS get_organisation_members(uuid);
DROP FUNCTION IF EXISTS get_organisation_teams(uuid);
DROP FUNCTION IF EXISTS check_organisation_slug_exists(text);
DROP FUNCTION IF EXISTS track_invitation_status(uuid, text, jsonb);

-- Function to get details of a specific organization
CREATE OR REPLACE FUNCTION get_organisation_details(org_id UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  slug TEXT,
  description TEXT,
  owner_id UUID,
  settings JSONB,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  is_owner BOOLEAN,
  role TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Return organization details with role information
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
    o.owner_id = auth.uid() AS is_owner,
    CASE 
      WHEN o.owner_id = auth.uid() THEN 'owner'::TEXT
      ELSE COALESCE(om.role, 'member'::TEXT)
    END AS role
  FROM organisations o
  LEFT JOIN organisation_members om ON o.id = om.organisation_id AND om.user_id = auth.uid()
  WHERE o.id = org_id
    AND (o.owner_id = auth.uid() OR om.user_id = auth.uid());
    
  -- If no rows returned, the user doesn't have access or the org doesn't exist
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Organization not found or you do not have access';
  END IF;
END;
$$;

-- Function to get members of a specific organization
CREATE OR REPLACE FUNCTION get_organisation_members(org_id UUID)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  organisation_id UUID,
  role TEXT,
  created_at TIMESTAMPTZ,
  email TEXT,
  first_name TEXT,
  last_name TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if user has access to this organization
  IF NOT EXISTS (
    SELECT 1 FROM organisations o
    LEFT JOIN organisation_members om ON o.id = om.organisation_id AND om.user_id = auth.uid()
    WHERE o.id = org_id AND (o.owner_id = auth.uid() OR om.user_id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'Organization not found or you do not have access';
  END IF;

  -- Return owner as a special case
  RETURN QUERY
  SELECT 
    gen_random_uuid() AS id,
    o.owner_id AS user_id,
    o.id AS organisation_id,
    'owner'::TEXT AS role,
    o.created_at,
    u.email,
    p.first_name,
    p.last_name
  FROM organisations o
  JOIN auth.users u ON u.id = o.owner_id
  LEFT JOIN user_profiles p ON p.id = o.owner_id
  WHERE o.id = org_id
  
  UNION ALL
  
  -- Return regular members
  SELECT 
    om.id,
    om.user_id,
    om.organisation_id,
    om.role,
    om.created_at,
    u.email,
    p.first_name,
    p.last_name
  FROM organisation_members om
  JOIN auth.users u ON u.id = om.user_id
  LEFT JOIN user_profiles p ON p.id = om.user_id
  WHERE om.organisation_id = org_id
  
  ORDER BY role = 'owner' DESC, created_at ASC;
END;
$$;

-- Function to get teams belonging to an organization
CREATE OR REPLACE FUNCTION get_organisation_teams(org_id UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ,
  member_count BIGINT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if user has access to this organization
  IF NOT EXISTS (
    SELECT 1 FROM organisations o
    LEFT JOIN organisation_members om ON o.id = om.organisation_id AND om.user_id = auth.uid()
    WHERE o.id = org_id AND (o.owner_id = auth.uid() OR om.user_id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'Organization not found or you do not have access';
  END IF;

  -- Return teams with member count
  RETURN QUERY
  SELECT 
    t.id,
    t.name,
    t.description,
    t.created_by,
    t.created_at,
    COUNT(tm.id) AS member_count
  FROM teams t
  LEFT JOIN team_members tm ON t.id = tm.team_id
  WHERE t.organisation_id = org_id
  GROUP BY t.id
  ORDER BY t.created_at DESC;
END;
$$;

-- Function to check if an organization slug already exists
CREATE OR REPLACE FUNCTION check_organisation_slug_exists(p_slug TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM organisations WHERE slug = p_slug
  );
END;
$$;

-- Function to track invitation status
CREATE OR REPLACE FUNCTION track_invitation_status(
  invitation_uuid UUID,
  status_value TEXT,
  details_json JSONB DEFAULT '{}'::JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO invitation_logs (
    invitation_id,
    status,
    details,
    created_at
  ) VALUES (
    invitation_uuid,
    status_value,
    details_json,
    now()
  );
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_organisation_details TO authenticated;
GRANT EXECUTE ON FUNCTION get_organisation_members TO authenticated;
GRANT EXECUTE ON FUNCTION get_organisation_teams TO authenticated;
GRANT EXECUTE ON FUNCTION check_organisation_slug_exists TO authenticated;
GRANT EXECUTE ON FUNCTION track_invitation_status TO authenticated;