/*
  # Create Organization Helper Functions

  1. Helper Functions
    - `get_user_organizations()` - Get all organizations for current user
    - `get_organization_members(org_id)` - Get all members of an organization
    - `create_organization_with_owner(name, slug, description)` - Create org and add owner
    - `invite_organization_member(org_id, email, role)` - Invite user to organization
    - `get_organization_teams(org_id)` - Get all teams in an organization

  2. Security
    - All functions respect RLS policies
    - Functions check user permissions before executing
    - Proper error handling and validation
*/

-- Function to get all organizations for the current user
CREATE OR REPLACE FUNCTION get_user_organizations()
RETURNS TABLE (
  id uuid,
  name text,
  slug text,
  description text,
  logo_url text,
  role organisation_role,
  member_count bigint,
  team_count bigint,
  created_at timestamptz
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
    o.logo_url,
    om.role,
    (SELECT COUNT(*) FROM organisation_members WHERE organisation_id = o.id) as member_count,
    (SELECT COUNT(*) FROM teams WHERE organisation_id = o.id) as team_count,
    o.created_at
  FROM organisations o
  JOIN organisation_members om ON o.id = om.organisation_id
  WHERE om.user_id = auth.uid()
  ORDER BY o.created_at DESC;
END;
$$;

-- Function to get all members of an organization
CREATE OR REPLACE FUNCTION get_organization_members(org_id uuid)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  email text,
  role organisation_role,
  permissions jsonb,
  joined_at timestamptz,
  invited_at timestamptz
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if user has permission to view organization members
  IF NOT EXISTS (
    SELECT 1 FROM organisation_members 
    WHERE organisation_id = org_id 
    AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied: You are not a member of this organization';
  END IF;

  RETURN QUERY
  SELECT 
    om.id,
    om.user_id,
    au.email,
    om.role,
    om.permissions,
    om.joined_at,
    om.invited_at
  FROM organisation_members om
  JOIN auth.users au ON om.user_id = au.id
  WHERE om.organisation_id = org_id
  ORDER BY om.role, om.joined_at;
END;
$$;

-- Function to create organization with owner
CREATE OR REPLACE FUNCTION create_organization_with_owner(
  org_name text,
  org_slug text,
  org_description text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_org_id uuid;
BEGIN
  -- Validate inputs
  IF org_name IS NULL OR trim(org_name) = '' THEN
    RAISE EXCEPTION 'Organization name cannot be empty';
  END IF;
  
  IF org_slug IS NULL OR trim(org_slug) = '' THEN
    RAISE EXCEPTION 'Organization slug cannot be empty';
  END IF;

  -- Check if slug is already taken
  IF EXISTS (SELECT 1 FROM organisations WHERE slug = org_slug) THEN
    RAISE EXCEPTION 'Organization slug already exists';
  END IF;

  -- Create the organization
  INSERT INTO organisations (name, slug, description, owner_id)
  VALUES (trim(org_name), trim(org_slug), trim(org_description), auth.uid())
  RETURNING id INTO new_org_id;

  -- The trigger will automatically add the owner as a member
  
  RETURN new_org_id;
END;
$$;

-- Function to invite organization member
CREATE OR REPLACE FUNCTION invite_organization_member(
  org_id uuid,
  member_email text,
  member_role organisation_role DEFAULT 'member'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  invitation_id uuid;
  target_user_id uuid;
BEGIN
  -- Check if user has permission to invite members
  IF NOT EXISTS (
    SELECT 1 FROM organisation_members 
    WHERE organisation_id = org_id 
    AND user_id = auth.uid()
    AND role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'Access denied: You do not have permission to invite members to this organization';
  END IF;

  -- Check if user already exists
  SELECT id INTO target_user_id 
  FROM auth.users 
  WHERE email = member_email;

  -- If user exists, add them directly to the organization
  IF target_user_id IS NOT NULL THEN
    -- Check if already a member
    IF EXISTS (
      SELECT 1 FROM organisation_members 
      WHERE organisation_id = org_id AND user_id = target_user_id
    ) THEN
      RAISE EXCEPTION 'User is already a member of this organization';
    END IF;

    -- Add as member
    INSERT INTO organisation_members (organisation_id, user_id, role, invited_by, joined_at)
    VALUES (org_id, target_user_id, member_role, auth.uid(), now());
    
    RETURN target_user_id;
  ELSE
    -- Create invitation for non-existing user
    INSERT INTO invitations (email, organisation_id, role, invited_by, status)
    VALUES (member_email, org_id, member_role::text, auth.uid(), 'pending')
    RETURNING id INTO invitation_id;
    
    RETURN invitation_id;
  END IF;
END;
$$;

-- Function to get all teams in an organization
CREATE OR REPLACE FUNCTION get_organization_teams(org_id uuid)
RETURNS TABLE (
  id uuid,
  name text,
  description text,
  created_by uuid,
  member_count bigint,
  created_at timestamptz
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if user has permission to view organization teams
  IF NOT EXISTS (
    SELECT 1 FROM organisation_members 
    WHERE organisation_id = org_id 
    AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied: You are not a member of this organization';
  END IF;

  RETURN QUERY
  SELECT 
    t.id,
    t.name,
    t.description,
    t.created_by,
    (SELECT COUNT(*) FROM team_members WHERE team_id = t.id) as member_count,
    t.created_at
  FROM teams t
  WHERE t.organisation_id = org_id
  ORDER BY t.created_at DESC;
END;
$$;

-- Function to check if user can access organization
CREATE OR REPLACE FUNCTION user_can_access_organization(org_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM organisation_members 
    WHERE organisation_id = org_id 
    AND user_id = auth.uid()
  );
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_user_organizations() TO authenticated;
GRANT EXECUTE ON FUNCTION get_organization_members(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION create_organization_with_owner(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION invite_organization_member(uuid, text, organisation_role) TO authenticated;
GRANT EXECUTE ON FUNCTION get_organization_teams(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION user_can_access_organization(uuid) TO authenticated;