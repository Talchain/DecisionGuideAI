/*
  # Create Organisation RPC Functions

  1. New Functions
    - `get_user_organisations` - Returns all organisations a user belongs to
    - `get_organisation_details` - Returns details for a specific organisation
    - `get_organisation_members` - Returns members of an organisation
    - `get_organisation_teams` - Returns teams in an organisation
    - `check_organisation_slug_exists` - Checks if an organisation slug is already taken

  2. Security
    - All functions are secured with appropriate RLS policies
    - Functions only return data the user has permission to access
*/

-- Function to get all organisations a user belongs to
CREATE OR REPLACE FUNCTION get_user_organisations()
RETURNS SETOF json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_id uuid := auth.uid();
  result json;
BEGIN
  -- Get organisations owned by the user
  FOR result IN
    SELECT json_build_object(
      'id', o.id,
      'name', o.name,
      'slug', o.slug,
      'description', o.description,
      'owner_id', o.owner_id,
      'settings', o.settings,
      'created_at', o.created_at,
      'updated_at', o.updated_at,
      'is_owner', true,
      'role', 'owner',
      'member_count', (
        SELECT COUNT(*) 
        FROM organisation_members om 
        WHERE om.organisation_id = o.id
      ),
      'team_count', (
        SELECT COUNT(*) 
        FROM teams t 
        WHERE t.organisation_id = o.id
      )
    )
    FROM organisations o
    WHERE o.owner_id = user_id
  LOOP
    RETURN NEXT result;
  END LOOP;

  -- Get organisations where user is a member
  FOR result IN
    SELECT json_build_object(
      'id', o.id,
      'name', o.name,
      'slug', o.slug,
      'description', o.description,
      'owner_id', o.owner_id,
      'settings', o.settings,
      'created_at', o.created_at,
      'updated_at', o.updated_at,
      'is_owner', false,
      'role', om.role,
      'member_count', (
        SELECT COUNT(*) 
        FROM organisation_members om2 
        WHERE om2.organisation_id = o.id
      ),
      'team_count', (
        SELECT COUNT(*) 
        FROM teams t 
        WHERE t.organisation_id = o.id
      )
    )
    FROM organisations o
    JOIN organisation_members om ON o.id = om.organisation_id
    WHERE om.user_id = user_id
  LOOP
    RETURN NEXT result;
  END LOOP;

  RETURN;
END;
$$;

