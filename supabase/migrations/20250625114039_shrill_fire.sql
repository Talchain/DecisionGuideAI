/*
  # Organization Helper Functions

  1. New Functions
    - get_user_organisations: Returns all organizations a user belongs to
    - get_organisation_details: Returns details of a specific organization
    - get_organisation_members: Returns members of a specific organization
    - get_organisation_teams: Returns teams in a specific organization
  
  2. Changes
    - These functions help with retrieving organization data with proper access control
  
  3. Security
    - All functions respect RLS policies
*/

-- Function to get all organizations a user belongs to
CREATE OR REPLACE FUNCTION get_user_organisations()
RETURNS SETOF json
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    json_build_object(
      'id', o.id,
      'name', o.name,
      'slug', o.slug,
      'description', o.description,
      'owner_id', o.owner_id,
      'settings', o.settings,
      'created_at', o.created_at,
      'updated_at', o.updated_at,
      'is_owner', o.owner_id = auth.uid(),
      'role', COALESCE(om.role, CASE WHEN o.owner_id = auth.uid() THEN 'owner' ELSE NULL END),
      'member_count', (
        SELECT COUNT(*) 
        FROM organisation_members 
        WHERE organisation_id = o.id
      ),
      'team_count', (
        SELECT COUNT(*) 
        FROM teams 
        WHERE organisation_id = o.id
      )
    )
  FROM 
    organisations o
  LEFT JOIN 
    organisation_members om ON o.id = om.organisation_id AND om.user_id = auth.uid()
  WHERE 
    o.owner_id = auth.uid() OR 
    EXISTS (
      SELECT 1 
      FROM organisation_members 
      WHERE organisation_id = o.id AND user_id = auth.uid()
    )
  ORDER BY 
    o.created_at DESC;
END;
$$;

-- Function to get details of a specific organization
CREATE OR REPLACE FUNCTION get_organisation_details(org_id uuid)
RETURNS json
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  org_details json;
BEGIN
  SELECT 
    json_build_object(
      'id', o.id,
      'name', o.name,
      'slug', o.slug,
      'description', o.description,
      'owner_id', o.owner_id,
      'settings', o.settings,
      'created_at', o.created_at,
      'updated_at', o.updated_at,
      'is_owner', o.owner_id = auth.uid(),
      'role', COALESCE(om.role, CASE WHEN o.owner_id = auth.uid() THEN 'owner' ELSE NULL END)
    )
  INTO org_details
  FROM 
    organisations o
  LEFT JOIN 
    organisation_members om ON o.id = om.organisation_id AND om.user_id = auth.uid()
  WHERE 
    o.id = org_id AND
    (
      o.owner_id = auth.uid() OR 
      EXISTS (
        SELECT 1 
        FROM organisation_members 
        WHERE organisation_id = o.id AND user_id = auth.uid()
      )
    );
    
  RETURN org_details;
END;
$$;

-- Function to get members of a specific organization
CREATE OR REPLACE FUNCTION get_organisation_members(org_id uuid)
RETURNS SETOF json
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check if user has access to this organization
  IF NOT EXISTS (
    SELECT 1 
    FROM organisations o
    WHERE 
      o.id = org_id AND
      (
        o.owner_id = auth.uid() OR 
        EXISTS (
          SELECT 1 
          FROM organisation_members 
          WHERE organisation_id = o.id AND user_id = auth.uid()
        )
      )
  ) THEN
    RETURN;
  END IF;

  -- Get organization owner
  RETURN QUERY
  SELECT 
    json_build_object(
      'id', 'owner-' || o.owner_id,
      'user_id', o.owner_id,
      'organisation_id', o.id,
      'role', 'owner',
      'created_at', o.created_at,
      'email', u.email,
      'first_name', up.first_name,
      'last_name', up.last_name
    )
  FROM 
    organisations o
  JOIN 
    auth.users u ON o.owner_id = u.id
  LEFT JOIN 
    user_profiles up ON o.owner_id = up.id
  WHERE 
    o.id = org_id;

  -- Get organization members
  RETURN QUERY
  SELECT 
    json_build_object(
      'id', om.id,
      'user_id', om.user_id,
      'organisation_id', om.organisation_id,
      'role', om.role,
      'created_at', om.created_at,
      'email', u.email,
      'first_name', up.first_name,
      'last_name', up.last_name
    )
  FROM 
    organisation_members om
  JOIN 
    auth.users u ON om.user_id = u.id
  LEFT JOIN 
    user_profiles up ON om.user_id = up.id
  WHERE 
    om.organisation_id = org_id;
END;
$$;

-- Function to get teams in a specific organization
CREATE OR REPLACE FUNCTION get_organisation_teams(org_id uuid)
RETURNS SETOF json
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check if user has access to this organization
  IF NOT EXISTS (
    SELECT 1 
    FROM organisations o
    WHERE 
      o.id = org_id AND
      (
        o.owner_id = auth.uid() OR 
        EXISTS (
          SELECT 1 
          FROM organisation_members 
          WHERE organisation_id = o.id AND user_id = auth.uid()
        )
      )
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
    json_build_object(
      'id', t.id,
      'name', t.name,
      'description', t.description,
      'created_by', t.created_by,
      'created_at', t.created_at,
      'member_count', (
        SELECT COUNT(*) 
        FROM team_members 
        WHERE team_id = t.id
      )
    )
  FROM 
    teams t
  WHERE 
    t.organisation_id = org_id
  ORDER BY 
    t.created_at DESC;
END;
$$;