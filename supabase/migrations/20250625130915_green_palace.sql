/*
  # Fix organisation RPC functions type mismatch

  1. Functions Updated
    - `get_organisation_details` - Fix return type consistency
    - `get_organisation_members` - Fix column 6 type mismatch (character varying -> text)
    - `get_organisation_teams` - Ensure consistent return types

  2. Changes Made
    - Updated all varchar/character varying columns to text type
    - Ensured consistent type definitions across all organisation functions
    - Fixed the specific column 6 issue in get_organisation_members

  3. Security
    - Maintains existing RLS policies and permissions
    - No changes to access control
*/

-- Drop existing functions to recreate with correct types
DROP FUNCTION IF EXISTS get_organisation_details(uuid);
DROP FUNCTION IF EXISTS get_organisation_members(uuid);
DROP FUNCTION IF EXISTS get_organisation_teams(uuid);

-- Create get_organisation_details function with consistent types
CREATE OR REPLACE FUNCTION get_organisation_details(org_id uuid)
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
  role text
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
    CASE 
      WHEN o.owner_id = auth.uid() THEN 'owner'::text
      ELSE COALESCE(om.role, 'member'::text)
    END as role
  FROM organisations o
  LEFT JOIN organisation_members om ON om.organisation_id = o.id AND om.user_id = auth.uid()
  WHERE o.id = org_id
    AND (o.owner_id = auth.uid() OR om.user_id = auth.uid());
END;
$$;

-- Create get_organisation_members function with correct types
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
  -- Check if user has access to this organisation
  IF NOT EXISTS (
    SELECT 1 FROM organisations o
    LEFT JOIN organisation_members om ON om.organisation_id = o.id AND om.user_id = auth.uid()
    WHERE o.id = org_id
      AND (o.owner_id = auth.uid() OR om.user_id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'Access denied to organisation members';
  END IF;

  RETURN QUERY
  SELECT 
    om.id,
    om.user_id,
    om.organisation_id,
    om.role::text,
    om.created_at,
    COALESCE(au.email, '')::text as email,
    COALESCE(up.first_name, '')::text as first_name,
    COALESCE(up.last_name, '')::text as last_name
  FROM organisation_members om
  LEFT JOIN auth.users au ON au.id = om.user_id
  LEFT JOIN user_profiles up ON up.id = om.user_id
  WHERE om.organisation_id = org_id
  
  UNION ALL
  
  -- Include the owner
  SELECT 
    gen_random_uuid() as id,
    o.owner_id as user_id,
    o.id as organisation_id,
    'owner'::text as role,
    o.created_at,
    COALESCE(au.email, '')::text as email,
    COALESCE(up.first_name, '')::text as first_name,
    COALESCE(up.last_name, '')::text as last_name
  FROM organisations o
  LEFT JOIN auth.users au ON au.id = o.owner_id
  LEFT JOIN user_profiles up ON up.id = o.owner_id
  WHERE o.id = org_id
    AND NOT EXISTS (
      SELECT 1 FROM organisation_members om2 
      WHERE om2.organisation_id = org_id AND om2.user_id = o.owner_id
    );
END;
$$;

-- Create get_organisation_teams function with consistent types
CREATE OR REPLACE FUNCTION get_organisation_teams(org_id uuid)
RETURNS TABLE (
  id uuid,
  name text,
  description text,
  created_by uuid,
  created_at timestamptz,
  member_count bigint
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if user has access to this organisation
  IF NOT EXISTS (
    SELECT 1 FROM organisations o
    LEFT JOIN organisation_members om ON om.organisation_id = o.id AND om.user_id = auth.uid()
    WHERE o.id = org_id
      AND (o.owner_id = auth.uid() OR om.user_id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'Access denied to organisation teams';
  END IF;

  RETURN QUERY
  SELECT 
    t.id,
    t.name,
    t.description,
    t.created_by,
    t.created_at,
    COALESCE(COUNT(tm.id), 0) as member_count
  FROM teams t
  LEFT JOIN team_members tm ON tm.team_id = t.id
  WHERE t.organisation_id = org_id
  GROUP BY t.id, t.name, t.description, t.created_by, t.created_at
  ORDER BY t.created_at DESC;
END;
$$;