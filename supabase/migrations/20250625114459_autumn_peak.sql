/*
  # Fix get_user_organisations function

  1. Changes
    - Drop the existing function if it exists
    - Create the get_user_organisations function that returns organisations for the current user
    - Function returns all organisations where the user is either the owner or a member
    - Includes the user's role in each organisation
*/

-- First drop the function if it exists
DROP FUNCTION IF EXISTS get_user_organisations();

-- Then create the function with the desired signature
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