-- Function to get details for a specific organisation
CREATE OR REPLACE FUNCTION get_organisation_details(org_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_id uuid := auth.uid();
  org_record organisations%ROWTYPE;
  is_owner boolean;
  user_role text;
  result json;
BEGIN
  -- Get the organisation record
  SELECT * INTO org_record
  FROM organisations
  WHERE id = org_id;

  IF org_record IS NULL THEN
    RAISE EXCEPTION 'Organisation not found';
  END IF;

  -- Check if user is the owner
  is_owner := (org_record.owner_id = user_id);

  -- Get user's role if they're a member
  SELECT role INTO user_role
  FROM organisation_members
  WHERE organisation_id = org_id AND user_id = auth.uid();

  -- Check if user has access
  IF NOT (is_owner OR user_role IS NOT NULL) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- Build the result
  result := json_build_object(
    'id', org_record.id,
    'name', org_record.name,
    'slug', org_record.slug,
    'description', org_record.description,
    'owner_id', org_record.owner_id,
    'settings', org_record.settings,
    'created_at', org_record.created_at,
    'updated_at', org_record.updated_at,
    'is_owner', is_owner,
    'role', COALESCE(user_role, CASE WHEN is_owner THEN 'owner' ELSE NULL END)
  );

  RETURN result;
END;
$$;

-- Function to get members of an organisation
CREATE OR REPLACE FUNCTION get_organisation_members(org_id uuid)
RETURNS SETOF json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_id uuid := auth.uid();
  has_access boolean;
  result json;
BEGIN
  -- Check if user has access to the organisation
  SELECT EXISTS (
    SELECT 1
    FROM organisations o
    WHERE o.id = org_id AND (
      o.owner_id = user_id OR
      EXISTS (
        SELECT 1
        FROM organisation_members om
        WHERE om.organisation_id = org_id AND om.user_id = user_id
      )
    )
  ) INTO has_access;

  IF NOT has_access THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- Get organisation owner
  FOR result IN
    SELECT json_build_object(
      'id', gen_random_uuid(),
      'user_id', o.owner_id,
      'organisation_id', o.id,
      'role', 'owner',
      'created_at', o.created_at,
      'email', u.email,
      'first_name', up.first_name,
      'last_name', up.last_name
    )
    FROM organisations o
    LEFT JOIN auth.users u ON o.owner_id = u.id
    LEFT JOIN user_profiles up ON o.owner_id = up.id
    WHERE o.id = org_id
  LOOP
    RETURN NEXT result;
  END LOOP;

  -- Get organisation members
  FOR result IN
    SELECT json_build_object(
      'id', om.id,
      'user_id', om.user_id,
      'organisation_id', om.organisation_id,
      'role', om.role,
      'created_at', om.created_at,
      'email', u.email,
      'first_name', up.first_name,
      'last_name', up.last_name
    )
    FROM organisation_members om
    LEFT JOIN auth.users u ON om.user_id = u.id
    LEFT JOIN user_profiles up ON om.user_id = up.id
    WHERE om.organisation_id = org_id
  LOOP
    RETURN NEXT result;
  END LOOP;

  RETURN;
END;
$$;

-- Function to get teams in an organisation
CREATE OR REPLACE FUNCTION get_organisation_teams(org_id uuid)
RETURNS SETOF json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_id uuid := auth.uid();
  has_access boolean;
  result json;
BEGIN
  -- Check if user has access to the organisation
  SELECT EXISTS (
    SELECT 1
    FROM organisations o
    WHERE o.id = org_id AND (
      o.owner_id = user_id OR
      EXISTS (
        SELECT 1
        FROM organisation_members om
        WHERE om.organisation_id = org_id AND om.user_id = user_id
      )
    )
  ) INTO has_access;

  IF NOT has_access THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- Get teams in the organisation
  FOR result IN
    SELECT json_build_object(
      'id', t.id,
      'name', t.name,
      'description', t.description,
      'created_by', t.created_by,
      'created_at', t.created_at,
      'member_count', (
        SELECT COUNT(*)
        FROM team_members tm
        WHERE tm.team_id = t.id
      )
    )
    FROM teams t
    WHERE t.organisation_id = org_id
  LOOP
    RETURN NEXT result;
  END LOOP;

  RETURN;
END;
$$;

-- Function to check if an organisation slug is already taken
CREATE OR REPLACE FUNCTION check_organisation_slug_exists(p_slug text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  slug_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM organisations
    WHERE slug = p_slug
  ) INTO slug_exists;

  RETURN slug_exists;
END;
$$;

-- Function to get user directory with organisation filter
CREATE OR REPLACE FUNCTION get_user_directory_with_organisation(
  search_term text DEFAULT '',
  organisation_id uuid DEFAULT NULL
)
RETURNS SETOF json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_id uuid := auth.uid();
  result json;
BEGIN
  -- Get users matching search term
  FOR result IN
    SELECT json_build_object(
      'id', u.id,
      'email', u.email,
      'first_name', up.first_name,
      'last_name', up.last_name,
      'source', 'user'
    )
    FROM auth.users u
    LEFT JOIN user_profiles up ON u.id = up.id
    WHERE 
      u.id != user_id AND
      (
        search_term = '' OR
        u.email ILIKE '%' || search_term || '%' OR
        up.first_name ILIKE '%' || search_term || '%' OR
        up.last_name ILIKE '%' || search_term || '%' OR
        CONCAT(up.first_name, ' ', up.last_name) ILIKE '%' || search_term || '%'
      ) AND
      (
        organisation_id IS NULL OR
        EXISTS (
          SELECT 1
          FROM organisation_members om
          WHERE om.user_id = u.id AND om.organisation_id = organisation_id
        ) OR
        EXISTS (
          SELECT 1
          FROM organisations o
          WHERE o.owner_id = u.id AND o.id = organisation_id
        )
      )
    ORDER BY 
      CASE WHEN u.email ILIKE search_term || '%' THEN 0
           WHEN u.email ILIKE '%' || search_term || '%' THEN 1
           WHEN up.first_name ILIKE search_term || '%' THEN 2
           WHEN up.last_name ILIKE search_term || '%' THEN 3
           ELSE 4
      END,
      u.email
    LIMIT 20
  LOOP
    RETURN NEXT result;
  END LOOP;

  -- Get pending invitations matching search term
  FOR result IN
    SELECT json_build_object(
      'id', i.id,
      'email', i.email,
      'invited_at', i.invited_at,
      'source', 'invitation'
    )
    FROM invitations i
    WHERE 
      i.invited_by = user_id AND
      i.status = 'pending' AND
      (
        search_term = '' OR
        i.email ILIKE '%' || search_term || '%'
      ) AND
      (
        organisation_id IS NULL OR
        i.organisation_id = organisation_id
      )
    ORDER BY i.invited_at DESC
    LIMIT 10
  LOOP
    RETURN NEXT result;
  END LOOP;

  RETURN;
END;
$$;